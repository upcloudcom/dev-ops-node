/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-23
 * @author Zhangpc
 *
 */

/**
 * Service for build docker image
 */
'use strict'

const fs = require('fs')
const https = require('https')
const _ = require('lodash')
const co = require('co')
const mkdirsSync = require('fs-extra').mkdirsSync
const repoService = require('./repo')
const BuildModel = require('../models').Build
const ProjectModel = require('../models').Project
const userApps = require('../configs/user_apps')
const utils = require('../utils')
const security = require('../utils/security')
const BuilderAgent = require('../ci/builder')
const ImageBuilder = require('../ci/imagemgr/image_builder')
const ImageBuilderV2 = require('../ci/imagemgr/image_builder_v2')
const logger = require('../utils/logger').getLogger('service/build_docker_image')
const TransferFile = require('../utils/transfer_file')
const config = require('../configs')
const DockerRegistryAPIs = require('../docker/registry')
const LogFormat = require('../ci/imagemgr/log_format')
const logFormatter = new LogFormat()
const buildAgentService = require('./build_agent')
const notification = require('./notification')
const linkVolumeMgr = require('../ci/imagemgr/link_volume_management')
const projectLinkService = require('./project_link')
const buildService = require('./build')
const ciRuleService = require('./ci_rule')

const APP_UPLOAD_ROOT_DIR = userApps.appFolder
const BUILD_ENV_FILE_DIR = '___env___dir___'
const BUILD_ENV_FILE = '___env___file___'
const TCE_TAG = '3'

/*let builderConfig = {
  name: 'builder2',
  type: 'external',
  config: {
    protocol: 'https',
    // host : 'internal-builder.tenxapp.com',
    host : 'internal-builder.tenxapp.com',
    user: 'ubuntu',
    password: 'Dream008',
    port: 2376,
    ca: fs.readFileSync(require.resolve('../sslkey/imagebuilder/builder3/client/ca.pem')),
    cert: fs.readFileSync(require.resolve('../sslkey/imagebuilder/builder3/client/cert.pem')),
    key: fs.readFileSync(require.resolve('../sslkey/imagebuilder/builder3/client/key.pem'))
  },
  agent: {
    protocol: 'http',
    user: 'tenx_build_user',
    password: 'asojk3knasdo23nkerneroksddntrh==3anaasd',
    agentPort: '80'
  }
  // containerId: 'test-test-test'
}*/

