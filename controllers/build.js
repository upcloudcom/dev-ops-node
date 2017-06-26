/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-22
 * @author Zhangpc
 *
 */

/*
 * Controllers for build
 */
'use strict'

const buildService = require('../services/build')
const ciRuleService = require('../services/ci_rule')
const managedProjectService = require('../services/managed_project')
const stageService = require('../services/stage')
const configsSercvice = require('../services/configs')
const codeRepoApis = require('../ci/coderepo')
const logger = require('../utils/logger').getLogger('controllers/build')

exports.updateK8sConfigs = function* (next) {
  global.K8SCONFIGS = yield configsSercvice.getK8SConfigs()
  yield next
}

exports.showProjectBuilds = function* () {
  const projectName = this.params.project_name
  const page = this.query.page
  const size = this.query.size
  const result = yield buildService.getProjectBuilds(this.session.loginUser, projectName, page, size)
  this.status = result.status
  this.body = result
}

exports.startOnebuild = function* () {
  const projectName = this.params.project_name
  const rule = {}
  const tag = this.request.body.tag
  const clearCache = this.request.body.clearCache
  rule.tag = tag
  rule.clearCache = clearCache
  const result = yield buildService.startOnebuild(this.session.loginUser, projectName, null, null, rule)
  this.status = result.status
  this.body = result
}

exports.stopOnebuild = function* () {
  const projectName = this.params.project_name
  const buildId = this.params.build_id
  const result = yield* buildService.stopOnebuildV2(this.session.loginUser, projectName, buildId)
  this.status = result.status
  this.body = result
}

exports.getBuildStatus = function* () {
  const projectName = this.params.project_name
  const buildId = this.params.build_id
  const result = yield* buildService.getBuildStatusV2(this.session.loginUser, projectName, buildId)
  this.status = result.status
  this.body = result
}

exports.getBuildLogs = function* () {
  const projectName = this.params.project_name
  const buildId = this.params.build_id
  const result = yield* buildService.getBuildLogsFromDB(this.session.loginUser, projectName, buildId)
  this.status = result.status
  this.body = result
}

exports.invokeBuildsByWebhook = function* () {
  var method = "invokeBuildsByWebhook"
  let projectId = this.params.project_id

  if (!projectId) {
    this.status = 400
    this.body = {
      message: "No projectId in the webhook request."
    }
    return
  }
  let project = yield managedProjectService.findProjectById(projectId)
  if(!project) {
    logger.info(method, "This project does not exist.")
    this.status = 404
    // return this.body = { message:　'指定项目不存在' }
    this.body = {
      message: "This project does not exist."
    }
    return
  }
  this.session.auditInfo.skip = true
  // Check if any stage using this project has ci enabled
  let stageList = yield stageService.findCIEnabledStages(projectId)
  if (!stageList || stageList.length < 1) {
    logger.info(method, "No stage of CI flow is using this project or CI is disabled.")
    this.status = 200
    // return this.body = { message: "指定项目没有定义持续集成规则." }
    this.body = {
      message: "No stage of CI flow is using this project or CI is disabled."
    }
    return
  }

  // Use the user/space info of this project
  var userInfo = {
    user: project.owner,
    name: project.owner,
    // Use owner namespace to run the build
    namespace: project.namespace,
    // Used for query
    userNamespace: project.owner
  }
  let result = {
    status: 200,
    message: "Webhook handled normally"
  }
  if (project.repo_type == "gitlab" || project.repo_type == "github" || project.repo_type == "gogs" || project.repo_type == "svn") {
    let event = {}
    this.status = 500
    if (project.repo_type == "gitlab") {
      event = getGitlabEventInfo(this, project)
      if (this.status != 500) {
        // If 200, just return directly
        return
      }
    } else if (project.repo_type == "github" || project.repo_type == "gogs") {
      event = yield getEventInfo(this, project)
      if (this.status != 500) {
        // If 200, just return directly
        return
      }
    } else if (project.repo_type == "svn") {
      event = getSvnEventInfo(this, project)
      if (this.status != 200) {
        // If not 200, just return directly
        return
      }
    }
    if (project.repo_type !== 'svn' && event.scmProjectId != project.gitlab_project_id) {
      this.status = 404
      this.body = {
        message: "Project id does not match with exiting one"
      }
      logger.info(method, "Project id does not match with exiting one")
      return
    }
    logger.info(method, "Validate CI rule of each stage ...")
    result = yield buildService.invokeCIFlowOfStages(userInfo, event, stageList, this.session.auditInfo, project)
  } else {
    this.status = 400
    this.message = "Only gitlab/github/gogs/svn is supported by now"
    logger.error(method, "Only gitlab/github/gogs/svn is supported by now")
    return
  }

  this.status = result.status
  this.body = result.message
}

exports.createFlowBuild = function* () {
  let stageId
  if (this.request.body && this.request.body.stage) {
    stageId = this.request.body.stage
  }
  const result = yield buildService.startFlowBuild(this.session.loginUser, this.params.flow_id, stageId)
  this.status = result.status
  this.body = result
}

