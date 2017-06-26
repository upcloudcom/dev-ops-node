/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-1
 * @author huangxin
 *
 */

/*
 * Controllers for stage
 */
'use strict'

const stageService = require('../services/stage')
const logger = require('../utils/logger').getLogger('controllers/stage')

exports.validateStageAndSetAuditStageName = function* (next) {
  let result = yield stageService.getAndCheckMemberShip(this.params.flow_id, this.params.stage_id)
  if (result.status > 299) {
    this.status = result.status
    this.body = result
    return
  }
  if (this.session.auditInfo.resourceName) {
    this.session.auditInfo.resourceName += `(${result.stage_name})`
  } else {
    this.session.auditInfo.resourceName = result.stage_name
  }
  yield next
}

exports.createStage = function* () {
  let stage = this.request.body
  const result = yield stageService.appendStageIntoFlow(this.session.loginUser, this.params.flow_id, stage)
  if (result.results) {
    this.session.auditInfo.resourceId = result.results.stageId
  }
  if (stage.metadata) {
    this.session.auditInfo.resourceName = stage.metadata.name
  }
  this.status = result.status
  this.body = result
}

exports.listStages = function* () {
  const result = yield stageService.listStagesOfFlow(this.params.flow_id)
  this.status = result.status
  this.body = result
}

exports.getStage = function* () {
  const result = yield stageService.getStageOfFlow(this.params.flow_id, this.params.stage_id)
  this.status = result.status
  this.body = result
}

exports.updateStage = function* () {
  let stage = this.request.body
  const result = yield stageService.updateStageOfFlow(this.session.loginUser, this.params.flow_id, this.params.stage_id, stage)
  if (stage.metadata) {
    this.session.auditInfo.resourceName = stage.metadata.name
  }
  this.status = result.status
  this.body = result
}

exports.removeStage = function* () {
  const result = yield stageService.deleteStageOfFlow(this.params.flow_id, this.params.stage_id, this.session.auditInfo)
  this.status = result.status
  this.body = result
}