exports.buildDockerImageV2 = function* (user, project, projectProps, build) {
  const method = 'buildDockerImageV2'
  const resData = {
    status: 200
  }
  let newBuild = {}
  try {
    const depot = repoService.repoTypeToDepot(project.repo_type)
    const imageName = project.image_name.split('/')[1]
    project.appFolder = APP_UPLOAD_ROOT_DIR + user.namespace + '/' + depot + '/' + imageName
    const buildInfo = {
      repoUrl: project.clone_url,
      imageName: `${project.image_name}:${build.image_tag}`,
      dockerfileLocation: build.dockerfile_location,
      isCodeRepo: 1,
      branch: build.branch_name,
      publicKey: '',
      privateKey: '',
      git_repo_url: '',
      repoType: project.repo_type,
      //2.0新增
      scmImage: `${global.REGISTRY_CONFIG.host}/${config.repo_info.scm_image}`,
      clone_location: config.repo_info.clone_location,
      // TODO: get command from user input
      build_command: ["/home/app/exec-job.sh"],
      namespace: user.userNamespace || project.owner,
      //TODO: get flow name from db
      flowName: project.project_name,
      projectName: project.project_name
    }

    // For svn user
    if (depot === 'svn' && project.is_repo_private === 'true') {
      const svnUserInfo = yield* repoService.getRepoAuthInfo(user, depot)
      if (svnUserInfo.status !== 200) {
        logger.warn(method, 'get svn user failed -> ' + svnUserInfo.username)
      } else {
        logger.info(method, 'get svn user successfully -> ' + svnUserInfo.username)
        buildInfo.svn_username = svnUserInfo.results.username
        buildInfo.svn_password = svnUserInfo.results.token
      }
    }

    if ((project.repo_type === '6' && project.is_repo_private === 'true') || project.clone_url.indexOf('@') > -1) {
      buildInfo.git_repo_url = project.clone_url.substr(project.clone_url.indexOf('@')).match(/[A-Za-z0-9-_.]+/)[0]
    }
    // Get builder
    const builderConfig = yield buildAgentService.getFitBuilder(project.use_cache, project.project_id)
    buildInfo.project_container_id = builderConfig.containerId
    logger.info(method, `assign ${project.project_name} to ${builderConfig.name}`)

    // Update build image
    buildInfo.build_image = project.build_image
    if (project.is_repo_private === 'true') {
      buildInfo.privateKey = '"' + security.decryptContent(projectProps.private_key) + '"'
      buildInfo.publicKey = '"' + projectProps.public_key + '"'
    }
    // Get the volume mapping info
    const volumeMapping = yield linkVolumeMgr.getVolumeMapping(project.project_id)
    const imageBuilder = new ImageBuilderV2(builderConfig)
    //TODO: build with volumeMapping
    const job = yield imageBuilder.buildImage(buildInfo, [])
    newBuild.start_time = utils.DateNow()
    if (job.message && job.message.kind == 'Status') {
      logger.error(method, ': failed to create job with code: ', job.statusCode,
        'and message: ', job.message)
      newBuild.status = '1'
      resData.status = 500
      resData.message = 'failed to create job'
    } else {
      newBuild.container_id = job.metadata.name
      newBuild.status = '2'
      newBuild.builder_addr = builderConfig.name
      _waitForBuildToCompleteV2(job.metadata.name, imageBuilder, user, project, projectProps, build)
      buildAgentService.increaseBuilderWorkload(builderConfig.name)
    }
  } catch (err) {
    logger.error(method, JSON.stringify(err.stack))
    newBuild.status = '1'
    // logger.error(method, JSON.stringify(err))
    newBuild.end_time = utils.DateNow()
    resData.status = 500
    resData.message = err
  }
  const updateBuildResult = yield BuildModel.updateBuildById(project.project_id, build.build_id, newBuild)
  if (updateBuildResult[0] < 1) {
    resData.results = 'build not update'
    return resData
  }
  resData.results = build
  if (project.repo_type === TCE_TAG) {
    // handle tce
    logger.warn(method, 'tce is @todo')
    return resData
  }
  return resData
}

/*
Used by v1 build engine, and force to pull the base image
For v2, kubelet will handle it
*/
exports.pullDockerImage = function* (user, project, projectProps, build) {
  const method = 'pullDockerImage'
  const builderConfig = yield buildAgentService.getFitBuilder(project.use_cache, project.project_id)
  const imageBuilder = new ImageBuilder(builderConfig)
  let newBuild = {}
  let resData = {}
  logger.info(method, `start in ${builderConfig.name}`)
  try {
    const stream = yield imageBuilder.pullImage(project.build_image)
    newBuild.start_time = utils.DateNow()
    newBuild.status = '2'
    newBuild.pull_image_status = 2
    resData.status = 200
    _waitForPullImageToComplete(user, project, projectProps, build, stream)
  } catch(err) {
    logger.error(method, err.stack)
    newBuild.status = '1'
    newBuild.end_time = utils.DateNow()
    newBuild.pull_image_status = 1
    newBuild.build_log = `Pull image ${project.build_image || config.default_image_builder} failed.`
    resData.status = 500
    resData.message = err
  }
  const updateBuildResult = yield BuildModel.updateBuildById(project.project_id, build.build_id, newBuild)
  if (updateBuildResult[0] < 1) {
    resData.results = 'build not update'
    return resData
  }
  resData.results = build
  return resData
}

