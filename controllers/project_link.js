/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-06-25
 * @author Zhang_Shouhong
 * 
 */

/*
 * Controllers for project_link
 */
'use strict'

const projectLinkService = require('../services/project_link')

exports.addOrUpdateProjectLink = function* () {
  const data = this.request.body
  const result = yield* projectLinkService.addOrUpdateProjectLink(data)
  this.status = result.status
  this.body = result
}

exports.getProjectLink = function* () {
  const projectName = this.params.project_name
  const result = yield* projectLinkService.getProjectLink(this.session.loginUser.namespace, projectName)
  this.status = result.status
  this.body = result
}

