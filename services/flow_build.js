/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-6
 * @author huangxin
 *
 */

/**
 * Service for flow build
 */
'use strict'

const co = require('co')

const config = require('../configs')
const idGenerator = require('../utils/id_generator.js')
const ImageBuilderV2 = require('../ci/imagemgr/image_builder_v2')
const utils = require('../utils')
const logger = require('../utils/logger').getLogger('service/flow_build')
const security = require('../utils/security')

const stageService = require('./stage')
const notification = require('./notification')
const serviceUtils = require('./utils')
const repoService = require('./repo')
const stageLinkService = require('./stage_link')
const jobWatcherService = require('./job_watcher')

const modelUtil = require('../models/utils')
const ManagedProject = require('../models').ManagedProject
const FlowBuild = require('../models').FlowBuild
const StageBuild = require('../models').StageBuild
const Stage =  require('../models').Stage
const CIDockerfiles = require('../models').CIDockerfiles
const CIFlow = require('../models').CIFlow
const UserPreference = require('../models').UserPreference
const User = require('../models').User
const tailLines = require('../configs/index').tailLines
const cryptor = require('../utils/security')

const DEFAULT_PAGE_NUMBER = 1
const DEFAULT_PAGE_SIZE = 10

const STATUS_SUCCESS = 0
const STATUS_FAILED = 1
const STATUS_BUILDING = 2
const STATUS_WAITING = 3

const FLOW_URL = config.flow_detail_url

exports.statusSuccess = STATUS_SUCCESS
exports.statusFailed = STATUS_FAILED
exports.statusBuilding = STATUS_BUILDING

/*
Entrypoint of v2 ci flow build
*/
exports.startFlowBuild = function* (user, flowId, stageId, auditInfo, event, options) {
  const method = 'startFlowBuild'
  let flow = yield CIFlow.findFlowById(user.namespace, flowId)
  if (!flow) {
    logger.warn(method, 'Failed to find flow ' + flowId + ' of ' + user.namespace)
    return serviceUtils.responseNotFound('Flow cannot be found')
  }
  if (auditInfo) {
    auditInfo.resourceName = flow.name
    auditInfo.clusterId = global.K8SCONFIGS.clusterId
    auditInfo.namespace = flow.namespace
  }

  let stage
  // 指定stage时，从指定stage开始构建
  // 未指定stage时，从第一个stage开始构建
  if (stageId) {
    stage = yield stageService.getAndCheckMemberShip(flowId, stageId)
    if (stage.status) {
      //获取错误
      return stage
    }
  } else {
    stage = yield Stage.findFirstOfFlow(flowId)
    if (!stage) {
      logger.warn(method, 'Failed to find any stage of ' + flowId)
      return serviceUtils.responseNotFound('Stage cannot be found')
    }
  }

  let recentBuilds = yield StageBuild.findAllOfStage(stage.stage_id, 3)
  let waitingCount = 0
  if (recentBuilds && recentBuilds.length >= 3) {
    for (var i in recentBuilds) {
      if (STATUS_WAITING === recentBuilds[i].status) {
        waitingCount++
      }
      if (waitingCount >= 3) {
        logger.warn(method, 'Too many waiting builds of ' + stage.stage_id)
        return serviceUtils.responseForbidden('Too many waiting builds')
      }
    }
  }

  let flowBuildId = idGenerator.newFlowBuildID()
  let stageBuildId = idGenerator.newStageBuildID()
  let codeBranch
  if (event) {
    codeBranch = event.name
    /*if (event.type.toLowerCase() == "merge_request" && stage.default_branch && stage.default_branch !== codeBranch)
      //merge branch 直接使用 head_branch
      return {
        status: 200,
        message: "Merge request was not created at specified branch of stage"
      }
    }*/
  }
  let stageBuildRec = {
    build_id: stageBuildId,
    flow_build_id: flowBuildId,
    stage_id: stage.stage_id,
    stage_name: stage.stage_name,
    status: STATUS_WAITING,
    is_first: 1,
    namespace: stage.namespace,
    branch_name: (codeBranch ? codeBranch : stage.default_branch) || ''
  }
  // 可以在选项中指定 branch 等
  if (options) {
    if (options.branch) {
      stageBuildRec.branch_name = options.branch
    }
  }
  // 如果 flow 开启了 “统一使用代码库” ，把构建时指定的 branch 保存在 stage 的 option 中
  // 在这个 stage 构建完成后，传递给下一个 stage
  if (flow.uniform_repo === 0) {
    stage.options = options
  }
  let flowBuildRec = {
    build_id: flowBuildId,
    flow_id: flowId,
    user_id: user.id
  }
  yield modelUtil.trans(function (t) {
    //添加flow构建记录
    return FlowBuild.insertOne(flowBuildRec, t).then(function () {
      //查找执行中的构建记录
      return StageBuild.findAllByIdWithStatus(stage.stage_id, STATUS_BUILDING, t).then(function (buildRecs) {
        if (0 === buildRecs.length) {
          //没有执行中的构建记录，则添加“执行中”状态的构建记录
          stageBuildRec.status = STATUS_BUILDING
        }
        //添加stage构建记录
        return StageBuild.insertOne(stageBuildRec, t)
      })
    })
  })
  if (auditInfo) {
    auditInfo.resourceId = flowBuildId
  }
  jobWatcherService.notifyFlowStatus(flowId, flowBuildId, STATUS_BUILDING)
  //开始此次构建
  if (STATUS_BUILDING === stageBuildRec.status) {
    // Only use namespace for teamspace scope
    let flowOwner = flow.namespace

    try {
      let result = yield* _startStageBuild(user, stage, stageBuildRec, flowOwner)
      if (result.status > 299) {
        jobWatcherService.notifyFlowStatus(flowId, flowBuildId, STATUS_FAILED)
        return result
      }
    } catch (err) {
      logger.error(method, 'exception of stage build', err.stack)
      yield _setFailedStatus(user, stage, stageBuildRec, flowOwner)
      jobWatcherService.notifyFlowStatus(flowId, flowBuildId, STATUS_FAILED)
      return serviceUtils.responseInternalError('Unexpected error')
    }
  }
  //返回成功
  return serviceUtils.responseSuccess({flowBuildId, stageBuildId})
}

