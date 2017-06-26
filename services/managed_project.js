/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-01
 * @author Lei
 */

/**
 * Service for managed projects
 */
'use strict'

const logger         = require('../utils/logger').getLogger('service/managed_project')
const idGenerator    = require('../utils/id_generator')
const security       = require('../utils/security')
const utils          = require('../utils')
const repoService    = require('./repo')
const Repo           = require('../models').Repo
const ManagedProject = require('../models').ManagedProject
const Stage          = require('../models').Stage
const codeRepoApis   = require('../ci/coderepo')

// Add a project to the managed list
exports.createProject = function* (user, project) {
  const method = 'createProject'
  var resData = {}
  if (project.address.search(/^(http:|https:|git@|ssh:|svn:)/) < 0) {
    resData.status = 400
    resData.message ='address must begin with "http:", "https:", "git@" "ssh:" or "svn:".'
    return resData
  }
  // Generate a shortid before insert the new record
  project.id = idGenerator.newManagedProjectID()
  project.owner = user.name
  project.namespace = user.namespace
  project.create_time = new Date()
  // gitlab or github
  project.is_private = (project.is_private === undefined ? project.private : project.is_private)

  // Check if the project alreay exists
  let results = yield ManagedProject.findProjectByNameType(user.namespace, project.name, project.repo_type)
  if (results && results.length > 0) {
    return {
      status: 409,
      "message": "Project (name - '" + project.name + "', type - '" + project.repo_type + "') already exists"
    }
  }
  // Check if the project url alreay exists for svn repo
  if (project.repo_type === 'svn') {
    const results = yield ManagedProject.findProjectByAddressType(user.namespace, project.address, project.repo_type)
    if (results && results.length > 0) {
      return {
        status: 409,
        "message": "Project (type - '" + project.repo_type + "', address - '" + project.address + "') already exists"
      }
    }
  }
  var scmResult = {}
  if (project.repo_type == "gitlab" || project.repo_type == "github" || project.repo_type == "gogs") {
    // Handle gitlab
    scmResult = yield _createIntegrationParts(user.namespace, project)
    if (scmResult.error) {
      return scmResult.error
    }
  } else if (project.repo_type == "svn") {
    // Handle svn
    logger.info(method, "Adding a new SVN repository")
    project.source_full_name = project.address
    // Update user/password if found for each add action
    project.is_private = 0
    if (project.username && project.password) {
      project.is_private = 1
      yield repoService.auth(user, project.repo_type, {username: project.username, password: project.password})
    }
  } else {
    return {
      status: 400,
      "message": "Only support gitlab/svn/github/gogs for now'"
    }
  }
  results = yield ManagedProject.createOneProject(project)
  return {
    status: 200,
    project_id: project.id,
    warnings: scmResult.warning,
    "message": "Project added successfully"
  }
}

// List managed projects for specified user
exports.listProjects = function* (namespace) {
  let results = yield ManagedProject.listProjects(namespace)
  if (!results) {
    return {
      status: 200,
      message: 'No project added yet'
    }
  }
  // Remove private info from the result
  results.forEach(function(project) {
    project.private_key = undefined
    if (project.public_key) {
      project.public_key = project.public_key.toString()
    }
    // Add webhook url for svn
    if (project.repo_type === 'svn') {
      project.webhook_url = `${utils.getWebHookUrl()}/${project.id}`
    }
    // Use the field below to check if key/webhook added successfully
    //project.deploy_key_id = undefined
    //project.webhook_id = undefined
  })
  return {
    status: 200,
    total: results.length,
    results
  }
}

exports.getProjectDetail = function* (namespace, projectId) {
  let project = yield ManagedProject.findProjectById(namespace, projectId)
  if (!project) {
    return {
      status: 404,
      message: 'No project found'
    }
  }
  // Remove private info from the result
  project.private_key = undefined
  if (project.public_key) {
    project.public_key = project.public_key.toString()
  }
  return {
    status: 200,
    projectId,
    results: project,
  }
}

exports.findProjectById = function* (project_id) {
  let result = yield ManagedProject.findProjectOnlyById(project_id)
  return result
}

