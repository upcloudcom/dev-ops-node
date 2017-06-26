/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-22
 * @author Zhangpc
 *
 */

/**
 * Service for build
 */
'use strict'

const fs = require('fs')
const Build = require('../models').Build
const Project = require('../models').Project
const Repo = require('../models').Repo
const UserModel = require('../models').User

const projectPropsService = require('./project_props')
const projectService = require('./project')
const repoService = require('./repo')
const flowBuildService = require('./flow_build')
const uuid = require('node-uuid')
const _ = require('lodash')
const buildDockerImageService = require('./build_docker_image')
const logger = require('../utils/logger').getLogger('service/build')
const utils = require('../utils')
const buildAgentService = require('./build_agent')
const co = require('co')
const moment = require('moment')
const notification = require('./notification')
const config = require('../configs')
const Promise = require('bluebird') // For webpack build backend files


/**
 * get one project's all builds
 */
exports.getProjectBuilds = function* (user, projectName, pageNumber, pageSize) {
  pageNumber = parseInt(pageNumber)
  pageSize = parseInt(pageSize)
  if (isNaN(pageNumber) || pageNumber < 1) {
    pageNumber = DEFAULT_PAGE_NUMBER
  }
  if (isNaN(pageSize) || pageSize < 1) {
    pageSize = DEFAULT_PAGE_SIZE
  }
  let resData
  let start = (pageNumber - 1) * pageSize
  const promiseArray = []
  promiseArray.push(yield* projectService.getProject(user, projectName))
  promiseArray.push(yield Build.getProjectBuilds(projectName, user.namespace, start, pageSize))
  return Promise.all(promiseArray).then(function (results) {
    if (results[0].status >= 300) {
      return results[0]
    }
    const formatBuilds = []
    _(results[1]).forEach(function (build) {
      let formatBuild = self.formatBuild(build)
      if (formatBuild) {
        formatBuilds.push(formatBuild)
      }
    })
    resData = {
      status: results[0].status,
      project: results[0].results,
      builds: formatBuilds
    }
    resData.project.webhook_endpoint = `/api/v1/build/notification/${resData.project.id}`
    return resData
    /*if (results[0].results.depot !== 'gitlab') {
      return resData
    }
    return Repo.getGitlabRepo(user.id, repoService.depotToRepoType('gitlab'))*/
  })
  /*.then(function (repo) {
    if (repo && resData.project) {
      resData.project.gitlab_url = repo.gitlab_url
    }
    return resData
  })*/
}

/**
 * create builds by ci rules
 */
exports.invokeCIFlowOfStages = function* (userInfo, event, stageList, auditInfo, project) {
  const method = 'invokeCIFlowOfStages'
  const buildArray = []
  var resData = {}
  // Add the builds to a queue
  logger.info(method, 'Number of stages in the list ' + stageList.length)
  _(stageList).forEach(function (stage) {
    // Check if the CI config matched
    // Convert to object if it's string
    if (typeof stage.ci_config === 'string') {
      stage.ci_config = JSON.parse(stage.ci_config)
    }
    let eventType = event && event.type && event.type.toLowerCase()

    // Check if the rule matched
    let matched = false// Mark matched to true for svn repo
    if (project.repo_type === 'svn') {
      matched = true
    } else if (stage.ci_config) {
      logger.info(method, 'Event type: ' + eventType)
      if (stage.ci_config.mergeRequest && eventType == "merge_request") {
        matched = true
      } else if (stage.ci_config[eventType]) {
        let ciRule = stage.ci_config[eventType]
        logger.info(method, ciRule.name + ' vs ' + event.name)
        if (ciRule.matchWay !== 'RegExp') {
          if (ciRule.name === event.name) {
            matched = true
          }
        } else {
          let matchWayReg
          try {
            matchWayReg = new RegExp(ciRule.name)
            if (matchWayReg.test(event.name)) {
              matched = true
            }
          } catch (error) {
            logger.error(method, `解析正则表达式失败，请检查格式: ${ciRule.name}`)
            notification.sendEmailUsingFlowConfig(userInfo.namespace, stage.flow_id, {
              type: 'ci',
              result: 'failed',
              subject: `'${stage.stage_name}'构建失败`,
              body: `解析正则表达式失败，请检查格式: ${ciRule.name}`
            })
          }
        }
      }
    }
    if (matched) {
      auditInfo.skip = false
      logger.info(method, "---- Add to build queue ----")
      buildArray.push(function* () {
        let result = yield flowBuildService.startFlowBuild(userInfo, stage.flow_id, stage.stage_id, auditInfo, event)
        return result
      })
    }
  })

  let result = yield Promise.all(buildArray.map(function (item) {
    return co(item)
  })).then(function (results) {
    _(results).forEach(function (buildResult) {
      if (buildResult.status >= 300) {
        resData.status = buildResult.status
        return false
      }
      resData.status = 200
    })
    resData.message = results
    return resData
  }).catch(function (err) {
    logger.error(method, "Build failed: " + JSON.stringify(err))
    resData.status = err.status || 500
    resData.message = err
    return resData
  })
  result.status = 200
  result.message = "Build started successfully."
  return result
}