function getGitlabEventInfo (self, project) {
  let method = 'getGitlabEventInfo'
  //              push on branch               create a tag                         merge request
  let eventBody = self.request.body
  if (eventBody.object_kind != "push" && eventBody.object_kind != 'tag_push' && eventBody.object_kind != 'merge_request') {
    self.status = 200
    self.body = {
      message: "Skip non-push or merge-request event from gitlab"
    }
    logger.info(method, "Skip non-push or merge-request event from gitlab")
    return
  }
  let eventTypeHeader = self.request.headers['x-gitlab-event']
  logger.info(method, "event type in the header: " + eventTypeHeader)
  let projectId = eventBody.project_id
  var eventType
  var pushName
  var commitId
  // Get the project id of merge_request
  if (eventBody.object_kind == 'merge_request') {
    if (eventBody.object_attributes.action != 'merge') {
      self.status = 200
      self.body = {
        message: "Skip non-merge merge-request event from gitlab"
      }
      logger.info(method, "Skip non-merge merge-request event from gitlab")
      return
    }
    projectId = eventBody.object_attributes.source_project_id
    eventType = 'merge_request'
    pushName = eventBody.object_attributes.target_branch
  } else {
    // Push Hook
    // Tag Push Hook
    let ref = eventBody.ref.split('/')
    let pushType = ref[1]
    pushName = ref[2]
    if (eventBody.commits && eventBody.commits.length > 0) {
      commitId = eventBody.commits[eventBody.commits.length - 1].id
    }
    eventType = buildService._formateCIPushType(pushType)
  }
  if (eventType === 'Tag') {
    if (!eventBody.checkout_sha) {
      let message = 'Skip delete tag event from gitlab'
      self.status = 200
      self.body = {
        message
      }
      logger.warn(method, message)
      return
    }
  }
  return {
    scmProjectId: projectId,
    type: eventType,
    name: pushName
  }
}

function* getEventInfo (self, project) {
  let method = 'getEventInfo'
  //              push on branch               create/delete a tag                         merge request
  let eventBody = self.request.body
  let event = {}
  const repoApi = new codeRepoApis(project.repo_type)
  const checkSignatureResult = yield repoApi.checkSignature(self.headers, eventBody)
  if (!checkSignatureResult) {
    self.status = 401
    self.body = {
      message: 'Invalid signature in request header!'
    }
    return event
  }
  let eventTypeHeader = self.request.headers['x-github-event'] || self.request.headers['x-gogs-event']
  logger.info(method, "event type in the header: " + eventTypeHeader)
  // Gogs release will be 'release'/UI and 'create'/command
  if (eventTypeHeader != "push" && eventTypeHeader != 'pull_request' && eventTypeHeader != 'release' && eventTypeHeader != 'create') {
    self.status = 200
    self.body = {
      message: "Skip non-push or merge-request event from " + project.repo_type
    }
    logger.info(method, "Skip non-push or merge-request event from " + project.repo_type)
    return event
  }

  let projectId = eventBody.repository.id
  let pushType
  var pushName
  var commitId
  // Get the project id of merge_request
  if (eventTypeHeader == 'pull_request') {
    if (!eventBody.pull_request || !eventBody.pull_request.merged) {
      self.status = 200
      self.body = {
        message: "Skip non-merged pull-request event from " + project.repo_type
      }
      logger.info(method, "Skip non-merged pull-request event from " + project.repo_type)
      return
    }
    eventTypeHeader = 'merge_request'
    if (project.repo_type === 'gogs') {
      // gogs use head_branch in the event body
      pushName = eventBody.pull_request.base_branch
    } else {
      pushName = eventBody.pull_request.head.ref
    }
  }

  if (eventBody.ref) {
    let ref = eventBody.ref.split('/')
    if (ref.length === 3) {
      pushType = ref[1]
      pushName = ref[2]
      eventTypeHeader = buildService._formateCIPushType(pushType)
    }
  }

  if (project.repo_type  === 'gogs' && (eventTypeHeader === 'release' || eventTypeHeader === 'create')) {
    if (eventTypeHeader === 'release') {
      pushName = eventBody.release.tag_name
    } else {
      if (eventBody.ref_type === 'tag') {
        pushName = eventBody.ref
      }
    }
    eventTypeHeader = buildService._formateCIPushType(eventTypeHeader)
  }
  if (eventBody.commits && eventBody.commits.length > 0) {
    commitId = eventBody.commits[eventBody.commits.length - 1].id
  }
  event = {
    scmProjectId: projectId,
    type: eventTypeHeader,
    name: pushName,
    commitId: commitId
  }
  return event
}

function getSvnEventInfo(self, project) {
  const method = 'getSvnEventInfo'
  let eventBody = self.request.body
  const name = eventBody.name
  if (!name) {
    self.status = 400
    self.body = {
      message: "Skip, name is required."
    }
    logger.warn(method, "Skip, name is required.", project.repo_type)
    return
  }
  self.status = 200
  return {
    name: eventBody.name
  }
}