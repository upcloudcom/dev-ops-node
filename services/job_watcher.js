/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-30
 * @author huangxin
 *
 */

/**
 * Service for job watcher

 */

'use strict';

const configsSercvice = require('./configs')
const flowBuildSercvice = require('./flow_build')
const flowService = require('./ci_flow')
const Https = require('https')
const Http = require('http')
const co = require('co')
const logger = require('../utils/logger').getLogger('job_watcher')

// 保存stage build id对应的所有socket
// stage build完成时，需要从该mapping中获取build对应的socket，从而进行通知
let SOCKETS_OF_BUILD_MAPPING = {}

// 保存socket对应的所有stage build id
// 删除指定socket对应的SOCKETS_OF_BUILD_MAPPING记录时，需要从此mapping中获取build id
// 当socket对应的所有build均完成通知之后须断开连接，根据此mapping来判断何时断开连接
let BUILDS_OF_SOCKET_MAPPING = {}

// 保存stage id 对应的所有socket
// 新建stage build时，需要通知哪个stage新建了build，根据此mapping来获取stage对应的socket
let SOCKETS_OF_STAGE_MAPPING = {}

// 保存socket对应的所有stage
// 删除指定socket对应的SOCKETS_OF_STAGE_MAPPING记录时，需要从此mapping中获取stage id
let STAGES_OF_SOCKET_MAPPING = {}

// 保存flow id对应的所有socket
let SOCKETS_OF_FLOW_MAPPING = {}

// 保存socket对应的所有flow
let FLOWS_OF_SOCKET_MAPPING = {}

let k8sConfig
function* initConfig () {
	if (!k8sConfig) {
    k8sConfig = yield configsSercvice.getK8SConfigs()
    // k8sConfig = {
    //   protocol: "https",
    //   host: "192.168.1.52:6443",
    //   token: '1zymD9wnWLs0wRbAjbmu8jQn8req5L46',
    //   version: "v1"
    // }
  }
}

exports.watch = function (flowId, watchedBuilds, socket) {
  let i = 0
  if (!watchedBuilds || watchedBuilds.length < 1) {
    //未指定watchedBuilds时，当做只监听flow
    if (!SOCKETS_OF_FLOW_MAPPING[flowId]) {
      SOCKETS_OF_FLOW_MAPPING[flowId] = {}
    }
    SOCKETS_OF_FLOW_MAPPING[flowId][socket.id] = socket
    if (!FLOWS_OF_SOCKET_MAPPING[socket.id]) {
      FLOWS_OF_SOCKET_MAPPING[socket.id] = {}
    }
    FLOWS_OF_SOCKET_MAPPING[socket.id][flowId] = true
    return
  }
  watchedBuilds.forEach(function (watched) {
    if (!watched.stageId) {
      _emitError(socket, 400, flowId, null, null, 'Stage id should be specified')
      return
    }
    //保存stage id对应的socket
    if (!SOCKETS_OF_STAGE_MAPPING[watched.stageId]) {
      SOCKETS_OF_STAGE_MAPPING[watched.stageId] = {}
    }
    SOCKETS_OF_STAGE_MAPPING[watched.stageId][socket.id] = {
      socket,
      flowId
    }

    //保存socket对应的stage id
    if (!STAGES_OF_SOCKET_MAPPING[socket.id]) {
      STAGES_OF_SOCKET_MAPPING[socket.id] = {}
    }
    STAGES_OF_SOCKET_MAPPING[socket.id][watched.stageId] = true

    if (!watched.stageBuildId) {
      return
    }
    flowBuildSercvice.getValidStageBuild(flowId, watched.stageId, watched.stageBuildId)
    .then(function (build) {
      if (build.status > 299) {
        //未获取到build时，返回错误
        _emitError(socket, build.status, flowId, watched.stageId, watched.stageBuildId, build.results.message)
      } else if (build.status === flowBuildSercvice.statusSuccess ||
                   build.status === flowBuildSercvice.statusFailed) {
        //状态为成功或失败时，返回状态
        _emitStatus(socket, flowId, watched.stageId, watched.stageBuildId, build.status)
      } else {
        //保存build与socket的映射关系
        _saveSocketAndBuild(socket, watched.stageBuildId, flowId, watched.stageId)
      }

      i++
      if (watchedBuilds.length === i) {
        //遍历完成时，处理不需要watch的socket
        _handleNoWatchedExist(socket)
      }
    })
  })
}

exports.start = function () {
  const method = 'jobWatcher.start'
  co(function* () {
    try {
      yield initConfig()
      _doStart()
    } catch(e) {
      logger.error(method, 'start job watcher error:', e)
    }
  })
}

exports.removeSocket = function (socket) {
  _removeStagesAndBuilds(socket)
  _removeFromMapping(socket.id, FLOWS_OF_SOCKET_MAPPING, SOCKETS_OF_FLOW_MAPPING)
}