/**
 * v1 to use docker container to build
 * create one build
 */
exports.startOnebuild = function* (user, projectName, project, projectProps, rule) {
  const method = 'startOnebuild'
  const resData = {
    status: 200
  }
  if (!project) {
    project = yield Project.findProjectByName(user.namespace,projectName)
    if (!project) {
      resData.status = 404
      resData.message = `project ${projectName} not exist`
      return resData
    }
  }
  if (!rule) {
    rule = {}
  }
  try {
    const depot = repoService.repoTypeToDepot(project.repo_type)
    const imageName = project.image_name.split('/')[1]
    // get commit id
    let branches = yield repoService.getBranches(user, project)
    if (branches.status >= 300) {
      return branches
    }

    let build = {
      build_id: uuid.v4(),
      project_id: project.project_id,
      commit_sha: branches.results[0].commit_id,
      status: '2',
      branch_name: rule.branch || project.default_branch,
      image_tag: rule.tag || project.default_tag,
      is_webhook: rule.webhook || '0',
      dockerfile_location: rule.dockerfile_location || project.dockerfile_location,
    }

    // Update default tag of this project
    yield Project.updateProjectByName(user.namespace, projectName, {default_tag: build.image_tag})

    if (!build.branch_name || build.branch_name.trim() === '') {
      build.branch_name = 'master'
    }
    if (!build.image_tag || build.image_tag.trim() === '') {
      build.image_tag = 'latest'
    }
    if (!build.dockerfile_location || build.dockerfile_location.trim() === '') {
      build.dockerfile_location = '/'
    }
    // check if this project has building or waiting build
    const buildingWaitingCount = yield Build.getProjectBuildsCountBySatus(project.project_id, ['2', '3'])
    if (buildingWaitingCount > 0) {
      resData.message = 'Another build is running, change build to waiting status.'
      build.status = '3'
      build = yield Build.createOneBuild(build)
      resData.results = self.formatBuild(build)
      return resData
    }

    build = yield Build.createOneBuild(build)
    if (!projectProps) {
      projectProps = yield* projectPropsService.getOrAddProjectProps(user, depot, project.source_full_name)
    }
    build.clearCache = rule.clearCache
    let result = yield* buildDockerImageService.buildDockerImageV2(user, project, projectProps, build)
    // if (project.build_image === config.default_image_builder) {
      // result = yield* buildDockerImageService.buildDockerImage(user, project, projectProps, build)
    // } else {
      // result = yield* buildDockerImageService.pullDockerImage(user, project, projectProps, build)
    // }
    if (result.status >= 300) {
      notification.sendEmailByProjectId(project.project_id, {
        type: 'ci',
        result: 'failed',
        // subject: project.project_name  + ' 构建失败',
        subject: `"${project.project_name} builds failed."`,
        body: result
      })
    }
    return result
  } catch (err) {
    notification.sendEmailByProjectId(project.project_id, {
      type: 'ci',
      result: 'failed',
      // subject: project.project_name  + ' 构建失败',
      subject: `"${project.project_name} builds failed."`,
      body: err
    })
    throw err
  }
}