exports.getStageBuildLogsFromK8S = function (flowId, stageId, stageBuildId, socket) {
  const method = 'getStageBuildLogs'
  let imageBuilder = new ImageBuilderV2()
  return _getValidStageBuild(flowId, stageId, stageBuildId)
  .then(function (build) {
    if (build.status > 299) {
      return build
    }
    if (STATUS_WAITING === build.status) {
      return serviceUtils.responseSuccess({buildStatus: 'waiting'})
    }
    if (!build.pod_name) {
      return imageBuilder.getPodName(build.namespace, build.job_name)
      .then(function (podName) {
        if (!podName) {
          logger.error(method, "Failed to get a pod of job", build.job_name)
          return serviceUtils.responseGone('Failed to get log because the build container can not be found')
        }
        StageBuild.updateById({pod_name: podName}, stageBuildId)
        return _getLogsFromK8S(imageBuilder, build.namespace, build.job_name, podName, socket)
      })
    }
    return _getLogsFromK8S(imageBuilder, build.namespace, build.job_name, build.pod_name, socket)
  })
  .catch(function (err) {
    logger.error(method, 'Failed to get logs of stage build', err)
    return {
      status: 500,
      results: err
    }
  })
}

exports.getStageBuildLogsFromES = function* (user, flowId, stageId, stageBuildId, res) {
  const method = 'getStageBuildLogsFromES'
  let imageBuilder = new ImageBuilderV2()
  let build = yield _getValidStageBuild(flowId, stageId, stageBuildId)
  if (build.status > 299) {
    return build
  }
  if (!build.pod_name) {
    let podName = yield imageBuilder.getPodName(build.namespace, build.job_name)
    if (!podName) {
      logger.error(method, "Failed to get a pod of job", build.job_name)
      res.writeHead(200, {'Connection': 'close'})
      res.write('<font color="#ffc20e">[Tenx Flow API] 构建任务不存在或已经被删除</font>')
      return
    }
    build.pod_name = podName
    StageBuild.updateById({pod_name: podName}, stageBuildId)
  }
  let startTime = build.creation_time
  if (build.start_time) {
    startTime = build.start_time
  }
  let endTime = build.end_time
  //当从es获取日志失败的时候，从k8s获取日志
  var getLogFromK8S = function () {
    return imageBuilder.getJobLogs(build.namespace, build.job_name, build.pod_name).then(logs => {
      if (logs && logs != '') {
        res.write(logs)
      }
    }).catch(err => {
      logger.error(method, "Failed to get logs", err)
      try {
        err = JSON.parse(err)
        if (err.code == 404) {
          res.write('<font color="red">[Tenx Flow API Error] 构建任务不存在!</font>')
          return
        }
        res.write('<font color="red">[Tenx Flow API Error] Failed to get the rest of logs, please try again!</font>')
      } catch (error) {
        res.write('<font color="red">[Tenx Flow API Error] Failed to get the rest of logs, please try again!</font>')
      }
    })
  }
  res.writeHead(200, { 'Connection': 'close' })
  const completeLog = yield imageBuilder.getJobLogsFromES(build.namespace, build.job_name, build.pod_name, startTime, endTime, res, build.status).then(result => {
    logger.info(method, "Get log from ES: " + result)
    if (!result || result > 300) {
      return getLogFromK8S()
    }
  }).catch(function (err) {
    logger.error(method, "Failed to get logs", err)
    return getLogFromK8S()
  })
  return
}

exports.getBuildEvents = function* (user, flowId, stageId, stageBuildId) {
  const method = 'getBuildEvents'
  let imageBuilder = new ImageBuilderV2()
  let build = yield _getValidStageBuild(flowId, stageId, stageBuildId)
  if (build.status > 299) {
    return build
  }
  if (!build.pod_name) {
    let podName = yield imageBuilder.getPodName(build.namespace, build.job_name)
    if (!podName) {
      logger.error(method, "Failed to get a pod of job", build.job_name)
      return serviceUtils.responseGone('Failed to get events because the build container can not be found')
    }
    build.pod_name = podName
    StageBuild.updateById({pod_name: podName}, stageBuildId)
  }
  let events = yield imageBuilder.getEvents(build.namespace, build.job_name, build.pod_name)
  if (_isK8SError(events)) {
    logger.error(method, `Failed to get events of job ${jobName}: `, events.message)
    return serviceUtils.responseInternalError('Failed to get Events')
  }
  return serviceUtils.responseSuccess(events)
}

exports.getBuildsOfFlow = function* (user, flowId) {
  let builds = yield FlowBuild.findAllOfFlow(flowId, DEFAULT_PAGE_SIZE)
  if (builds && builds.length > 0) {
    let results = []
    builds.forEach(function (b) {
      results.push(_formatBuild(b))
    })
    return serviceUtils.responseSuccess({results})
  }
  return serviceUtils.responseSuccess({results:[]})
}

