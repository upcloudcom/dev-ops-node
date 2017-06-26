/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 * 
 */

/*
 * Controllers for project
 */
'use strict'

const projectService = require('../services/project')
const _ = require('lodash')

exports.showAllProjects = function* () {
  this.body = yield* projectService.findProjectsBuildsByUserNamespace(this.session.loginUser)
}

exports.getProject = function* () {
  const projectName = this.params.project_name
  this.body = yield* projectService.getProject(this.session.loginUser, projectName)
}

exports.addProject = function* () {
  const projectName = this.params.project_name
  const data = this.request.body
  const result = yield* projectService.createProject(this.session.loginUser, projectName, data)
  this.status = result.status
  this.body = result
}

exports.updateProject = function* () {
  const projectName = this.params.project_name
  const data = this.request.body
  const result = yield* projectService.updateProject(this.session.loginUser, projectName, data)
  this.status = result.status
  this.body = result
}

exports.deleteProject = function* () {
  const projectName = this.params.project_name
  this.body = yield* projectService.deleteProject(this.session.loginUser, projectName)
}

exports.getProjectReplicator = function* () {
  const projectName = this.params.project_name
  const user = this.params.user
  const imageName = this.params.image_name
  this.body = yield* projectService.getProjectReplicator(this.session.loginUser, projectName, `${user}/${imageName}`)
}

