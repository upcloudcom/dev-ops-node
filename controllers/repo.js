/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-18
 * @author Zhangpc
 *
 */

/**
 * Controllers for repo
 */
'use strict'
const repoService = require('../services/repo')

// /repos?type=gitlab, github, svn, etc...
exports.getRepositories = function* () {
  const repoType = this.params.type
  const scmUser = this.query.user
  const result = yield* repoService.showRepos(this.session.loginUser, repoType, scmUser)
  this.status = result.status
  this.body = result
}

// /auth in v1
// Post /repo
exports.addRepository = function* () {
  const user = this.session.loginUser
  const repoType = this.params.type
  var body = this.request.body
  // Do basic validation
  if (repoType === "gitlab" || repoType === "gogs") {
    if (!body.url || !body.private_token) {
      this.status = 400
      this.body = {
        status: 400,
        message: 'url and private_token are required.'
      }
      return
    }
    // TODO: May update the params here later
    body.gitlab_url = body.url
    body.access_token = body.private_token
  } else if (repoType === "svn") {
    let isValid = true
    let message = ''
    if (!body.url) {
      isValid = false
      message = "Address of SVN repository is required."
    }
    // User specified by no password
    if (body.username && !body.password) {
      isValid = false
      message = "Password of SVN user is required."
    }
    if (!isValid) {
      this.status = 400
      this.body = {
        status: 400,
        message: message
      }
      return
    }
  }
  const result = yield* repoService.auth(user, repoType, body)
  this.status = result.status
  this.body = result
  if (repoType !== "svn") {
    // No need to sync for SVN repository
    yield* repoService.syncRepos(user, repoType, body)
  }
}

exports.logout = function* () {
  const user = this.session.loginUser
  const repoType = this.params.type
  this.body = yield* repoService.deleteRepo(user, repoType)
}

exports.syncRepos = function* () {
  const user = this.session.loginUser
  const repoType = this.params.type
  const result = yield* repoService.syncRepos(user, repoType)
  this.status = result.status
  this.body = result
}

exports.getSupportedRepos = function* () {
  // All we can support for now
  let supportedRepos = ['github', 'gitlab', 'svn', 'gogs']
  // If no valid github config, then remove from the list
  let githubConfig = require('../configs/coderepo/github')
  if (!githubConfig.clientId || githubConfig.clientId == "") {
    let index = supportedRepos.indexOf('github')
    supportedRepos.splice(index, 1)
  }
  this.body = supportedRepos
}

exports.getBranches = function* () {
  const user = this.session.loginUser
  const type = this.params.type
  const reponame = this.query.reponame
  const projectId = this.query.project_id
  if (!reponame) {
    this.status = 400
    this.body = {
      status: 400,
      message: 'reponame in query is required.'
    }
    return
  }
  if (reponame.indexOf('/') < 0) {
    this.status = 400
    this.body = {
      status: 400,
      message: 'reponame must be fullname.'
    }
    return
  }
  if (type === 'gitlab' && !projectId) {
    this.status = 400
    this.body = {
      status: 400,
      message: 'project_id in query is required.'
    }
    return
  }
  const project = {
    name: reponame,
    projectId: projectId
  }
  const result = yield* repoService.getBranches(user, project, type)
  this.status = result.status
  this.body = result
}

exports.getTags = function* (params) {
  const user = this.session.loginUser
  const type = this.params.type
  const reponame = this.query.reponame
  const projectId = this.query.project_id
  if (type !== 'gitlab') {
    if (!reponame || reponame.indexOf('/') < 0) {
      this.status = 400
      this.body = {
        status: 400,
        message: 'reponame in query is required and must be fullname.'
      }
      return
    }
  }
  if (type === 'gitlab' && !projectId) {
    this.status = 400
    this.body = {
      status: 400,
      message: 'project_id in query is required.'
    }
    return
  }
  const project = {
    name: reponame,
    projectId: projectId
  }
  const result = yield* repoService.getTags(user, project, type)
  this.status = result.status
  this.body = result
}

exports.getUserInfo = function* () {
  const user = this.session.loginUser
  const type = this.params.type
  const result = yield* repoService.getReposAuthInfo(user, type)
  this.status = result.status
  // Remove token and other sensitive information
  if (result.results) {
    delete result.results.token
    delete result.results.token_secret
  }
  this.body = result
}

exports.getAuthRedirectUrl = function* () {
  const type = this.params.type
  const result = yield* repoService.getAuthRedirectUrl(type)
  this.status = result.status
  this.body = result
}