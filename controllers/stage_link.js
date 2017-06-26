/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-15
 * @author huangxin
 * 
 */

/**
 * Controller for stage link
 */
'use strict'

const stageLinkService = require('../services/stage_link')
const logger = require('../utils/logger').getLogger('controllers/stage_link')

exports.updateLinkDirs = function* () {
  let stage = this.request.body
  const result = yield stageLinkService.updateLinkDirs(this.session.loginUser, 
  	this.params.flow_id, this.params.stage_id, this.params.target_id, this.request.body, this.session.auditInfo)
  this.status = result.status
  this.body = result
}