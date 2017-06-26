/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-18
 * @author Zhangpc
 *
 */

/**
 * Service for repo
 */
'use strict'

const Repo = require('../models').Repo
const ManagedProject = require('../models').ManagedProject
const codeRepoApis = require('../ci/coderepo')
const logger = require('../utils/logger').getLogger('service/repo')
const _ = require('lodash')
const utils = require('../utils')
const uuid = require('node-uuid')

exports.getReposAuthInfo = function* (user, depot) {
  let result = yield Repo.findOneRepo(user.namespace, depotToRepoType(depot))
  if (!result) {
    return {
      status: 404,
      message: 'No repo auth info found.'
    }
  }
  let username = ''
  if (result.user_info) {
    //TODO, use the user/org later
    username = JSON.parse(result.user_info)[0].login
  } else {
    username = result.access_user_name
  }
  return {
    status: 200,
    results: {
      depot,
      url: result.gitlab_url,
      token: result.access_token,
      username: username,
      //token_secret: result.access_token_secret
    }
  }
  /*let results = yield Repo.findUserRepoTokens(user.id)
  if (!results) {
    return {
      status: 401,
      message: 'No authentication information found.'
    }
  }
  results = results.map((authInfo) => {
    return {
      depot: repoTypeToDepot(authInfo.repo_type),
      auth_users_info: utils.parse(authInfo.user_info) || []
    }
  })
  return {
    status: 200,
    total: results.length,
    results
  }*/
}

exports.showRepos = function* (user, depot, scmUser) {
  let repoResults = yield Repo.findOneRepo(user.namespace, depotToRepoType(depot))
  if (!repoResults) {
    // Result is empty
    return {
      // Fine as no repostory
      status: 200,
      message: 'No repository found for ' + depot
    }
  }
  let results = []
  if (depot == "gitlab" || depot == "github" || depot == "gogs") {
    results = JSON.parse(repoResults.repo_list) || []
    // Github may have multiple users
    if (depot == 'github' || depot == 'gogs') {
      // If user specified, return the matched one
      if (scmUser) {
        results = results[scmUser]
      } else {
        results = _formatGithubRepos(results)
      }
    }
    // Check if the repository was already added to managed project
    yield _addManagedProjectTag(user.namespace, depot, results)
  } else if (depot == "svn" ) {
    logger.info(method, "Do not support repository list for SVN")
  } else {
    return {
      status: 400,
      "message": "Only support gitlab/github/svn/gogs for now'"
    }
  }
  return {
    status: 200,
    total: results.length,
    results
  }
}

exports.getAuthRedirectUrl = function* (depot) {
  if (depot != 'github') {
    return {
      status: 400,
      message: "Only support to get redirect url of github."
    }
  }
  const repoApi = new codeRepoApis(depot)
  const results = repoApi.getAuthRedirectUrl(uuid.v4())
  return {
    status: 200,
    results
  }
}
/**
 * Save Auth
 * Receive auth info and get userinfo by api, then save authinfo and userinfo to db
 * eg. gitlab: url, access_token
 */
exports.auth = function* (user, depot, authInfo) {
  const method = 'auth'
  const repoInfo = yield Repo.findOneRepoToken(user.namespace, depotToRepoType(depot))
  if (repoInfo && repoInfo.user_info) {
    const message = 'User <' + user.name + '> Is already authorized.'
    logger.warn(method, message)
    return {
      status: 200,
      message,
      results: utils.parse(repoInfo.user_info)
    }
  }
  if (repoInfo) {
    yield Repo.deleteOneRepo(user.namespace, depotToRepoType(depot))
  }
  return yield* getAndSaveUserInfoToDB(user, depot, authInfo)
}

