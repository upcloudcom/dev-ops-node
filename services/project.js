/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 *
 */

/**
 * Depreated, used for v1 devops service
 * Service for project
 */
'use strict'

const Project = require('../models').Project
const DockerRegistryAPIs = require('../docker/registry')
const repoService = require('./repo')
const projectPropsService = require('./project_props')
const _ = require('lodash')
const moment = require('moment')
const uuid = require('node-uuid')
const logger = require('../utils/logger').getLogger('service/project')
const utils = require('../utils')
const url = require('url')
const SystemClusterMgr = require('./system_cluster_mgr')
const ProjectProps = require('../models').ProjectProps
const projectLinkService = require('./project_link')
const indexConfig = require('../configs')

/**
 * Create project: for v1 CICD
 */
exports.createProject = function* (user, projectName, data) {
  const method = 'createProject'
  const registryConfig = global.REGISTRY_CONFIG
  const registryAPI = new DockerRegistryAPIs(registryConfig)
  const resData = {
    status: 200,
    results: {}
  }
  let existProject = yield Project.findProjectByName(user.namespace, projectName)
  if (existProject) {
    resData.status = 403
    resData.message = `Project name '${projectName}' is already exist, update project name and try again.`
    return resData
  }
  if (!data || !data.image_name || !data.repo_clone_url || !data.depot || !data.repo_full_name) {
    resData.status = 400
    resData.message ='image_name, repo_clone_url, depot, repo_full_name are required.'
    return resData
  }
  if (data.image_name.trim() === '' || data.repo_clone_url.trim() === '' || data.depot.trim() === '' || data.repo_full_name.trim() === '') {
    resData.status = 400
    resData.message ='image_name, repo_clone_url, depot, repo_full_name can\'t be empty.'
    return resData
  }
  if (data.image_name.search(/[A-Z]/) > -1) {
    resData.status = 400
    resData.message ='image_name must be lowercase.'
    return resData
  }
  if (data.repo_clone_url.search(/^(http:|https:|git@|ssh:|svn:)/) < 0) {
    resData.status = 400
    resData.message ='repo_clone_url must begin with "http:", "https:", "git@" "ssh:" or "svn:".'
    return resData
  }
  /*if (data.repo_clone_url.indexOf(data.repo_full_name) < 0) {
    resData.status = 400
    resData.message ='repo_full_name must match repo_clone_url.'
    return resData
  }*/
  if (data.depot === 'gitlab' && !data.gitlab_project_id) {
    resData.status = 400
    resData.message ='gitlab_project_id is required.'
    return resData
  }
  const pathReg = /^(\/([0-9a-zA-Z_-]*))+/
  if (data.dockerfile_location && data.dockerfile_location.search(pathReg) < 0) {
    resData.status = 400
    resData.message ='illegal dockerfile path.'
    return resData
  }
  data.full_name = user.name.toLowerCase() + '/' + data.image_name
  existProject = yield Project.checkImageName(user.namespace, data.full_name)
  if (existProject) {
    resData.status = 403
    resData.message = `image name ${data.image_name} already exists, please use another one.`
    return resData
  }
  const newProject = {
    project_id: uuid.v4(),
    user_id: user.id,
    project_name: projectName,
    repo_type: repoService.depotToRepoType(data.depot),
    code_type: data.language,
    image_name: data.full_name,
    default_tag: (data.image_tag ? data.image_tag : 'latest'),
    clone_url: data.repo_clone_url,
    source_full_name: data.repo_full_name,
    description: data.description,
    is_repo_private: (data.repo_private === 'true' ? 'true' : 'false'),
    // Check if we should trigger a build if new tag created, registry a webhook
    build_on_change: (data.build_on_change == 'on' ? 1: 0),
    gitlab_projectId: data.gitlab_project_id,
    dockerfile_location: (data.dockerfile_location ? data.dockerfile_location : '/'),
    default_branch: data.branch,
    commit_id: data.commit_id,
    build_image: data.build_image || indexConfig.default_image_builder,
    namespace: user.namespace
  }
  if (typeof data.repo_private === undefined) {
    newProject.is_repo_private = true
  }
  // insert project to db
  const createProjectResult = yield Project.createOneProject(newProject)
  resData.results.project = formatProject(createProjectResult)
  // update docker registry
  const imageInfo = {
    name: data.full_name,
    description: newProject.description,
    imageTag: newProject.default_tag,
    isPrivate: (newProject.is_repo_private == 'true' ? 1 : 0)
  }
  const updateImageResult = yield registryAPI.updateImageInfo(user.name, data.full_name, imageInfo)
  if (updateImageResult.res.statusCode >= 300) {
    logger.error(method, `update image: ${updateImageResult.data}`)
    resData.status = updateImageResult.res.statusCode
    resData.message = updateImageResult.data || 'add image to registry failed.'
    return resData
  }
  // grant 'admin' user permissions, so 'admin' can do the push
  const gruntResult = yield registryAPI.grantPermissions(data.full_name, registryConfig.user)
  if (gruntResult.res.statusCode >= 300) {
    logger.error(method, `grunt permissions: ${gruntResult.data}`)
    resData.status = gruntResult.res.statusCode
    resData.message = gruntResult.data || 'grant permissions failed.'
    return resData
  }
  // add project props
  const projectProps = yield* projectPropsService.getOrAddProjectProps(user, data.depot, data.repo_full_name, newProject)
  resData.results.project_props = projectProps
  // for ci rules
  const ciRules = [
    {
      dockerfile_location: newProject.dockerfile_location,
      branch: newProject.default_branch,
      tag: newProject.default_tag
    }
  ]
  resData.results.ci_rules = ciRules
  // For svn user
  if (data.svn_user) {
    let svnAuthInfo = yield* repoService.getRepoAuthInfo(user, 'svn')
    if (svnAuthInfo.status === 404 || data.svn_user.is_update) {
      svnAuthInfo = {
        username: data.svn_user.username,
        password: data.svn_user.password
      }
      yield* repoService.auth(user, 'svn', svnAuthInfo)
    }
  }
  return resData
}


