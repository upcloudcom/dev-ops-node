/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-01
 * @author Lei
 */

/**
 * Controllers for managed projects
 */
'use strict'
const managedProjectService = require('../services/managed_project')

/*
Sample request body to add a new managed project
{
  "name": "first managed project",
  "is_private": 1,
  "repo_type": "gitlab",
  "source_full_name": "wanglei/demo-project",
  "address": "git@gitlab.tenxcloud.com:wanglei/demo-project.git",
}
*/
exports.getManagedProjects = function* () {
  const repoType = this.params.type
  const result = yield* managedProjectService.listProjects(this.session.loginUser.namespace)
  this.status = result.status
  this.body = result
}

exports.getManagedProjectDetail = function* () {
  const projectId = this.params.project_id
  const result = yield* managedProjectService.getProjectDetail(this.session.loginUser.namespace, projectId)
  this.status = result.status
  this.body = result
}

exports.createManagedProject = function* () {
  var body = this.request.body
  const result = yield* managedProjectService.createProject(this.session.loginUser, body)
  this.session.auditInfo.resourceName = body.name
  this.session.auditInfo.resourceId = result.project_id
  this.status = result.status
  this.body = result
}

// Remove project by id
exports.removeManagedProject = function* () {
  const projectId = this.params.project_id
  const result = yield* managedProjectService.removeProject(this.session.loginUser.namespace, projectId, this.session.auditInfo)
  this.status = result.status
  this.body = result
}