exports.getLastBuildDetailsOfFlow = function* (user, flowId) {
  let builds = yield FlowBuild.findLastBuildOfFlowWithStages(flowId)
  if (builds && builds.length > 0) {
    let results = _formatBuild(builds[0])
    let stagesBuilds = []
    builds.forEach(function (b) {
      stagesBuilds.push(_formatStageBuild(b, "stage_build_"))
    })
    results.stageBuilds = stagesBuilds
    return serviceUtils.responseSuccess({results})
  }
  return serviceUtils.responseSuccess({results:[]})
}

exports.getStageBuildsOfFlowBuild = function* (user, flowId, flowBuildId) {
  let build = yield FlowBuild.findFlowBuild(flowId, flowBuildId)
  if (!build) {
    return serviceUtils.responseNotFound('Cannot find flow build of specified flow')
  }
  let builds = yield StageBuild.findAllOfFlowBuild(flowBuildId)
  if (builds && builds.length > 0) {
    let results = []
    builds.forEach(function (b) {
      results.push(_formatStageBuild(b))
    })
    return serviceUtils.responseSuccess({results})
  }
  return serviceUtils.responseSuccess({results:[]})
}

exports.getBuildsOfStage = function* (user, flowId, stageId) {
  let stage = yield stageService.getAndCheckMemberShip(flowId, stageId)
  if (stage.status) {
    //获取发生错误
    return stage
  }
  let builds = yield StageBuild.findAllOfStage(stageId, DEFAULT_PAGE_SIZE)
  if (builds && builds.length > 0) {
    let results = []
    builds.forEach(function (b) {
      results.push(_formatStageBuild(b))
    })
    return serviceUtils.responseSuccess({results})
  }
  return serviceUtils.responseSuccess({results:[]})
}

exports.getValidStageBuild = function (flowId, stageId, stageBuildId) {
  return _getValidStageBuild (flowId, stageId, stageBuildId)
}

exports.stopFlowBuild = function* (user, flowId, stageId, stageBuildId) {
  const method = 'stopFlowBuild'

  let stage = yield stageService.getAndCheckMemberShip(flowId, stageId)
  if (stage.status) {
    //获取发生错误
    return stage
  }

  let stageBuild = yield StageBuild.findStageBuild(stageId, stageBuildId)
  if (!stageBuild) {
    // Print warning but skip it
    logger.warn(method, 'Cannot find stage build of specified flow')
    return serviceUtils.responseNotFound({message: 'Stage build not found'})
  } else {
    //已构建完成，直接返回
    if (stageBuild.status < STATUS_BUILDING) {
      return serviceUtils.responseSuccess({message: 'build is not running'})
    }
  }
  let flowBuildId = stageBuild.flow_build_id
  logger.info(method, "Stopping flow " + flowBuildId)
  //获取未完成的stage构建
  let builds = yield StageBuild.findUnfinishedByFlowBuildId(flowBuildId)
  if (0 === builds.length) {
    // logger.info('set end_time of flow build when we stop build and no running stages builds:', utils.DateNow())
    jobWatcherService.notifyFlowStatus(flowId, flowBuildId, STATUS_FAILED)
    yield FlowBuild.updateById({
      end_time: utils.DateNow(),
      status: STATUS_FAILED
    }, flowBuildId)
    return serviceUtils.responseSuccess({flowBuildId, message: 'All stage builds were finished'})
  }
  //遍历未完成构建，删除对应job并更新数据库
  //绝大多数情况只会有一条未完成构建
  let imageBuilder = new ImageBuilderV2()
  for (var i in builds) {
    let buildRec = {
      end_time: utils.DateNow(),
      status: STATUS_FAILED
    }
    if (STATUS_BUILDING === builds[i].status) {
      if (builds[i].namespace && builds[i].job_name) {
        if (!builds[i].pod_name) {
          let podName = yield imageBuilder.getPodName(builds[i].namespace, builds[i].job_name)
          //停止job之前，先获取pod名称并更新数据库。
          if (podName) {
            buildRec.pod_name = podName
          }
        }
        let job = yield imageBuilder.stopJob(builds[i].namespace, builds[i].job_name, {forced: true})
        if (_isK8SError(job) && 404 !== job.message.code) {
          logger.error(method, `Failed to delete job of stage build ${builds[i].build_id}`, job.message)
          return serviceUtils.responseInternalError('Failed to stop build')
        }
      }
    }
    //更新stage构建状态
    yield StageBuild.updateById(buildRec, builds[i].build_id)
  }
  // logger.info('set end_time of flow build when we stop build', utils.DateNow())
  //更新flow构建状态
  jobWatcherService.notifyFlowStatus(flowId, flowBuildId, STATUS_FAILED)
  yield FlowBuild.updateById({
    end_time: utils.DateNow(),
    status: STATUS_FAILED
  }, flowBuildId)
  return serviceUtils.responseSuccess({flowBuildId, message: 'Success'})
}

function _getLogsFromK8S(imageBuilder, namespace, jobName, podName, socket) {
  return imageBuilder.getJobLogs(namespace, jobName, podName, socket)
  .then(function (logs) {
    return imageBuilder.waitForJob(namespace, jobName)
  })
  .then(function (status) {
    if (status.succeeded > 0) {
      return serviceUtils.responseSuccess({buildStatus: STATUS_SUCCESS})
    } else {
      return serviceUtils.responseSuccess({buildStatus: STATUS_FAILED})
    }
  })
}

function _isK8SError (resource) {
  return resource && resource.message && 'Status' === resource.message.kind
}

function _formatStageBuild(record, fieldPrefix) {
  let build = _formatBuild(record, fieldPrefix)
  build.stageName = record.stage_name
  build.stageId = record.stage_id
  return build
}