function* getUserRepos(username) {
  const registryConfig = global.REGISTRY_CONFIG
  const registryAPI = new DockerRegistryAPIs(registryConfig)
  const userRepos = yield registryAPI.getPrivateImages(username)
  if (userRepos.res.statusCode >= 300) {
    const err = new Error('get user images failed.')
    err.status = userRepos.res.statusCode
    throw err
  }
  let existRepos = []
  _(userRepos.data.results).forEach((repo) => existRepos.push(repo.name))
  return existRepos
}
exports.getUserRepos = getUserRepos

exports.findProjectsBuildsByUserNamespace = function* (user){
  //判断权限

  let existRepos = yield getUserRepos(user.name)
  let projects = yield Project.findProjectsBuildsByUserNamespace(user.namespace)
  if (!projects) {
    projects = []
  }
  const formatProjects = []
  _(projects).forEach(function (project) {
    let formatProject = formatProject(project)
    formatProject.imageExist = false
    if (existRepos.indexOf(project.image_name) >= 0) {
      formatProject.imageExist = true
    }
    formatProjects.push(formatProject)
  })

  return {
    status: 200,
    total: projects.length,
    results: formatProjects
  }
}

exports.findPorjectOnlyByImage = function* (repo){
   const result = yield Project.findPorjectOnlyByImage(repo)
   return result
}

exports.getProject = function* (user, projectName) {
  const project = yield Project.findProjectByName(user.namespace, projectName)
  const resData = {
    status: 200
  }
  if (!project) {
    resData.status = 404
    resData.message = `project ${projectName} not exist`
    return resData
  }
  const project_repo = yield ProjectProps.findOneProjectProps(user.namespace, project.repo_type, project.source_full_name)
  if(project_repo) {
    project.is_add_deploy_key = project_repo.is_add_deploy_key
  } else {
    project.is_add_deploy_key = 0
  }
  let formatProject = formatProject(project)
  let existRepos = yield getUserRepos(user.name)
  formatProject.imageExist = false
  if (existRepos.indexOf(project.image_name) >= 0) {
    formatProject.imageExist = true
  }
  resData.results = formatProject
  return resData
}

exports.updateProject = function* (user, projectName, data) {
  const method = 'updateProject'
  const resData = {
    status: 200
  }
  if (projectName) {
    const existProject = yield Project.findProjectByName(user.namespace, data.projectName)
    if (existProject) {
      resData.status = 403
      resData.message = `project name ${data.projectName} is already exist`
      return resData
    }
  }
  const project = {
    project_name: projectName,
    detail: data.projectDetail,
    description: data.projectDescription
  }
  if (data.dockerfilePath) {
    project.dockerfile_location = data.dockerfilePath
  }
  if (data.cache) {
    project.use_cache = data.cache
  }
  if (data.push_on_complete) {
    project.push_on_complete = data.push_on_complete
  }
  if (data.buildOnChange) {
    project.build_on_change = data.buildOnChange
  }
  if (data.deployOnPush) {
    project.deploy_on_push = data.deployOnPush
  }
  if (data.build_image) {
    project.build_image = data.build_image
  }
  if(data.is_need_privilege) {
    project.is_need_privilege = data.is_need_privilege
  }
  if(data.webhook_initialized) {
    project.webhook_initialized = data.webhook_initialized
  }
  if(data.webhook_id) {
    project.webhook_id = data.webhook_id
  }
  if (data.notificationConfig) {
    if (typeof data.notificationConfig === 'object') {
      project.notification_config = JSON.stringify(data.notificationConfig)
    } else {
      project.notification_config = data.notificationConfig
    }
  }
  const result = yield Project.updateProjectByName(user.namespace, projectName, project)
  if (result[0] < 1) {
    logger.error(method, result[1])
    resData.status = 304
    resData.message = result[1]
  } else {
    resData.message = `project ${projectName} update successfully`
  }
  return resData
}