/*
Used by v1
*/
function* buildDockerImage(user, project, projectProps, build) {
  const method = 'buildDockerImage'
  const resData = {
    status: 200
  }
  let newBuild = {}
  try {
    const depot = repoService.repoTypeToDepot(project.repo_type)
    const imageName = project.image_name.split('/')[1]
    project.appFolder = APP_UPLOAD_ROOT_DIR + user.namespace + '/' + depot + '/' + imageName
    project.envFile = APP_UPLOAD_ROOT_DIR + user.namespace + '/' + depot + '/' + BUILD_ENV_FILE_DIR + '/' + imageName + '/' + BUILD_ENV_FILE
    const buildInfo = {
      repoUrl: project.clone_url,
      imageName: `${project.image_name}:${build.image_tag}`,
      dockerfileLocation: build.dockerfile_location,
      isCodeRepo: 1,
      envVolume: project.envFile + ':/root/' + BUILD_ENV_FILE + ':ro',
      appVolume: project.appFolder + ':/app',
      branch: build.branch_name,
      publicKey: '',
      privateKey: '',
      git_repo_url: '',
      clearCache: build.clearCache,
      isNeedPrivilege: project.is_need_privilege || 'off',
      repoType: project.repo_type
    }

    // For svn user
    if (depot === 'svn' && project.is_repo_private === 'true') {
      const svnUserInfo = yield* repoService.getRepoAuthInfo(user, depot)
      if (svnUserInfo.status !== 200) {
        logger.warn(method, 'get svn user failed -> ' + svnUserInfo.username)
      } else {
        logger.info(method, 'get svn user successfully -> ' + svnUserInfo.username)
        buildInfo.svn_username = svnUserInfo.results.username
        buildInfo.svn_password = svnUserInfo.results.token
      }
    }

    if ((project.repo_type === '6' && project.is_repo_private === 'true') || project.clone_url.indexOf('@') > -1) {
      buildInfo.git_repo_url = project.clone_url.substr(project.clone_url.indexOf('@')).match(/[A-Za-z0-9-_.]+/)[0]
    }
    // Get builder
    const builderConfig = yield buildAgentService.getFitBuilder(project.use_cache, project.project_id)
    buildInfo.project_container_id = builderConfig.containerId
    logger.info(method, `assign ${project.project_name} to ${builderConfig.name}`)
    // Prepare builder
    const builderAgent = new BuilderAgent(builderConfig)
    const envInfo = {
      imageName: buildInfo.imageName,
      dockerfilePath: buildInfo.dockerfileLocation,
      useCache: (project.use_cache === 'off' ? 'off' : 'on'),
      pushOnComplete: project.push_on_complete,
      envFilePath: project.envFile,
      publicKey: '',
      privateKey: ''
    }
    // Update build image
    buildInfo.build_image = project.build_image
    if (build.branch_name && build.branch_name.trim() != '' && build.branch_name != 'master') {
      envInfo.gitTag = build.branch_name
    }
    if (project.is_repo_private === 'true') {
      envInfo.privateKey = '"' + security.decryptContent(projectProps.private_key) + '"'
      envInfo.publicKey = '"' + projectProps.public_key + '"'
    }
    // Get the volume mapping info
    const volumeMapping = yield linkVolumeMgr.getVolumeMapping(project.project_id)
    const prepareBuild = yield builderAgent.prepareBuilderUseCache(buildInfo.project_container_id, envInfo)
    logger.info(method, prepareBuild.data.toString())
    if (prepareBuild.status >= 300) {
      logger.error(method, prepareBuild.data)
      resData.status = prepareBuild.status
      resData.message = prepareBuild.data.toString()
      throw resData
    }
    const imageBuilder = new ImageBuilder(builderConfig)
    const container = yield imageBuilder.buildImage(buildInfo, volumeMapping)
    newBuild.container_id = container.id
    newBuild.status = '2'
    newBuild.start_time = utils.DateNow()
    newBuild.builder_addr = builderConfig.name
    imageBuilder.builder.containerId = container.id
    _waitForBuildToComplete(container.id, imageBuilder, user, project, projectProps, build)
    buildAgentService.increaseBuilderWorkload(builderConfig.name)
  } catch (err) {
    logger.error(method, JSON.stringify(err.stack))
    newBuild.status = '1'
    // logger.error(method, JSON.stringify(err))
    newBuild.end_time = utils.DateNow()
    resData.status = err.status || 500
    resData.message = err.message || err
  }
  const updateBuildResult = yield BuildModel.updateBuildById(project.project_id, build.build_id, newBuild)
  if (updateBuildResult[0] < 1) {
    resData.results = 'build not update'
    return resData
  }
  resData.results = build
  if (project.repo_type === TCE_TAG) {
    // handle tce
    logger.warn(method, 'tce is @todo')
    return resData
  }
  return resData
}
exports.buildDockerImage = buildDockerImage