/**
 * Get build logs: not used for now
 */
exports.getBuildLogsV2 = function (projectId, buildId, socket) {
  const method = 'getBuildLogsV2'
  let namespace = ''
  let buildRec
  return Build.findBuildById(projectId, buildId).then(function (build) {
    if (!build) {
      socket.emit('ciLogs', `build ${buildId} not found.`)
      return
    }
    buildRec = build
    if (build.pull_image_status === 2) {
      logger.debug(method, `Pulling builder image ...`)
      return {pullingImage: true}
    }
    if (!build.container_id || !build.builder_addr) {
      socket.emit('ciLogs', `build ${buildId} logs not ready, retrying ...\n`)
      return {logsNotReady: true}
    }
    return Project.findProjectById(projectId).then(function (project) {
      //container_id实际保存了jobName
      namespace = project.owner
      return buildDockerImageService.getJobLogs(project.owner, build.container_id, socket)
    })
  }).then(function (logs) {
    if (logs.logsNotReady || logs.pullingImage) {
      return logs
    }
    logger.info(method, `build ${buildId} logs handled by socket ended.`)
    return buildDockerImageService.getJobState(namespace, buildRec.container_id)
  })
}

exports.getBuildLogs = function (projectId, buildId, socket) {
  const method = 'getBuildLogs'
  let builderConfig
  return Build.findBuildById(projectId, buildId).then(function (build) {
    if (!build) {
      socket.emit('ciLogs', `build ${buildId} not found.`)
      return
    }
    if (build.pull_image_status === 2) {
      logger.debug(method, `Pulling builder image ...`)
      return {pullingImage: true}
    }
    if (!build.container_id || !build.builder_addr) {
      socket.emit('ciLogs', `build ${buildId} logs not ready, retrying ...\n`)
      return {logsNotReady: true}
    }
    builderConfig = buildAgentService.getBuilderByName(build.builder_addr)
    builderConfig.containerId = build.container_id
    return buildDockerImageService.getContainerLogs(builderConfig, socket)
  }).then(function (logs) {
    if (logs.logsNotReady || logs.pullingImage) {
      return logs
    }
    logger.info(method, `build ${buildId} logs handled by socket ended.`)
    return buildDockerImageService.getContainerState(builderConfig)
  })
  /*.then(function (logs) {
    logger.info(method, `build ${buildId} logs handled by socket ended.`)
  })*/
}


exports.getBuildStatusV2 = function* (user, projectName, buildId) {
  let build = yield Build.getBuildStatus(projectName, user.id, buildId)
  const resData = {
    status: 200
  }
  if (!build || build.length < 1) {
    resData.status = 404
    resData.message = `build ${buildId} not found`
    return resData
  }
  build = build[0]
  resData.results = {
    build_id: buildId,
    builder: build.builder_addr
  }
  if (build.status !== '2') {
    resData.results.status = projectService.exchangeStatus(build.status)
    return resData
  }
  resData.results.status = yield buildDockerImageService.getJobState(user.namespace, build.container_id)
  return resData
}

exports.stopOnebuildV2 = function* (user, projectName, buildId) {
  let build = yield Build.getBuildStatus(projectName, user.namespace, buildId)
  const resData = {
    status: 200
  }
  if (!build || build.length < 1) {
    resData.status = 404
    resData.message = `build ${buildId} not found`
    return resData
  }
  build = build[0]
  resData.results = {
    build_id: buildId,
    builder: build.builder_addr
  }
  if (build.status == '0') {
    resData.message = 'build already success'
    return resData
  }
  if (build.status == '1') {
    resData.message = 'build already failed'
    return resData
  }
  if (build.status == '3') {
    let result = yield Build.deleteBuildById(build.project_id, buildId)
    resData.message = 'waiting build delete successfully'
    return resData
  }
  yield buildDockerImageService.stopOnebuildV2(user.namespace, build.container_id)
  const newBuild = {
    status: 1,
    exit_reason: 1
  }
  yield Build.updateBuildById(build.project_id, buildId, newBuild)
  resData.message = 'stop build successfully'
  return resData
}

/**
 * get container state
 */