exports.deleteProject = function* (user, projectName) {
  const project = yield Project.findProjectByName(user.namespace, projectName)
  const result = yield Project.deleteProjectByName(user.namespace, projectName)
  const projectLink = yield projectLinkService.disableProjectLink(project.project_id)
  const projectProp = yield projectPropsService.updateProjectProps(user.namespace, project.repo_type, project.source_full_name, {
    is_add_deploy_key: '0'
  })
  const resData = {
    status: 200
  }
  if (result < 1) {
    resData.message = `project ${projectName} not exist`
  } else {
    resData.message = `project ${projectName} delete successfully`
  }
  return resData
}

function getSourceFullName(fullName, repoUrl) {
  if (!fullName) {
    fullName = ''
  }
  var names = fullName.split('/')
  if (names[0].trim() === '') {
    var pathname = url.parse(repoUrl).pathname
    pathname = pathname.replace('.git', '')
    if (pathname.indexOf(':') > -1) {
      pathname = pathname.substr(pathname.indexOf(':') + 1)
    }
    return pathname
  } else {
    return fullName
  }
}
exports.getSourceFullName = getSourceFullName

exports.getProjectByProjectId = function (projectId) {
  return Project.findProjectById(projectId).then(function (project) {
    return formatProject(project)
  })
}

exports.getProjectReplicator = function* (user, projectName, imageName) {
  let replicator = yield Project.findProjectReplicator(user.namespace, projectName, imageName)
  yield replicator.map(function (item) {
    return SystemClusterMgr.getClusterByName(item.hosting_cluster).then(function (cluster) {
      item.cluster_display_name = item.hosting_cluster
      cluster && (item.cluster_display_name = cluster.displayname)
      return item
    })
  })
  return {
    status: 200,
    message: replicator
  }
}

function handleRepoUrl(project) {
  project.source_full_name = getSourceFullName(project.source_full_name, project.clone_url)
  switch (project.repo_type) {
    case '1':
    case 'tenxcloud':
      return 'https://github.com/' + project.source_full_name
    case '2':
      return 'https://bitbucket.org/' + project.source_full_name
    case '3':
      return null
    case '4':
      return 'https://gitcafe.com/' + project.source_full_name
    case '5':
      return 'https://git.coding.net/' + project.source_full_name + '.git'
    case '6':
      if (project.clone_url.indexOf('ssh://') == 0) {
        project.clone_url = project.clone_url.replace('ssh://', '')
      }
      let isSSH = project.clone_url.indexOf('@')
      if (isSSH > -1) {
        return 'http://' + project.clone_url.substring(isSSH + 1, project.clone_url.indexOf(':')) + '/' + project.source_full_name
      }
      return project.clone_url.replace('.git', '')
    case '7':
      return project.clone_url
    default:
      return 'https://' + project.clone_url.substr(project.clone_url.indexOf('@') + 1).replace(':', '/')
  }
}
exports.handleRepoUrl = handleRepoUrl

function exchangeStatus(source) {
  switch (source) {
    case '0':
      return 'success'
    case '1':
      return 'failed'
    case '2':
      return 'building'
    case '3':
      return 'waitting'
    case '4':
      return 'stopped'
    default:
      return '-'
  }
}
exports.exchangeStatus = exchangeStatus

function formatProject(project) {
  if(!project || (!project.project_id && !project.project_name)) {
    return
  }
  let newProject = {
    id: project.project_id,
    name: project.project_name,
    description: project.description,
    depot: repoService.repoTypeToDepot(project.repo_type),
    image_full_name: project.image_name,
    repo_full_name: project.source_full_name,
    repo_private: (project.is_repo_private == 'true' ? true : false),
    repo_url: handleRepoUrl(project),
    repo_clone_url: project.clone_url,
    default_dockerfile_location: project.dockerfile_location,
    default_tag: project.default_tag,
    branch: project.default_branch,
    ci_config: _.attempt(JSON.parse.bind(null, project.ci_config)),
    detail: project.detail,
    build_image: project.build_image,
    last_build: {},
    use_cache: project.use_cache,
    push_on_complete: project.push_on_complete,
    ci: project.build_on_change,
    cd: project.deploy_on_push,
    gitlab_project_id: project.gitlab_projectId,
    create_time: utils.toUTCString(project.creation_time || project.projectCreationTime),
    is_add_deploy_key: project.is_add_deploy_key,
    is_need_privilege: project.is_need_privilege || 'off',
    webhook_id: project.webhook_id,
    webhook_initialized: project.webhook_initialized,
    namespace: project.namespace
  }
  if (project.last_build_time) {
    newProject.last_build = {
      build_id: project.build_id,
      start_time: utils.toUTCString(project.last_build_time),
      end_time: utils.toUTCString(project.end_time),
      status: exchangeStatus(project.status),
      branch: project.branch_name,
      tag: project.image_tag
    }
  }
  if (project.notification_config) {
    newProject.notification_config = utils.parse(project.notification_config)
  }
  return newProject
}
exports.formatProject = formatProject