exports.notifyFlowStatus = function (flowId, flowBuildId, status) {
  _notifyFlow(flowId, flowBuildId, status)
}

function _removeFromMapping(socketId, objsOfSocket, socketsOfObj) {
  //socket没有对应的object时，不用删除
  if (!objsOfSocket[socketId]) {
    return false
  }
  for (let objId in objsOfSocket[socketId]) {
    if (socketsOfObj[objId]) {
      // 删除object对应的socket
      delete(socketsOfObj[objId][socketId])
    }
  }
  // 清空socket对应的object
  delete(objsOfSocket[socketId])
  return true
}

function _removeStagesAndBuilds(socket) {
  _removeFromMapping(socket.id, STAGES_OF_SOCKET_MAPPING, SOCKETS_OF_STAGE_MAPPING) &&
    _removeFromMapping(socket.id, BUILDS_OF_SOCKET_MAPPING, SOCKETS_OF_BUILD_MAPPING)
}

function _doStart() {
  const method = 'jobWatcher._doStart'
  logger.info(method, 'Job watcher starting with config', k8sConfig)
  //watch含有stage-build-id label的jobs
  const jobWatcherOptions = _getOptions(`/apis/batch/v1/jobs?watch=true&labelSelector=stage-build-id`)
  const jobWatcherClient = _getClient()
  const jobWatcher = jobWatcherClient.request(jobWatcherOptions, function () {})
  let jobData = ""
  jobWatcher.on('response', (res) => {
    logger.info(method, 'Job watcher is ready')
    res.on('data', (data) => {
      jobData += data.toString()
      // res.pause(); // 暂停处理其他data事件
      let event
      try {
        logger.debug(method, "data to parse: ", jobData)
        event = JSON.parse(jobData);
        jobData = ""
      } catch (e) {
        logger.debug(method, `failed to parse a event of job, error: ${e}. Wait for next data to be appended`)
        logger.debug(method, `bad event is ${jobData}`)
        // res.resume()
        return
      }
      if ('DELETED' === event.type) {
        //收到deleted事件，job可能被第三方删除
        logger.info(method, 'A job is deleted:', event.object ? event.object.metadata.name : event)
        if (event.object.metadata.labels['stage-build-id']) {
          if (event.object.status && 1 >= event.object.status.succeeded) {
            //构建成功
            _notify(event.object.metadata.labels['stage-build-id'], flowBuildSercvice.statusSuccess)
          } else {
            //其他情况均视为失败状态
            _notify(event.object.metadata.labels['stage-build-id'], flowBuildSercvice.statusFailed)
          }
        }
      } else if ('ADDED' === event.type) {
        //收到added事件，等待中的stage build开始构建
        _notifyNewBuild(event.object.metadata.labels['stage-id'],
          event.object.metadata.labels['stage-build-id'], flowBuildSercvice.statusBuilding)
      } else if (event.object.status && 1 >= event.object.status.succeeded) {
        //job执行成功
        _notify(event.object.metadata.labels['stage-build-id'], flowBuildSercvice.statusSuccess)
      } else if (event.object.status && 1 >= event.object.status.failed) {
        //job执行失败
        _notify(event.object.metadata.labels['stage-build-id'], flowBuildSercvice.statusFailed)
      } else if (0 === event.object.spec.parallelism) {
        //停止job时
        //判断tenx-builder-succeed label是否存在，从而确定执行成功或失败，并通知
        if (event.object.metadata.labels['tenx-builder-succeed'] && event.object.metadata.labels['tenx-builder-succeed'] == '1') {
          _notify(event.object.metadata.labels['stage-build-id'], flowBuildSercvice.statusSuccess)
        } else {
          _notify(event.object.metadata.labels['stage-build-id'], flowBuildSercvice.statusFailed)
        }
      }
      // res.resume()
    })
    res.on('end', () => {
      logger.error(method, 'Job watcher is stopped, will be started again later')
      setTimeout(function() {
        _doStart()
      }, 1000)
    })
  })
  jobWatcher.on('error', (err) => {
    logger.error(method, `Job watcher started error:`, err)
    logger.info(method, 'Start again later')
    setTimeout(function() {
      if (err && err.code === 'ECONNREFUSED') {
        configsSercvice.getK8SConfigs().then(result => {
          global.K8SCONFIGS = result
          k8sConfig = result
          _doStart()
        })
        return
      }
      _doStart()
    }, 1000)
  })
  jobWatcher.end()
}

function _handleNoWatchedExist(socket) {
  // if (!BUILDS_OF_SOCKET_MAPPING[socket.id] ||
  //       Object.keys(BUILDS_OF_SOCKET_MAPPING[socket.id]).length < 1) {
  //   socket.disconnect()
  // }
}

