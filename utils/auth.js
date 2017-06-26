/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-13
 * @author Zhangpc
 *
 */

/*
 * for oauth
 */
'use strict'
const userService = require('../services/user')
const logger = require('../utils/logger').getLogger('auth')
const config = require('../configs/index')
const auth = require('../utils/auth')

const ADMIN_ROLE = 2

exports.authByToken = function* (next) {
  const method = 'authByToken'
  let username = this.headers.username
  let token = this.headers.authorization
  let teamspace = this.headers.teamspace

  if (!username || !token) {
    this.status = 401
    this.body = {
      err: 'User is not authorized. Authorization, username are required. '
    }
    logger.warn(method, 'User is not authorized: ' + JSON.stringify(this.headers))
    return
  }
  token = token.replace(/^token /, '')
  if (this.session.loginUser && token === this.session.loginUser.token) {
    return yield next
  }
  const loginUser = yield userService.findByToken(username, token)
  if (!loginUser) {
    this.status = 401
    this.body = {
      err: 'User is not authorized'
    }
    logger.warn(method, 'User is not authorized: ' + JSON.stringify(this.headers))
    return
  }
  // If user isn't system admin, check if user belongs to this team
  if (loginUser.role !== ADMIN_ROLE) {
    if (teamspace && teamspace !== "") {
      let isHaveAuthor = yield userService.isHaveAuthor(loginUser.user_id, teamspace)
      if(!isHaveAuthor || isHaveAuthor.length === 0) {
        this.status = 403
        this.body = {
          err: "Sorry, you cant't switch to this teamspace"
        }
        return
      }
    }
  }

  this.session.loginUser = {
    id: loginUser.user_id,
    name: loginUser.user_name,
    userNamespace: loginUser.namespace,
    namespace: (teamspace && teamspace != "") ? teamspace : loginUser.namespace,
    isTeamspace: (teamspace && teamspace != "") ? true : false,
    email: loginUser.email,
    token: loginUser.api_token,
    env_edition: loginUser.env_edition,
    role: loginUser.role
  }
  logger.info(method, 'User <' + this.session.loginUser.name + '> is authorized to tenx_ci_cd_service.')
  yield next
}

// basic 认证
exports.getBasicAuthHeader = function(user, password) {
  const authHeader  = {
    'authorization': 'Basic ' + Buffer(user + ':' + password).toString('base64')
  }
  return authHeader
}

exports.basicAuth = function* (next) {
  const method = 'basicAuth'
  if (!this.headers.authorization) {
    this.status = 401
    this.body = { message: 'User is not authorized' }
    return
  }
  let correctAuth = auth.getBasicAuthHeader(config.system_user.user, config.system_user.password).authorization
  if (!this.headers.authorization || correctAuth !== this.headers.authorization) {
    this.status = 401
    this.body = { message: 'User is not authorized' }
    return
  }
  yield next
}