function _waitForBuildToCompleteV2(jobName, imageBuilder, user, project, projectProps, build) {
  const registryConfig = global.REGISTRY_CONFIG
  const method = '_waitForBuildToCompleteV2'
  const registryAPI = new DockerRegistryAPIs(registryConfig)
  const builderConfig = imageBuilder.builder
  co(function* () {
    const status = yield imageBuilder.waitForJob(project.owner, jobName)
    logger.info(method, "Build result: " + JSON.stringify(status))
    let statusCode
    if (status.succeeded > 0) {
      //执行成功
      statusCode = 0
    } else {
      //执行失败
      statusCode = 1
    }
    /*if (config.production) {
      // Tranfer files: readme, Dockerfile
      let localFile = `${project.appFolder}${project.dockerfile_location}`
      if (localFile.substr('-1') !== '/') {
        localFile += '/'
      }
      let remoteFile = `"${localFile}Dockerfile ${project.appFolder}/README.md"`
      mkdirsSync(project.appFolder)
      if (build.dockerfile_location != '') {
        mkdirsSync(localFile)
      }
      const transferFileResult = TransferFile.transferFile(localFile, remoteFile, builderConfig.config.host, builderConfig.config.user, builderConfig.config.password, 0)
      if (transferFileResult.success) {
        _getReadmeAndDockerfile(project, user, statusCode)
      } else {
        logger.error(method, 'transfer file failed.')
      }
    }*/
    logger.info(method, 'Wait ended normally...')
    buildAgentService.decreaseBuilderWorkflow(builderConfig.name)
    let buildLogs
    buildLogs = yield getJobLogs(project.owner, jobName)
    if (0 !== statusCode) {
      //执行失败时，删除job
      //因为存在job不断创建pod的情况，因此此处删除job
      yield imageBuilder.delJob(project.owner, jobName, true)
    }
    buildLogs = logFormatter.formatLog(buildLogs, true)
    const newBuild = {
      end_time: utils.DateNow(),
      build_log: buildLogs,
      status: (statusCode === 0) ? 0 : 1
    }
    const updateBuildResult = yield BuildModel.updateBuildById(project.project_id, build.build_id, newBuild)
    if (updateBuildResult[0] < 1) {
      yield BuildModel.updateBuildById(project.project_id, build.build_id, newBuild)
      logger.error(method, `update build failed, buildId: ${build.build_id}`)
    } else {
      logger.info(method, `update build successfully, buildId: ${build.build_id}`)
    }
    if (statusCode === 0) {
      const imageObj = {
        name: project.image_name,
        contributor: user.name.toLowerCase(),
        creationTime: new Date()
      }
    }
    _handleNextWaitingBuild(user, project, projectProps)
    if (newBuild.status === 0) {
      co(function* () {
        let projectLink = yield projectLinkService.getProjectLinkByProjectId(project.project_id)
        if (projectLink && projectLink.target_project_id) {
          if(projectLink.enabled == '0') return
          let isTargetProjectEnabled = yield projectLinkService.getProjectLinkByProjectId(projectLink.target_project_id)
          if(isTargetProjectEnabled && isTargetProjectEnabled.enabled =='1') {
            let linkProject = yield ProjectModel.findById(projectLink.target_project_id)
            let result = yield buildService.startOnebuild(user, linkProject.project_name, linkProject)
          }
        }
      })
      notification.sendEmailUsingFlowConfig(project.namespace, project.project_id, {
        type: 'ci',
        result: 'success',
        // subject: '"' + project.project_name  + '" 构建成功',
        subject: `"${project.project_name} builds success."`,
        body: `${project.project_name} was built successfully`
      })
    } else {
      notification.sendEmailUsingFlowConfig(project.namespace, project.project_id, {
        type: 'ci',
        result: 'failed',
        // subject: project.project_name + ' 构建失败',
        subject: `"${project.project_name} builds failed."`,
        body: project.project_name + ' failed to build and return code ' + newBuild.status
      })
    }
  })
}