function _formatBuild(record, fieldPrefix) {
  fieldPrefix = fieldPrefix ? fieldPrefix : ""
  return {
    buildId: record[fieldPrefix + "build_id"],
    status: record[fieldPrefix + "status"],
    creationTime: record[fieldPrefix + "creation_time"],
    startTime: record[fieldPrefix + "start_time"],
    endTime: record[fieldPrefix + "end_time"]
  }
}

function _getValidStageBuild (flowId, stageId, stageBuildId) {
  const method = '_getValidStageBuild'
  return Stage.findOneById(stageId)
  .then(function (stage) {
    if (!stage) {
      throw serviceUtils.responseNotFound('Stage not found')
    }
    if (flowId !== stage.flow_id) {
      throw serviceUtils.responseForbidden('Stage is not in the flow')
    }
    return StageBuild.findOneById(stageBuildId)
  })
  .then(function (build) {
    if (!build) {
      throw serviceUtils.responseNotFound('Build not found')
    }
    if (stageId !== build.stage_id) {
      throw serviceUtils.responseForbidden('Build is not one of the stage')
    }

    return build
  })
  .catch(function (err) {
    logger.error(method, 'Failed to get stage build', err)
    if (err.status) {
      return err
    }
  })
}

function* _setFailedStatus(user, stage, stageBuild, flowOwner) {
  const method = '_setFailedStatus'
  let now = utils.DateNow()
  let buildRec = {
    start_time: now,
    end_time: now,
    status: STATUS_FAILED
  }
  if (stageBuild.flow_build_id && 1 !== stageBuild.build_alone) {
    let flowBuild = yield FlowBuild.findOneById(stageBuild.flow_build_id)
    if (flowBuild) {
      if (flowBuild.start_time) {
        delete(buildRec.start_time)
      }
      // logger.info('set end_time of flow build when build is failed:', now)
      //非独立构建stage时，更新flow构建的状态
      FlowBuild.updateById(buildRec, stageBuild.flow_build_id)
    }
  }
  //处理下一个构建
  yield _updateStatusAndHandleWaiting(user, stage, buildRec, stageBuild.build_id, flowOwner)
}

function* _decPassword(password, user, stage, stageBuild, flowOwner) {
  const method = '_decPassword'
  let privKey = user.token
  if (!privKey) {
    //session中没有token（ci触发）时，从user表中查找
    let userRec = yield User.findByName(user.name)
    if (!userRec) {
      logger.error(method, 'Failed to find user of', user.name)
      yield _setFailedStatus(user, stage, stageBuild, flowOwner)
      return {
        status: 404,
        message: 'Cannot find user'
      }
    }
    user.token = userRec.api_token
  }
  password = security.decRegistryPassword(password, user.token)
  if (!password) {
    yield _setFailedStatus(user, stage, stageBuild, flowOwner)
    return {
      status: 500,
      message: 'Failed to decrypt registry password'
    }
  }
  return {
    status: 200,
    password
  }
}

function useScript(containerInfo) {
  return containerInfo.hasOwnProperty('scripts_id')
}

function getUser(userName) {
  return User.findByName(userName)
}

function* makeScriptEntryEnvForInitContainer(user, containerInfo) {
  const scriptID = containerInfo.scripts_id
  const userName = user.name
  let userToken = null
  if (user.token) {
    userToken = user.token
  } else {
    const u = yield getUser(userName)
    userToken = u.api_token
  }
  containerInfo.args = []
  containerInfo.command = `/app/${scriptID}`
  containerInfo.env.push({
    name: 'SCRIPT_ENTRY_INFO',
    value: cryptor.aeadEncrypt(`${scriptID}:${userName}:${userToken}`)
  }, {
    name: 'SCRIPT_URL',
    value: utils.getScriptUrl()
  })
}