// Remove a project from managed list
exports.removeProject = function* (namespace, projectId, auditInfo) {
  const method = "removeProject"
  const projectInfo = yield ManagedProject.findProjectById(namespace, projectId, auditInfo)
  if (!projectInfo) {
    return {
      status: 200,
      message: "Project removed successfully"
    }
  }
  auditInfo.resourceName = projectInfo.name
  // Check if any stage is referring this project
  var inUseStage = yield Stage.findByProjectId(projectId)
  if (inUseStage) {
    return {
      status: 400,
      message: `Stage '${inUseStage.stage_name}' is using this project, remove the reference from the stage and try again`
    }
  }
  if (projectInfo.repo_type == "gitlab" || projectInfo.repo_type == "github" || projectInfo.repo_type == "gogs") {
    // Clear deploy keys, webhook, etc... from integrated SCM tools
    yield _clearIntegrationParts(namespace, projectInfo)
  } else if (projectInfo.repo_type == "svn") {
    logger.info(method, "Removing SVN project " + projectInfo.name)
  }
  let results = yield ManagedProject.removeProject(namespace, projectId)
  if (!results || results < 1) {
    return {
      status: 404,
      message: "No project found mathcing the project id"
    }
  }
  return {
    status: 200,
    message: "Project removed successfully"
  }
}

function* _clearIntegrationParts(namespace, project) {
  const method = '_clearIntegrationParts'
  // Handle gitlab
  if (project.repo_type == "gitlab" || project.repo_type == "github" || project.repo_type == "gogs") {
    let repoConfig = yield Repo.findOneRepoToken(namespace, repoService.depotToRepoType(project.repo_type))
    let repoApi = new codeRepoApis(project.repo_type, repoConfig)
    var result
    if (project.deploy_key_id) {
      // Remove key
      result = yield repoApi.removeDeployKey(project.gitlab_project_id, project.deploy_key_id, project.name)
      logger.info(method, "Remove deploy key => ", JSON.stringify(result))
    }
    logger.info("Result of removeDeployKey: " + JSON.stringify(result))
    if (project.webhook_id) {
      // Remove webhook
      result = repoApi.removeWebhook(project.gitlab_project_id, project.webhook_id, project.name)
      logger.info(method, "Remove webhook => ", JSON.stringify(result))
    }
    logger.info("Result of removeWebhook: " + JSON.stringify(result))
  } else if (project.repo_type == "svn") {
    logger.info(method, "Only need to remove SVN project " + project.name)
  }
}
/*
Return error message if has
*/
function* _createIntegrationParts(namespace, project) {
  const method = '_createIntegrationParts'
  var warningMsg = null
  var projectId = null
  if (project.repo_type == 'gitlab' && !project.gitlab_project_id) {
    let resData = {
      status: 400,
      message: 'gitlab_project_id is required for gitlab'
    }
    return {
      error: resData
    }
  } else if ((project.repo_type == 'github' || project.repo_type == 'gogs') && !project.projectId) {
    let resData = {
      status: 400,
      message: 'projectId is required for github or gogs'
    }
    return {
      error: resData
    }
  }
  // gitlab or github
  project.gitlab_project_id = (project.gitlab_project_id ? project.gitlab_project_id : project.projectId)
  // Generate the project key
  const keyPairs = yield security.generateRsaKeys()
  project.private_key = security.encryptContent(keyPairs.privateKey),
  project.public_key = keyPairs.publicKey
  // Add key to the specified project
  let repoConfig = yield Repo.findOneRepoToken(namespace, repoService.depotToRepoType(project.repo_type))
  let repoApi = new codeRepoApis(project.repo_type, repoConfig)
  // More info for github
  let result = yield repoApi.addDeployKey(project.gitlab_project_id, project.public_key.toString(), project.name)
  if (result.status === 200) {
    project.deploy_key_id = result.id
    // Add webhook for this managed project
    result = yield repoApi.createWebhook(project, {
      // push / tag / merge_request
      push_events: true,
      tag_push_events: true,
      pull_request: true,
      release_events: true
    }, project.name)
    // Should always return the webhook url
    project.webhook_url = result.hookData ? result.hookData.url : ''
    if (result.status === 200) {
      project.webhook_id = result.hook_id
    } else {
      // Handle if add failed
      logger.warn(method, "Failed to add webhook, should add it manually: " + JSON.stringify(result))
      warningMsg = {
        status: result.status,
        "message": "Failed to add webhook, should add it manually, error detail: " + JSON.stringify(result)
      }
    }
  } else {
    let webHook = yield repoApi.createWebhook(project, {
      only_gen_webhook: true
    }, project.name)
    project.webhook_url = webHook.hookData ? webHook.hookData.url : ''
    // Handle if add failed
    logger.warn(method, "Failed to add deploy key, should add it manually: " + JSON.stringify(result))
    warningMsg = {
      status: result.status,
      "message": "Failed to add deploy key, should add it manually, error detail: " + JSON.stringify(result)
    }
  }

  return {
    error: null,
    warning: warningMsg
  }
}