function _waitForPullImageToComplete(user, project, projectProps, build, stream) {
  const method = '_waitForPullImageToComplete'
  let pullImageStatus
  let newBuild = {}
  stream.on('readable', () => {
    let event = stream.read()
    if (event) {
      event = event.toString()
      // filter \n \t ...
      if (!event.replace(/\s/g)) {
        return
      }
      event = utils.parse(event)
      if (event.error || event.errorDetail) {
        newBuild.pull_image_status = 1
        newBuild.build_log = `Pulling builder image ...\n${event.error}`
        newBuild.status = '1'
        newBuild.end_time = utils.DateNow()
      }
    }
  })

  stream.on('error', (e) => {
    newBuild.pull_image_status = 1
    newBuild.build_log = `Pull image ${project.build_image || config.default_image_builder} failed: stream crashed.`
    newBuild.status = '1'
    newBuild.end_time = utils.DateNow()
  })

  stream.on('end', function(e) {
    if (typeof newBuild.pull_image_status === "undefined") {
      newBuild.pull_image_status = 0
      co(function *(){
        yield* buildDockerImage(user, project, projectProps, build)
      })
    }
    BuildModel.updateBuildById(project.project_id, build.build_id, newBuild).then(function (updateBuildResult) {
      logger.info(method, updateBuildResult)
    })
  })
}

function _waitForBuildToComplete(containerId, imageBuilder, user, project, projectProps, build) {
  const registryConfig = global.REGISTRY_CONFIG
  const registryAPI = new DockerRegistryAPIs(registryConfig)
  const method = '_waitForBuildToComplete'
  const builderConfig = imageBuilder.builder
  const options = {
    protocol: `${builderConfig.config.protocol}:`,
    hostname: builderConfig.config.host,
    port: builderConfig.config.port,
    path: `/containers/${builderConfig.containerId}/wait`,
    ca: builderConfig.config.ca,
    cert: builderConfig.config.cert,
    key: builderConfig.config.key,
    method: 'POST',
    agent: false
  }
  const waitingServer = https.request(options, function () {})
  let statusCode
  waitingServer.setSocketKeepAlive(true, 10000)
  waitingServer.on('response', (res) => {
    logger.info(method, 'responsed')
    res.on('data', (data) => {
      data = utils.parse(data)
      statusCode = data.StatusCode
      /*if (config.production) {
        // Tranfer files: readme, Dockerfile
        let localFile = `${project.appFolder}${project.dockerfile_location}`
        if (localFile.substr('-1') !== '/') {
          localFile += '/'
        }
        let remoteFile = `"${localFile}Dockerfile ${project.appFolder}/README.md"`
        mkdirsSync(project.appFolder)
        if (build.dockerfile_location != '') {
          mkdirsSync(localFile)
        }
        const transferFileResult = TransferFile.transferFile(localFile, remoteFile, builderConfig.config.host, builderConfig.config.user, builderConfig.config.password, 0)
        if (transferFileResult.success) {
          _getReadmeAndDockerfile(project, user, statusCode)
        } else {
          logger.error(method, 'transfer file failed.')
        }
      }*/
      logger.info(method, "Build result: " + JSON.stringify(data))
    })
    res.on('end', () => {
      co(function *(){
        logger.info(method, 'Wait ended normally...')
        buildAgentService.decreaseBuilderWorkflow(builderConfig.name)
        if (!statusCode) {
          const container = yield imageBuilder.dockerUtil.getContainer(containerId)
          if (!container || !container[1]) {
            statusCode = 404
          } else {
            statusCode = container[1].State.ExitCode
          }
        }
        let buildLogs = yield getContainerLogs(builderConfig)
        buildLogs = logFormatter.formatLog(buildLogs, true)
        const newBuild = {
          end_time: utils.DateNow(),
          build_log: buildLogs,
          status: (statusCode === 0) ? 0 : 1
        }
        const updateBuildResult = yield BuildModel.updateBuildById(project.project_id, build.build_id, newBuild)
        if (updateBuildResult[0] < 1) {
          yield BuildModel.updateBuildById(project.project_id, build.build_id, newBuild)
          logger.error(method, `update build failed, buildId: ${build.build_id}`)
        } else {
          logger.info(method, `update build successfully, buildId: ${build.build_id}`)
        }
        _handleNextWaitingBuild(user, project, projectProps)
        if (newBuild.status === 0) {
          co(function* () {
            let projectLink = yield projectLinkService.getProjectLinkByProjectId(project.project_id)
            if (projectLink && projectLink.target_project_id) {
              if(projectLink.enabled == '0') return
              let isTargetProjectEnabled = yield projectLinkService.getProjectLinkByProjectId(projectLink.target_project_id)
              if(isTargetProjectEnabled && isTargetProjectEnabled.enabled =='1') {
                let linkProject = yield ProjectModel.findById(projectLink.target_project_id)
                // Check if any "Trigger by other build" rule defined
                const expectedType = "Kickoff"
                let rules = yield ciRuleService.findAllByCondition({
                  projectId: projectLink.target_project_id,
                  type: expectedType,
                  is_delete: '0'
                })
                let formatedRules = { clearCache: build.clearCache }
                // Use the first rule as the match one
                if (rules && rules.length > 0) {
                  formatedRules = buildService.formatCiRule(rules, {'type': expectedType, "tag": linkProject.default_branch})[0]
                  formatedRules.clearCache = build.clearCache
                }
               let result = yield buildService.startOnebuild(user, linkProject.project_name, linkProject, null, formatedRules)
              }
            }
          })
          notification.sendEmailByProjectId(project.project_id, {
            type: 'ci',
            result: 'success',
            // subject: '"' + project.project_name  + '" 构建成功',
            subject: `"${project.project_name} builds success."`,
            body: `${project.project_name} was built successfully`
          })
        } else {
          notification.sendEmailByProjectId(project.project_id, {
            type: 'ci',
            result: 'failed',
            // subject: project.project_name + ' 构建失败',
            subject: `"${project.project_name} builds failed."`,
            body: project.project_name + ' failed to build and return code ' + newBuild.status
          })
        }
      }).catch(function (err) {
        logger.error(method, err.stack)
      })
    })
  })
  waitingServer.on('error', (err) => {
    err = utils.parse(err)
    logger.info(method, `Build <${build.build_id}> timeout? ${err.code}`)
    if (err.code === 'ECONNRESET') {
      logger.info(method, 'Timeout occurs')
      _waitForBuildToComplete(containerId, imageBuilder, user, project, build)
    }
  })
  waitingServer.end()
}