function* _startStageBuild(user, stage, stageBuild, flowOwner) {
  //TODO: support build image
  //TODO: support shared volume
  //TODO: support dependencies environment
  let method = '_startStageBuild'
  let resData = {
    status: 200
  }
  let project = {}
  if (stage.project_id) {
    project = yield ManagedProject.findProjectById(user.namespace, stage.project_id)
    if (!project) {
      //project不存在，更新构建状态为失败
      yield _setFailedStatus(user, stage, stageBuild, flowOwner)
      return serviceUtils.responseForbidden('Project is inactive')
    }
  }
  let volumeMapping = yield stageLinkService.getVolumeSetting(stage.flow_id,
    stage.stage_id, stageBuild.flow_build_id, stageBuild.build_id)
  if (volumeMapping.status > 299) {
    yield _setFailedStatus(user, stage, stageBuild, flowOwner)
    return volumeMapping
  }
  let registryConf = global.REGISTRY_CONFIG
  if (!registryConf || !registryConf.host) {
    registryConf = {host:'index.tenxcloud.com'}
    let pubHubConf = yield UserPreference.findOneOfPubHub(user.namespace)
    if (pubHubConf) {
      try {
        pubHubConf = JSON.parse(pubHubConf.config_detail)
        if (!pubHubConf.host) {
          registryConf = {host:'index.tenxcloud.com'}
        } else {
          if (pubHubConf.password) {
            let decrypted = yield _decPassword(pubHubConf.password, user, stage, stageBuild, flowOwner)
            if (decrypted.status > 299) {
              notification.sendEmailUsingFlowConfig(user.namespace, stage.flow_id, {
                type: 'ci',
                result: 'failed',
                subject: `'${stage.stage_name}'构建失败`,
                body: `TenxCloud Hub登录密码解密失败`
              })
              return decrypted
            }
            pubHubConf.password = decrypted.password
          }
          registryConf = pubHubConf
        }
      } catch(e) {
        logger.error(method, 'cannot parse tenxcloud hub configurations', e)
        registryConf = {host:'index.tenxcloud.com'}
      }
    }
  }
  const buildInfo = {
    repoUrl: project.address,
    // imageName: `${project.image_name}:${build.image_tag}`,
    // dockerfileLocation: build.dockerfile_location,
    isCodeRepo: 1,
    branch: stageBuild.branch_name ? stageBuild.branch_name : stage.default_branch,
    publicKey: '',
    privateKey: '',
    git_repo_url: '',
    repoType: repoService.depotToRepoType(project.repo_type),
    scmImage: `${registryConf.host}/${config.repo_info.scm_image}`,
    clone_location: config.repo_info.clone_location,
    // Only build under user namespace or the owner of project(CI case)
    namespace:  user.userNamespace || project.owner,
    build_image: stage.image,
    buildImageFlag: stageService.isBuildImageStage(stage.type),
    flowName: stage.flow_id,
    stageName: stage.stage_id,
    flowBuildId: stageBuild.flow_build_id,
    stageBuildId: stageBuild.build_id,
    type: stage.type,
    targetImage: {},
    imageOwner: flowOwner ? flowOwner.toLowerCase() : flowOwner
  }
  let useCustomRegistry
  if (stage.build_info) {
    buildInfo.targetImage = JSON.parse(stage.build_info)
    // Image name should be project/image-name, user should specify the target project
    // If not specified, use default public one
    if (!buildInfo.targetImage.project || buildInfo.targetImage.project.trim() === '') {
      buildInfo.targetImage.project = config.default_push_project
    }
    buildInfo.targetImage.image = buildInfo.targetImage.project + '/' + buildInfo.targetImage.image
    if (!global.REGISTRY_CONFIG.host && registryConf.user) {
      buildInfo.targetImage.image = registryConf.user + '/' + iname
    }
    if (stageService.customRegistryType === buildInfo.targetImage.registryType) {
      //自定义仓库时
      let customRegistryFailed = function* (status, message) {
        resData.status = status
        resData.message = message
        yield _setFailedStatus(user, stage, stageBuild, flowOwner)
        return resData
      }
      //customRegistry不存在时返回错误
      if (!buildInfo.targetImage.customRegistry) {
        logger.error(method, 'user preference id is not specified')
        resData = yield customRegistryFailed(403, 'No 3rd party registry is specified')
        notification.sendEmailUsingFlowConfig(user.namespace, stage.flow_id, {
          type: 'ci',
          result: 'failed',
          subject: `'${stage.stage_name}'构建失败`,
          body: `未指定自定义仓库，将导致无法推送镜像`
        })
        return resData
      }
      let thirdRegistry = yield UserPreference.findOneOf3rdPartyById(buildInfo.targetImage.customRegistry, user.namespace)
      //第三方仓库获取失败时返回错误
      if (!thirdRegistry) {
        logger.error(method, 'user preference id is not specified')
        resData = yield customRegistryFailed(404, 'Failed to find 3rd party registry configurations')
        notification.sendEmailUsingFlowConfig(user.namespace, stage.flow_id, {
          type: 'ci',
          result: 'failed',
          subject: `'${stage.stage_name}'构建失败`,
          body: `自定义仓库已不存在，将导致无法推送镜像`
        })
        return resData
      }
      try {
        thirdRegistry = JSON.parse(thirdRegistry.config_detail)
        if (thirdRegistry.password) {
          let decrypted = yield _decPassword(thirdRegistry.password, user, stage, stageBuild, flowOwner)
          if (decrypted.status > 299) {
            notification.sendEmailUsingFlowConfig(user.namespace, stage.flow_id, {
              type: 'ci',
              result: 'failed',
              subject: `'${stage.stage_name}'构建失败`,
              body: `自定义仓库登录密码解密失败`
            })
            return decrypted
          }
          thirdRegistry.password = decrypted.password
        }
        buildInfo.targetImage.customRegistryConfig = {
          url: thirdRegistry.registry_url.replace(/http[s]?\:\/\//, ''),
          user: thirdRegistry.username,
          password: thirdRegistry.password
        }
      } catch(e) {
        logger.error(method, 'cannot parse 3rd party registry configurations', e)
        resData = yield customRegistryFailed(500, 'Failed to parse 3rd party registry configurations')
        notification.sendEmailUsingFlowConfig(user.namespace, stage.flow_id, {
          type: 'ci',
          result: 'failed',
          subject: `'${stage.stage_name}'构建失败`,
          body: `无法读取自定义仓库配置，请尝试重新添加`
        })
        return resData
      }
      useCustomRegistry = true
      if (buildInfo.targetImage.customRegistryConfig.user) {
        buildInfo.targetImage.image = buildInfo.targetImage.customRegistryConfig.user + '/' + iname
      }
    }
    if (2 === buildInfo.targetImage.DockerfileFrom) {
      //获取在线Dockerfile
      let dockerfileOL = yield CIDockerfiles.getDockerfile(user.namespace, stage.flow_id, stage.stage_id)
      if (!dockerfileOL || !dockerfileOL.content) {
        return serviceUtils.responseForbidden('Online Dockerfile should be created before starting a build')
      }
      buildInfo.targetImage.DockerfileOL = dockerfileOL.content.toString()
    }
  }
  if (stageBuild.node_name) {
    buildInfo.nodeName = stageBuild.node_name
  }
  let buildWithDependency = false
  if (stage.container_info) {
    let containerInfo = JSON.parse(stage.container_info)
    if (useScript(containerInfo)) {
      yield makeScriptEntryEnvForInitContainer(user, containerInfo)
    }
    if (containerInfo.hasOwnProperty('command')) {
      buildInfo.command = containerInfo.command
    }
    buildInfo.build_command = containerInfo.args
    buildInfo.env = containerInfo.env
    if (containerInfo.dependencies && containerInfo.dependencies.length > 0) {
      buildWithDependency = true
      buildInfo.dependencies = []
      containerInfo.dependencies.forEach(function (d) {
        buildInfo.dependencies.push({
          // d.service should be the image name
          image: `${registryConf.host}/${d.service}`,
          env: d.env
        })
      })
    }
  }
  const depot = project.repo_type
  if (depot === 'svn' && project.is_private === 1) {
    // For private svn repository
    const svnUserInfo = yield* repoService.getReposAuthInfo(user, depot)
    if (svnUserInfo.status !== 200) {
      logger.warn(method, 'get svn user failed -> ' + svnUserInfo.username)
    } else {
      logger.info(method, 'get svn user successfully -> ' + svnUserInfo.username)
      buildInfo.svn_username = svnUserInfo.results.username
      buildInfo.svn_password = svnUserInfo.results.token
    }
  } else if ((depot === 'gitlab' && project.is_private === 1) ||
               (project.address && project.address.indexOf('@') > -1)) {
    // Handle private githlab
    buildInfo.git_repo_url = project.address.substr(project.address.indexOf('@')).match(/[A-Za-z0-9-_.]+/)[0]
    buildInfo.privateKey = '"' + security.decryptContent(project.private_key.toString()) + '"'
    buildInfo.publicKey = '"' + project.public_key + '"'
  }
  let buildRec = {
    start_time: utils.DateNow()
  }

  //设置构建集群
  let buildCluster
  if(stage.ci_config) {
    const ci_config = JSON.parse(stage.ci_config)
    if(ci_config.buildCluster) {
      buildCluster = ci_config.buildCluster
    }
  }

  const imageBuilder = new ImageBuilderV2(buildCluster)
  const job = yield imageBuilder.buildImage(buildInfo, volumeMapping, registryConf)

  if (_isK8SError(job)) {
    logger.error(method, ': failed to create job with code: ', job.statusCode,
      'and message: ', job.message)
    buildRec.status = STATUS_FAILED
    buildRec.end_time = utils.DateNow()
    resData.status = 500
    resData.message = 'Failed to create job'
  } else {
    buildRec.job_name = job.metadata.name
    buildRec.namespace = job.metadata.namespace
    _waitForBuildToCompleteV2(job, imageBuilder, user, stage, stageBuild, {
      buildWithDependency,
      flowOwner,
      imageName: 1 == buildInfo.targetImage.registryType ? buildInfo.targetImage.image : "",
      useCustomRegistry
    })

    // buildAgentService.increaseBuilderWorkload(builderConfig.name)
  }
  const pod = yield imageBuilder.getPod(job.metadata.namespace, job.metadata.name)
  if (pod) {
    buildRec.pod_name = pod.metadata.name
  }
  yield StageBuild.updateById(buildRec, stageBuild.build_id)

  if (stageBuild.flow_build_id) {
    let flowBuildRec = {}
    //如果stage构建为flow构建中的第一步，则更新flow构建的起始时间。
    if (1 === stageBuild.is_first) {
      flowBuildRec.start_time = buildRec.start_time
      flowBuildRec.status = buildRec.status
    }
    //如果stage构建失败，则更新flow结束时间
    if (STATUS_FAILED === buildRec.status) {
      flowBuildRec.end_time = buildRec.end_time
      flowBuildRec.status = buildRec.status
    }
    if (Object.keys(flowBuildRec).length > 0) {
      yield FlowBuild.updateById(buildRec, stageBuild.flow_build_id)
    }
  }
  resData.results = stageBuild
  return resData
}

function _isContainerCreated(name, containerStatuses) {
  for (var i in containerStatuses) {
    if (name === containerStatuses[i].name) {
      // 判断builder容器是否存在或是否重启过，从而判断是否容器创建成功
      if (containerStatuses[i].containerID || containerStatuses[i].restartCount) {
        return true
      }
    }
  }
  return false
}

function* _handleWaitTimeout(job, imageBuilder) {
  const method = '_handleWaitTimeout'
  let pod = yield imageBuilder.getPod(job.metadata.namespace, job.metadata.name)

  let result = {}
  if (pod) {
    logger.debug(method, '- Checking if build container is timeout')
    if (pod.status && pod.status.containerStatuses && pod.status.containerStatuses.length > 0 &&
        _isContainerCreated(imageBuilder.builderName, pod.status.containerStatuses)) {
      // 终止后续处理
      result.timeout = false
      return result
    }
    logger.debug(method, '- Checking if scm container is timeout')
    try {
      let scmStatuses = JSON.parse(pod.metadata.annotations['pod.alpha.kubernetes.io/init-container-statuses'])
      if (_isContainerCreated(imageBuilder.scmName, scmStatuses)) {
        // 终止后续处理
        result.timeout = false
        return result
      }
    } catch (e) {
      logger.error(method, '- Failed to parse init container status:', e)
    }
  }
  logger.debug(method, '- Stopping job')
  //终止job
  result.pod = pod
  yield imageBuilder.stopJob(job.metadata.namespace, job.metadata.name)
  result.timeout = true
  return result
}

function _waitForBuildToCompleteV2(job, imageBuilder, user, stage, build, options) {
  const method = '_waitForBuildToCompleteV2'
  let registryConfig = global.REGISTRY_CONFIG
  // const builderConfig = imageBuilder.builder
  let newBuild = {}
  co(function* () {
    // Get the correct registry config
    let pubConfig = false
    if (!registryConfig || !registryConfig.host) {
      registryConfig = {host:'index.tenxcloud.com'}
      let pubHubConf = yield UserPreference.findOneOfPubHub(user.namespace)
      if (pubHubConf) {
        pubConfig = true
        try {
          pubHubConf = JSON.parse(pubHubConf.config_detail)
          if (!pubHubConf.host) {
            registryConfig = {host:'index.tenxcloud.com'}
          } else {
            if (pubHubConf.password) {
              let decrypted = yield _decPassword(pubHubConf.password, user, stage, build, options.flowOwner)
              if (decrypted.status > 299) {
                notification.sendEmailUsingFlowConfig(user.namespace, stage.flow_id, {
                  type: 'ci',
                  result: 'failed',
                  subject: `'${stage.stage_name}'构建失败`,
                  body: `TenxCloud Hub登录密码解密失败`
                })
                return decrypted
              }
              pubHubConf.password = decrypted.password
            }
            registryConfig = pubHubConf
          }
        } catch(e) {
          logger.error(method, 'cannot parse tenxcloud hub configurations', e)
          registryConfig = {host:'index.tenxcloud.com'}
        }
      }
    }
    let errMsg
    try {
      //设置3分钟超时，如无法创建container则自动停止构建
      let timeout = false
      let pod
      let timer = setTimeout(function () {
        co(function* () {
          try {
            let result = yield _handleWaitTimeout(job, imageBuilder)
            pod = result.pod
            timeout = result.timeout
          } catch(e) {
            logger.error(method, "Failed to handle wait timeout:", e)
          }
        })
      }, 180000);
      let status = yield imageBuilder.waitForJob(job.metadata.namespace, job.metadata.name, options.buildWithDependency)
      clearTimeout(timer)
      while (status.conditions && 'Timeout' === status.conditions[0].status) {
        logger.warn(method, 'Waiting for job timeout, try again')
        status = yield imageBuilder.waitForJob(job.metadata.namespace, job.metadata.name, options.buildWithDependency)
      }
      logger.debug(method, "Build result: " + JSON.stringify(status))
      let statusCode = 1
      if (status.failed > 0) {
        //执行失败
        statusCode = 1
      } else if (status.succeeded > 0) {
        //执行成功
        statusCode = 0
      }
      logger.debug(method, 'Wait ended normally...')
      newBuild = {
        end_time: utils.DateNow(),
        status: (statusCode === 0) ? STATUS_SUCCESS : STATUS_FAILED
      }

      if (!pod) {
        try{
          //获取pod
          pod = yield imageBuilder.getPod(job.metadata.namespace, job.metadata.name)
          if (pod) {
            //执行失败时，生成失败原因
            if (statusCode === 1) {
              if (pod.status && pod.status.containerStatuses) {
                pod.status.containerStatuses.forEach(function (s) {
                  if (s.name === imageBuilder.builderName && s.state.terminated) {
                    errMsg = `运行构建的容器异常退出：exit code为${s.state.terminated.exitCode}，退出原因为${s.state.terminated.reason}`
                  }
                })
              }
              if (!errMsg && pod.metadata.annotations['pod.alpha.kubernetes.io/init-container-statuses']) {
                let scmStatuses = JSON.parse(pod.metadata.annotations['pod.alpha.kubernetes.io/init-container-statuses'])
                for (var i in scmStatuses) {
                  if (scmStatuses[i].name === imageBuilder.scmName && scmStatuses[i].state.terminated) {
                    errMsg = `代码拉取失败：exit code为${scmStatuses[i].state.terminated.exitCode}，退出原因为${scmStatuses[i].state.terminated.reason}`
                    break
                  }
                }
              }
            }
          } else {
            logger.warn(method, 'Failed to get a pod of job')
          }
        } catch (err) {
          logger.warn(method, 'Failed to get a pod of job:', err)
        }
      }
      if (pod) {
        newBuild.pod_name = pod.metadata.name
        if (!build.node_name) {
          build.node_name = pod.spec.nodeName
        }
        newBuild.node_name = build.node_name
      }
      if (0 !== statusCode) {
        logger.warn(method, 'Deleting job: ' + job.metadata.name)
        //执行失败时，终止job
        if (!status.forcedStop) {
          yield imageBuilder.stopJob(job.metadata.namespace, job.metadata.name)
        } else {
          errMsg = '构建流程被手动停止'
        }

        if (build.flow_build_id) {
          // logger.info('set end_time of flow build when job error:', newBuild.end_time)
          let updateFBResult = yield FlowBuild.updateById(newBuild, build.flow_build_id)
          if (!status.forcedStop) {
            jobWatcherService.notifyFlowStatus(stage.flow_id, build.flow_build_id, newBuild.status)
          }
          if (updateFBResult[0] < 1) {
            yield FlowBuild.updateById(newBuild, build.flow_build_id)
            logger.error(method, `update flow build failed, buildId: ${build.flow_build_id}`)
          }
        }
      }
      yield _updateStatusAndHandleWaiting(user, stage, newBuild, build.build_id, options.flowOwner)
      if (newBuild.status === STATUS_SUCCESS) {
        if (build.flow_build_id && 1 !== build.build_alone) {
          _handleNextStageBuild(user, stage, build, options.flowOwner)
        }
        notification.sendEmailUsingFlowConfig(user.namespace, stage.flow_id, {
          type: 'ci',
          result: 'success',
          // subject: '"' + project.project_name  + '" 构建成功',
          subject: `'${stage.stage_name}'构建成功`,
          body: `构建流程${stage.stage_name}成功完成一次构建`
        })
      } else {
        errMsg = errMsg ? errMsg : '构建发生未知错误'
        notification.sendEmailUsingFlowConfig(user.namespace, stage.flow_id, {
          type: 'ci',
          result: 'failed',
          // subject: project.project_name + ' 构建失败',
          subject: `'${stage.stage_name}'构建失败`,
          body: (timeout ? '启动构建容器超时' : errMsg) + `<br/>请点击<a href="${FLOW_URL}?${stage.flow_id}">此处</a>查看TenxFlow详情。`
        })
      }
    } catch (err) {
      logger.error(method, 'exception of build: ', err.stack)
      newBuild.status = STATUS_FAILED
      newBuild.end_time = utils.DateNow()
      yield imageBuilder.stopJob(job.metadata.namespace, job.metadata.name)
      errMsg = errMsg ? errMsg : '构建发生未知错误'
      yield _updateStatusAndHandleWaiting(user, stage, newBuild, build.build_id, options.flowOwner)
      if (build.flow_build_id) {
        jobWatcherService.notifyFlowStatus(stage.flow_id, build.flow_build_id, newBuild.status)
        yield FlowBuild.updateById(newBuild, build.flow_build_id)
      }
      notification.sendEmailUsingFlowConfig(user.namespace, stage.flow_id, {
        type: 'ci',
        result: 'failed',
        // subject: project.project_name + ' 构建失败',
        subject: `'${stage.stage_name}'构建失败`,
        body: errMsg + `<br/>请点击<a href="${FLOW_URL}?${stage.flow_id}">此处</a>查看TenxFlow详情。`
      })
    }
  })
}

// update build status with 'currentBuild' and start next build of same stage
function* _updateStatusAndHandleWaiting(user, stage, currentBuild, currentbuildId, flowOwner) {
  const method = '_updateStatusAndHandleWaiting'
  return StageBuild.findAllByIdWithStatus(stage.stage_id, STATUS_WAITING).then(function (builds) {
    if (0 === builds.length) {
      //如没有等待的构建，则更新当前构建状态
      return StageBuild.updateById(currentBuild, currentbuildId)
    }
    //先将下一次构建的状态更新为“执行中”，再更新当前构建的状态
    return StageBuild.updateById({status:STATUS_BUILDING}, builds[0].build_id).then(function () {
      return StageBuild.updateById(currentBuild, currentbuildId).then(function () {
        co(function* () {
          yield* _startStageBuild(user, stage, builds[0], flowOwner)
        }).catch(function (err) {
          logger.error(method, err.stack)
        })
      })
    })
  })
}

// start build of next stage if exists
function _handleNextStageBuild(user, stage, stageBuild, flowOwner) {
  const method = '_handleNextStageBuild'
  let flowBuildId = stageBuild.flow_build_id
  Stage.findNextOfFlow(stage.flow_id, stage.seq).then(function (nextStage) {
    if (nextStage) {
      //存在下一步时
      co(function* () {
        // 继承上一个 stage 的 options，例如构建时指定 branch
        nextStage.options = stage.options
        let flowBuild
        try {
          flowBuild = yield FlowBuild.findOneById(flowBuildId)
        } catch (err) {
          // 查询出错时，触发下一步构建
          logger.error(method, `Failed to find flow build ${flowBuildId}`)
          yield _startNextStageBuild(user, nextStage, flowBuildId, stageBuild.node_name, flowOwner)
          return
        }
        if (!flowBuild) {
          //flow构建不存在
          return
        }
        if (flowBuild.status < STATUS_BUILDING) {
          // flow构建已经被stop，此时不再触发下一步构建
          logger.warn(method, `Flow build is finished, build of next stage ${stage.stage_id} will not start`)
          return
        }
        yield _startNextStageBuild(user, nextStage, flowBuildId, stageBuild.node_name, flowOwner)
      })
    } else {
      // logger.info('set end_time of flow build if success:', utils.DateNow())
      //不存在下一步时，更新flow构建状态为成功
      jobWatcherService.notifyFlowStatus(stage.flow_id, flowBuildId, STATUS_SUCCESS)
      FlowBuild.updateById({
        end_time: utils.DateNow(),
        status: STATUS_SUCCESS
      }, flowBuildId)
    }
  })
}

function* _startNextStageBuild(user, nextStage, flowBuildId, nodeName, flowOwner) {
  let stageBuildId = idGenerator.newStageBuildID()
  let stageBuildRec = {
    build_id: stageBuildId,
    flow_build_id: flowBuildId,
    stage_id: nextStage.stage_id,
    stage_name: nextStage.stage_name,
    status: STATUS_WAITING,
    namespace: user.namespace,
    branch_name: nextStage.default_branch || ''
  }
  const options = nextStage.options
  if (options) {
    if (options.branch) {
      stageBuildRec.branch_name = options.branch
    }
  }
  if (nodeName) {
    stageBuildRec.node_name = nodeName
  }
  let buildRecs = yield StageBuild.findAllByIdWithStatus(nextStage.stage_id, STATUS_BUILDING)
  if (0 === buildRecs.length) {
    //没有执行中的构建记录，则添加“执行中”状态的构建记录
    stageBuildRec.status = STATUS_BUILDING
  }
  //添加stage构建记录
  yield StageBuild.insertOne(stageBuildRec)
  if (STATUS_BUILDING === stageBuildRec.status) {
    yield* _startStageBuild(user, nextStage, stageBuildRec, flowOwner)
  }
}