function* getAndSaveUserInfoToDB(user, depot, config) {
  const method = 'getAndSaveUserInfoToDB'
  let repoInfo = {
    user_id: user.id,
    repo_type: depotToRepoType(depot),
    create_time: utils.DateNow(),
    // Encrypt sensistive information by default
    is_encrypt: 1,
    namespace: user.namespace
  }
  let results = ''
  // Handle SVN
  if (depot === 'svn') {
    repoInfo.access_user_name = config.username
    repoInfo.access_token = config.password
    repoInfo.gitlab_url = config.url
    results = "SVN repository was added successfully"
  } else {
    const repoApi = new codeRepoApis(depot, config)
    if (depot !== 'gitlab' && depot !== "gogs") {
      const exchangeTokens = yield repoApi.exchangeToken(config.code, config.oauth_token_secret, config.oauth_verifier)
      config.access_token = exchangeTokens.access_token
      config.access_token_secret = exchangeTokens.access_token_secret
    }
    let userInfo = yield repoApi.getUserAndOrgs()
    repoInfo.access_user_name = userInfo.login
    repoInfo.access_token = config.access_token
    repoInfo.access_token_secret = config.access_token_secret
    repoInfo.gitlab_url = config.url
    repoInfo.user_info = JSON.stringify(userInfo)
    results = userInfo
  }
  yield Repo.createOneRepo(repoInfo)
  return {
    status: 200,
    results: results
  }
}
exports.getAndSaveUserInfoToDB = getAndSaveUserInfoToDB

exports.syncRepos = function* (user, depot) {
  const method = 'syncRepos'
  const repoInfo = yield Repo.findOneRepoToken(user.namespace, depotToRepoType(depot))
  const resData = {
    status: 200
  }
  if (!repoInfo) {
    resData.status = 404
    resData.message = `${depot} repo not exist`
    return resData
  }
  let userInfo = utils.parse(repoInfo.user_info)
  const repoApi = new codeRepoApis(depot, repoInfo)
  // const repoList = yield repoApi.getUserAllRepos()
  let repoList
  try {
    repoList = yield repoApi.getAllUsersRepos(userInfo)
  } catch (err) {
    return {
      status: err.status,
      message: "同步代码仓库失败: " + err.status
    }
  }

  // TODO: Use the first one by now
  const updateRepoResult = yield Repo.updateOneRepo(user.namespace, depotToRepoType(depot), {repo_list: JSON.stringify(repoList)})

  if (depot == 'github' || depot == 'gogs') {
    repoList = _formatGithubRepos(repoList)
  }
  resData.results = repoList
  // Check if the repository was already added to managed project
  yield _addManagedProjectTag(user.namespace, depot, repoList)
  if (updateRepoResult[0] < 1) {
    resData.message = 'repo list not update'
    return resData
  }

  return resData
}

exports.deleteRepo = function* (user, depot) {
  const result = yield Repo.deleteOneRepo(user.namespace, depotToRepoType(depot))
  const resData = {
    status: 200
  }
  if (result < 1) {
    resData.message = 'This repository does not exist yet'
  } else {
    resData.message = 'Logout successfully'
  }
  return resData
}

function* getBranches(user, project, depot) {
  const method = 'getBranches'
  if (!depot) {
    depot = repoTypeToDepot(project.repo_type)
  }
  const repoInfo = yield Repo.findOneRepoToken(user.namespace, depotToRepoType(depot))
  const resData = {
    status: 200
  }
  // If the user already logout
  if (!repoInfo) {
    resData.status = 401
    resData.message = "Not authorized to access branch information, make sure you already logged in."
    return resData
  }
  try {
    const repoApi = new codeRepoApis(depot, repoInfo)
    resData.results = yield repoApi.getRepoAllBranches(project.name, project.projectId)
    return resData
  } catch(err) {
    logger.error(err.stack)
    resData.status = parseInt(err.status)
    if (isNaN(resData.status)) {
      resData.status = 500
    }
    resData.message = JSON.stringify(err)
    return resData
  }
}
exports.getBranches = getBranches

exports.getBranchInfo = function* (user, project, branchName) {
  const method = 'getBranchInfo'
  const branches = yield* getBranches(user, project)
  let branch = {}
  let targetBranchIndex = _.findIndex(branches.results, ['branch', branchName])
  if (targetBranchIndex > -1) {
    branch = branches.results[targetBranchIndex]
    branch.commit_id = branch.commit_id.substring(0, 12)
  }
  return {
    status: 200,
    results: branch
  }
}