function getJobLogs(namespace, jobName, socket) {
  const imageBuilder = new ImageBuilderV2()
  return imageBuilder.getJobLogs(namespace, jobName, socket)
}
exports.getJobLogs = getJobLogs

exports.getJobState = function (namespace, jobName) {
  const method = 'getJobState'
  const imageBuilder = new ImageBuilderV2()
  return imageBuilder.waitForJob(namespace, jobName).then(function (status) {
    if (status.succeeded > 0) {
      return 'success'
    } else {
      return 'failed'
    }
  })
}

function getContainerLogs(builderConfig, socket) {
  const method = '_getContainerLogs'
  let follow = (socket ? 1 : 0)
  let completeLogs = ''
  const options = {
    protocol: `${builderConfig.config.protocol}:`,
    hostname: builderConfig.config.host,
    port: builderConfig.config.port,
    path: `/containers/${builderConfig.containerId}/logs?stdout=1&stderr=1&follow=${follow}&timestamps=1`,
    ca: builderConfig.config.ca,
    cert: builderConfig.config.cert,
    key: builderConfig.config.key,
    agent: false
  }
  return new Promise(function (resolve, reject) {
    const request = https.get(options, function (res) {
      res.on('data', function  (chunk) {
        if (socket) {
          socket.emit('ciLogs', logFormatter.formatLog(chunk, true))
        }
        completeLogs += chunk
      })
    })
    request.setSocketKeepAlive(true, 10000)
    request.on('error', function(e) {
      logger.error(method, 'Failed to get the log.')
      reject('Failed to get the log.')
    })
    request.on('close', function (e) {
      logger.info(method, 'Get log successfully.')
      if (socket) {
        return resolve(true)
      }
      return resolve(completeLogs)
    })
    request.end()
  })
}
exports.getContainerLogs = getContainerLogs

