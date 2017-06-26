/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-18
 * @author huangxin
 *
 */

/*
 * Controllers for server stats
 */
'use strict'

const userService  = require('../services/user')
const statsService = require('../services/stats')

exports.collectServerStats = function* () {
  const method = 'collectServerStats'
  let username = this.headers.username
  let token = this.headers.authorization
  let namespace = this.headers.teamspace
  if (username && token) {
    token = token.replace(/^token /, '')
    const loginUser = yield userService.findByToken(username, token)
    // If no teamspace defined, then it's the user space
    if (!namespace) {
      namespace = loginUser.namespace
    }
    if (!loginUser) {
      // Invalid user/token
      namespace = ''
    } else {
      if (namespace !== loginUser.namespace) {
        let isHaveAuthor = yield userService.isHaveAuthor(loginUser.user_id, namespace)
        if(!isHaveAuthor || isHaveAuthor.length === 0) {
          // Not authorized to access
          namespace = ''
        }
      }
    }
  }
  const result = yield statsService.collectServerStats(namespace)
  this.status = result.status
  this.body = result
}
