/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-21
 * @author Zhangpc
 * 
 */

/*
 * Controllers for project_props
 */
'use strict'

const projectPropsService = require('../services/project_props')

exports.getProjectProps = function* () {
  const projectName = this.params.project_name
  const result = yield* projectPropsService.getProjectProps(this.session.loginUser, projectName)
  this.status = result.status
  this.body = result
}