exports.getBuildStatus = function* (user, projectName, buildId) {
  let build = yield Build.getBuildStatus(projectName, user.id, buildId)
  const resData = {
    status: 200
  }
  if (!build || build.length < 1) {
    resData.status = 404
    resData.message = `build ${buildId} not found`
    return resData
  }
  build = build[0]
  resData.results = {
    build_id: buildId,
    builder: build.builder_addr
  }
  if (build.status !== '2') {
    resData.results.status = projectService.exchangeStatus(build.status)
    return resData
  }
  const builderConfig = buildAgentService.getBuilderByName(build.builder_addr)
  builderConfig.containerId = build.container_id
  resData.results.status = yield buildDockerImageService.getContainerState(builderConfig)
  return resData
}

/**
 * stop build
 */
exports.stopOnebuild = function* (user, projectName, buildId) {
  let build = yield Build.getBuildStatus(projectName, user.namespace, buildId)
  const resData = {
    status: 200
  }
  if (!build || build.length < 1) {
    resData.status = 404
    resData.message = `build ${buildId} not found`
    return resData
  }
  build = build[0]
  resData.results = {
    build_id: buildId,
    builder: build.builder_addr
  }
  if (build.status == '0') {
    resData.message = 'build already success'
    return resData
  }
  if (build.status == '1') {
    resData.message = 'build already failed'
    return resData
  }
  if (build.status == '3') {
    let result = yield Build.deleteBuildById(build.project_id, buildId)
    resData.message = 'waiting build delete successfully'
    return resData
  }
  const builderConfig = buildAgentService.getBuilderByName(build.builder_addr)
  builderConfig.containerId = build.container_id
  yield buildDockerImageService.stopOnebuild(builderConfig)
  const newBuild = {
    status: 1,
    exit_reason: 1
  }
  yield Build.updateBuildById(build.project_id, buildId, newBuild)
  resData.message = 'stop build successfully'
  return resData
}

/**
 * get build log from db
 */
exports.getBuildLogsFromDB = function* (user, projectName, buildId) {
  let build = yield Build.getBuildLogs(projectName, user.namespace, buildId)
  const resData = {
    status: 200
  }
  if (!build || build.length < 1) {
    resData.status = 404
    resData.message = `build ${buildId} not found`
    return resData
  }
  build = build[0]
  resData.results = {
    build_id: buildId,
    builder: build.builder_addr,
    logs: (build.build_log ? build.build_log.toString() : '')
  }
  return resData
}

exports.formatBuild = function (build) {
  if (!build.build_id && !build.status) {
    return
  }
  return {
    id: build.build_id,
    builder: build.builder_addr,
    status: projectService.exchangeStatus(build.status),
    exit_reason: build.exit_reason,
    branch: build.branch_name,
    webhook: (build.is_webhook === '0' ? false : true),
    commit_id: build.commit_sha,
    default_tag: build.default_tag,
    image_tag: build.image_tag,
    clearCache: build.clearCache,
    start_time: utils.toUTCString(build.start_time),
    end_time: utils.toUTCString(build.end_time)
  }
}

exports.formatCiRule = function (ci_rule, projectRef) {
  let result = []
  _(ci_rule).forEach(function (item) {
    let temp = {
      dockerfile_location: item.dockerfileLocation,
      tag: item.tag,
      webhook: item.webhook
    }
    if (item.type === 'Branch') {
       temp.branch = item.name
    }
    if (item.tag === '1') {
      if (item.type === "Kickoff") {
        temp.tag = projectRef.tag
      } else {
        temp.tag = projectRef.substr(projectRef.lastIndexOf('/')+1)
      }
    } else if (item.tag === '2') {
      temp.tag = moment().format('YYYYMMDD.hhmmss.SS')
    }
    result.push(temp)
  })
  return result
}

exports._formateCIPushType = function (pushType) {
  switch (pushType){
    case 'heads':
      return 'Branch';
    case 'tags':
      return 'Tag';
    case 'release': // Release will be used as tag
    case 'create':
      return 'Tag';
    default:
      return pushType;
  }
}

function _chageImage (tag) {

}
