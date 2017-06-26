/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 * 
 */

/*
 * Service for project
 */
'use strict'

const User = require('../models').User

exports.findByToken = function* (user_name, token) {
  return yield* User.findByToken(user_name, token)
}

exports.isHaveAuthor = function* (user_id, namespace) {
  return yield User.isHaveAuthor(user_id, namespace)
}