exports.getContainerState = function (builderConfig) {
  if (!builderConfig) {
    return
  }
  const imageBuilder = new ImageBuilder(builderConfig)
  return imageBuilder.dockerUtil.getContainer(builderConfig.containerId).then(function (container) {
    if (!container || !container[1]) {
      return 'failed'
    } else if (typeof container[1].State.ExitCode === undefined) {
      return 'building'
    } else if (container[1].State.ExitCode === 0) {
      if (container[1].State.Status === 'running') {
        return 'building'
      } else if (container[1].State.Status === 'exited') {
        return 'success'
      } else {
        return '-'
      }
    } else {
      return 'failed'
    }
  }).catch(function (err) {
    if (err && err.statusCode === 404) {
      return 'failed'
    }
    throw err
  })
}

exports.stopOnebuildV2 = function (namespace, jobName) {
  const method = 'stopOnebuildV2'
  const imageBuilder = new ImageBuilderV2()
  return imageBuilder.delJob(namespace, jobName).then(function (job) {
    if (job.message && "Status" === job.message.kind) {
      if (404 === job.message.code) {
        return 'success'
      }
      throw {statusCode: 500}
    }
    return 'success'
  })
}

exports.stopOnebuild = function (builderConfig) {
  const method = 'stopOnebuild'
  const imageBuilder = new ImageBuilder(builderConfig)
  return imageBuilder.dockerUtil.stopContainer(builderConfig.containerId).then(function (data) {
    logger.info(method, `Stop return code: - ${data}`)
    return 'success'
  }).catch(function (err) {
    if (err && (err.statusCode === 404 || err.statusCode === 304)) {
      return 'success'
    }
    throw err
  })
}

function _handleNextWaitingBuild(user, project, projectProps) {
  const method = '_handleNextWaitingBuild'
  BuildModel.getProjectBuildsBySatus(project.project_id, ['3']).then(function(builds) {
    if (!builds || builds.length < 1) {
      logger.info(method, `project <${project.project_id}> has no waiting build.`)
      return
    }
    logger.info(method, `project <${project.project_id}> has ${builds.length} waiting build.`)
    co(function *(){
      yield* buildDockerImage(user, project, projectProps, builds[0])
    }).catch(function (err) {
      logger.error(method, err.stack)
    })
  })
}

function _getReadmeAndDockerfile(project, user, statusCode) {
  const method = '_getReadmeAndDockerfile'
  const registryConfig = global.REGISTRY_CONFIG
  const registryAPI = new DockerRegistryAPIs(registryConfig)
  if (project.dockerfile_location.lastIndexOf('/') != project.dockerfile_location.length - 1) {
    project.dockerfile_location = project.dockerfile_location + '/'
  }
  const readmePath = project.appFolder + project.dockerfile_location + 'README.md'
  const DockerfilePath = project.appFolder + project.dockerfile_location + 'Dockerfile'
  let readme
  fs.exists(readmePath, function (exists) {
    if (!exists) {
      logger.warn(method, `${readmePath} not found.`)
    } else {
      fs.readFile(readmePath, function (err, data) {
        if (err) {
          logger.error(method, err);
          return
        }
        readme = data.toString()
        const newProject = {
          detail: readme
        }
        ProjectModel.updateProjectById(user.namespace, project.project_id, newProject).then(function (result) {
          logger.info(method, `${project.project_id} detail updated successfully`)
        })
      })
    }
  })
  if (statusCode != 0 || project.push_on_complete !== 'on') {
    return
  }
  fs.exists(DockerfilePath, function (exists) {
    if (!exists) {
      logger.error(method, `${DockerfilePath} not found.`)
      return
    }
    fs.readFile(DockerfilePath, function (err, dtata) {
      if (err) {
        logger.error(method, err)
        return
      }
      registryAPI.getImageInfo(user.name, project.image_name).then(function (result) {
        const imageObj = {
          name: project.image_name,
          dockerfile: dtata.toString()
        }
        const imageInfo = result.data
        if (result.status >= 300) {
          logger.error(method, imageInfo)
        } else if (!imageInfo.detail || !imageInfo.detail.trim() === '') {
          imageObj.detail = readme
        }
        return registryAPI.updateImageInfo(user.name, project.image_name, imageObj)
      }).then(function (result) {
        if (result.status >= 300) {
          logger.error(method, result.data)
        } else{
          logger.info(method, result.data)
        }
      }).catch(function (err) {
        logger.error(method, err)
      })
    })
  })
}