function _saveSocketAndBuild(socket, stageBuildId, flowId, stageId) {
  //保存build id对应的socket
  if (!SOCKETS_OF_BUILD_MAPPING[stageBuildId]) {
    SOCKETS_OF_BUILD_MAPPING[stageBuildId] = {}
  }
  SOCKETS_OF_BUILD_MAPPING[stageBuildId][socket.id] = {
    socket,
    flowId,
    stageId
  }

  //保存socket对应的build id
  if (!BUILDS_OF_SOCKET_MAPPING[socket.id]) {
    BUILDS_OF_SOCKET_MAPPING[socket.id] = {}
  }
  BUILDS_OF_SOCKET_MAPPING[socket.id][stageBuildId] = true
}

function _notifyFlow(flowId, flowBuildId, status) {
  if (!flowId || !flowBuildId) {
    return
  }
  if (SOCKETS_OF_FLOW_MAPPING[flowId]) {
    for (let socketId in SOCKETS_OF_FLOW_MAPPING[flowId]) {
      _emitStatusOfFlow(SOCKETS_OF_FLOW_MAPPING[flowId][socketId], flowId, flowBuildId, status)
    }
  }
}

function _emitStatusOfFlow(socket, flowId, flowBuildId, buildStatus) {
  socket.emit('flowBuildStatus', {
    status: 200,
    results: { flowId, flowBuildId, buildStatus }
  })
}

function _emitErrorOfFlow(socket, status, flowId, flowBuildId, message) {
  socket.emit('flowBuildStatus', {
    status,
    results: { flowId, flowBuildId, message }
  })
}

function _notifyNewBuild(stageId, stageBuildId, status) {
  if (!stageId || !stageBuildId) {
    return
  }
  if (SOCKETS_OF_STAGE_MAPPING[stageId]) {
    for (var socketId in SOCKETS_OF_STAGE_MAPPING[stageId]) {
      _emitStatus(SOCKETS_OF_STAGE_MAPPING[stageId][socketId].socket,
        SOCKETS_OF_STAGE_MAPPING[stageId][socketId].flowId,
        stageId, stageBuildId, status)

      //保存新建build与socket的映射关系
      _saveSocketAndBuild(SOCKETS_OF_STAGE_MAPPING[stageId][socketId].socket,
        stageBuildId, SOCKETS_OF_STAGE_MAPPING[stageId][socketId].flowId, stageId)
    }
  }
}

function _notify(stageBuildId, status) {
  if (!stageBuildId) {
    return
  }
  if (SOCKETS_OF_BUILD_MAPPING[stageBuildId]) {
    for (var socketId in SOCKETS_OF_BUILD_MAPPING[stageBuildId]) {
      _emitStatus(SOCKETS_OF_BUILD_MAPPING[stageBuildId][socketId].socket,
        SOCKETS_OF_BUILD_MAPPING[stageBuildId][socketId].flowId,
        SOCKETS_OF_BUILD_MAPPING[stageBuildId][socketId].stageId,
        stageBuildId, status)
      if (status !== flowBuildSercvice.statusBuilding) {
        // 删除socket对应的stage build
        delete(BUILDS_OF_SOCKET_MAPPING[socketId][stageBuildId])
        // 处理socket是否需要关闭
        _handleNoWatchedExist(SOCKETS_OF_BUILD_MAPPING[stageBuildId][socketId].socket)
      }
    }
    if (status !== flowBuildSercvice.statusBuilding) {
      // 清空stage build对应的socket
      delete(SOCKETS_OF_BUILD_MAPPING[stageBuildId])
    }
  }
}

function _emitStatus(socket, flowId, stageId, stageBuildId, buildStatus) {
  socket.emit('stageBuildStatus', {
    status: 200,
    results: { flowId, stageId, stageBuildId, buildStatus }
  })
}

function _emitError(socket, status, flowId, stageId, stageBuildId, message) {
  socket.emit('stageBuildStatus', {
    status,
    results: { flowId, stageId, stageBuildId, message }
  })
}

function _getOptions(path) {
  let port = k8sConfig.host.split(':')[1] === undefined ? (k8sConfig.protocol === 'https' ? 443 : 80) : k8sConfig.host.split(':')[1]
  let authHeader
  if (k8sConfig.token) {
    authHeader = {'Authorization': 'bearer ' + k8sConfig.token};
  }
  const options = {
    protocol: `${k8sConfig.protocol}:`,
    hostname: k8sConfig.host.split(':')[0],
    port: port,
    path: path,
    method: 'GET',
    headers: authHeader
  }
  if (k8sConfig.protocol === 'https') {
    options.rejectUnauthorized = false;
  }
  return options
}

function _getClient() {
  return k8sConfig.protocol === 'https' ? Https : Http
}
