/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-7
 * @author huangxin
 *
 */

/*
 * Controllers for flow build
 */
'use strict'

const flowBuildService = require('../services/flow_build')
const logger = require('../utils/logger').getLogger('controllers/stage')

exports.createFlowBuild = function* () {
  const body = this.request.body
  let stageId
  let options
  if (body) {
    stageId = body.stageId
    options = body.options
  }

  const result = yield flowBuildService.startFlowBuild(this.session.loginUser, this.params.flow_id, stageId, this.session.auditInfo, null, options)
  this.status = result.status
  this.body = result
}

exports.listBuilds = function* () {
  const result = yield flowBuildService.getBuildsOfFlow(this.session.loginUser, this.params.flow_id)
  this.status = result.status
  this.body = result
}

exports.getLastBuildDetails = function* () {
  const result = yield flowBuildService.getLastBuildDetailsOfFlow(this.session.loginUser, this.params.flow_id)
  this.status = result.status
  this.body = result
}

exports.listStagesBuilds = function* () {
  const result = yield flowBuildService.getStageBuildsOfFlowBuild(this.session.loginUser, this.params.flow_id, this.params.flow_build_id)
  this.status = result.status
  this.body = result
}

exports.listBuildsOfStage = function* () {
  const result = yield flowBuildService.getBuildsOfStage(this.session.loginUser, this.params.flow_id, this.params.stage_id)
  this.status = result.status
  this.body = result
}

exports.stopBuild = function* () {
  let result = yield flowBuildService.stopFlowBuild(this.session.loginUser, this.params.flow_id, this.params.stage_id, this.params.build_id)
  this.session.auditInfo.resourceId = result.results.flowBuildId
  this.session.auditInfo.clusterId = global.K8SCONFIGS.clusterId
  this.status = result.status
  this.body = result
}

exports.getBuildLogs = function* () {
  const result = yield flowBuildService.getStageBuildLogsFromES(this.session.loginUser,
    this.params.flow_id, this.params.stage_id, this.params.stage_build_id, this.res)
  if (result && result.status) {
    this.status = result.status
    this.body = result
    return
  }
  delete(this.session.loginUser)
  delete(this.session.auditInfo)
  this.status = 200
  this.res.end()
}

exports.getBuildEvents = function* () {
  const result = yield flowBuildService.getBuildEvents(this.session.loginUser,
    this.params.flow_id, this.params.stage_id, this.params.stage_build_id)
  this.status = result.status
  this.body = result
}