function* getTags(user, project, depot) {
  const method = 'getTags'
  if (!depot) {
    depot = repoTypeToDepot(project.repo_type)
  }
  const repoInfo = yield Repo.findOneRepoToken(user.namespace, depotToRepoType(depot))
  const resData = {
    status: 200
  }
  // If the user already logout
  if (!repoInfo) {
    resData.status = 401
    resData.message = "Not authorized to access branch information, make sure you already logged in."
    return resData
  }
  try {
    const repoApi = new codeRepoApis(depot, repoInfo)
    resData.results = yield repoApi.getRepoAllTags(project.name, project.projectId)
    return resData
  } catch(err) {
    logger.error(err.stack)
    resData.status = parseInt(err.status)
    if (isNaN(resData.status)) {
      resData.status = 500
    }
    resData.message = JSON.stringify(err)
    return resData
  }
}
exports.getTags = getTags

exports.createWebhook = function* (user, projectInfo) {
  const repoInfo = yield Repo.findOneRepoToken(user.namespace, depotToRepoType(projectInfo.depot))
  const resData = {
    status: 200
  }
  if (!repoInfo) {
    let error = new Error(`${projectInfo.depot} repo not exist`)
    error.status = 404
    throw error
  }
  const repoApi = new codeRepoApis(projectInfo.depot, repoInfo)
  if(projectInfo.webhook_id) {
    let projectWebHook = yield repoApi.getOneWebhook(projectInfo)
    if(projectWebHook && projectWebHook.hook_id == projectInfo.webhook_id) {
      return { status: 200, result: { hook_id: projectInfo.webhook_id}}
    }
  }
  delete projectInfo.webhook_id
  let result = yield repoApi.createWebhook(projectInfo, {
    push_events: true,
    tag_push_events: true,
    release_events: true
  }).then(function (result) {
    return { status: 200, result:result }
  }, function (error) {
    return repoApi.createWebhook(projectInfo, {
      push_events: true,
      tag_push_events: true,
      release_events: true
    }).then(function (result) {
      return { status: 200, result:result }
    }, function () {
      return { status:500, result: {} }
    })
  })
  return result
}

function depotToRepoType(depot) {
  switch (depot) {
    case 'github':
      return '1'
    case 'bitbucket':
      return '2'
    case 'tce':
      return '3'
    case 'gitcafe':
      return '4'
    case 'coding':
      return '5'
    case 'gitlab':
      return '6'
    case 'svn':
      return '7'
    case 'gogs':
      return '8'
    default:
      return depot
  }
}

exports.depotToRepoType = depotToRepoType

function repoTypeToDepot(repoType) {
  switch (repoType) {
    case '1':
      return 'github'
    case '2':
      return 'bitbucket'
    case '3':
      return 'tce'
    case '4':
      return 'gitcafe'
    case '5':
      return 'coding'
    case '6':
      return "gitlab"
    case '7':
      return "svn"
    case '8':
      return "gogs"
    default:
      return repoType
  }
}
exports.repoTypeToDepot = repoTypeToDepot
/*
Mark if project is activated
*/
function* _addManagedProjectTag(namespace, repoType, repoList) {
  let projectList = yield ManagedProject.listProjectsByType(namespace, repoType)
  if (Array.isArray(repoList)) {
    _(repoList).forEach(function(repository) {
      for (var i = 0; i< projectList.length; i++) {
        // Match gitlab project id
        if (repository.projectId == projectList[i].gitlab_project_id) {
          repository.managed_project = {
            active: 1,
            id: projectList[i].id
          }
          break
        }
      }
    })
  } else {
    Object.keys(repoList).forEach(function(key) {
      // Add repos as we added another layer
      _(repoList[key].repos).forEach(function(repository) {
        for (var i = 0; i< projectList.length; i++) {
          // Match gitlab project id
          if (repository.projectId == projectList[i].gitlab_project_id) {
            repository.managed_project = {
              active: 1,
              id: projectList[i].id
            }
            break
          }
        }
      })
    })
  }
}

function _formatGithubRepos(results) {
  let list = {}
  for (var name in results) {
    list[name] = {
      user: name,
      repos: results[name]
    }
  }
  return list
}