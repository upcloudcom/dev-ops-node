/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-02
 * @author Lei
 */

/**
 * Controllers for CI flows
 */
'use strict'
const ciFlowService = require('../services/ci_flow')
const ciStageService = require('../services/stage')
const cdDeploymentLogsService = require('../services/cd_deployment_logs')

exports.validateNamespace = function* (next) {
  let isValid = yield ciFlowService.validateNamespace(this.session.loginUser, this.params.flow_id)
  if (!isValid) {
    this.status = 404
    this.body = {
      status: 404,
      message: 'Cannot find this flow in current namespace'
    }
    return
  }
  yield next
}

exports.validateFlowAndSetAuditFlowName = function* (next) {
  let result = yield ciFlowService.getFlowOnly(this.session.loginUser.namespace, this.params.flow_id)
  this.status = result.status
  this.body = result
  if (result.status > 299) {
    return
  }
  this.session.auditInfo.resourceName = result.results.name
  yield next
}

exports.getCIFlows = function* () {
  let isBuildImage = this.query.isBuildImage
  if(isBuildImage){
    isBuildImage = parseInt(isBuildImage)
  }
  const result = yield* ciFlowService.listCIFlow(this.session.loginUser.namespace, isBuildImage ? 1 : 0)
  this.status = result.status
  this.body = result
}
/*
Sample request body to add a new flow
{
  "name": "First CI flow"
}
*/
exports.createCIFlow = function* () {
  var body = this.request.body
  var isBuildImage = this.query.isBuildImage
  if(isBuildImage){
    isBuildImage = parseInt(isBuildImage)
  }
  let result
  if ("application/yaml" === this.req.headers["content-type"] || (this.query.o && 'yaml' === this.query.o)) {
    let bytes = this.req.read()
    if (!bytes) {
      this.status = 400
      this.body = {message: 'No YAML is sepcified'}
      return
    }
    result = yield* ciFlowService.createFlowByYaml(this.session.loginUser, bytes.toString(), this.session.auditInfo, isBuildImage)
    this.session.auditInfo.resourceConfig = bytes.toString()
  } else {
    result = yield* ciFlowService.createCIFlow(this.session.loginUser, body, isBuildImage)
    this.session.auditInfo.resourceName = body.name
  }
  this.session.auditInfo.resourceId = result.flow_id
  this.status = result.status
  this.body = result
}

// Remove flow by id
exports.removeCIFlow = function* () {
  let flowId = this.params.flow_id
  if(flowId.indexOf(',')) {
    flowId = flowId.split(',')
  } else {
    flowId = [flowId]
  }
  const result = yield* ciFlowService.removeCIFlow(this.session.loginUser.namespace, flowId, this.session.auditInfo)
  this.status = result.status
  this.body = result
}

exports.updateCIFlow = function* () {
  const flowId = this.params.flow_id
  var flow = this.request.body
  const result = yield* ciFlowService.updateCIFlow(this.session.loginUser.namespace, flowId, flow)
  this.status = result.status
  this.body = result
}

exports.getCIFlowById = function* () {
  const flowId = this.params.flow_id
  let result
  if ("application/yaml" === this.req.headers["content-type"] || (this.query.o && 'yaml' === this.query.o)) {
    result = yield* ciFlowService.getFlowYamlById(this.session.loginUser.namespace, flowId)
  } else {
    result = yield* ciFlowService.getFlowById(this.session.loginUser.namespace, flowId)
  }
  this.status = result.status
  this.body = result
}

exports.getImagesOfFlow = function* () {
  const flowId = this.params.flow_id
  const result = yield* ciFlowService.getImagesOfFlow(this.session.loginUser, flowId)
  this.status = result.status
  this.body = result
}

exports.listDeploymentLogsOfFlow = function* () {
  const flowId = this.params.flow_id
  const maxCount = this.query.limit
  const result = yield* cdDeploymentLogsService.listLogsOfFlow(this.session.loginUser.namespace, flowId, maxCount)
  this.status = result.status
  this.body = result
}

exports.getCIRules = function* () {
  const result = yield* ciStageService.getFirstStageOfFlow(this.params.flow_id)
  this.status = result.status
  this.body = result
  if (result.status > 299) {
    return
  }
  const rules = ciStageService.extractCIRules(result.results)
  this.body.results = rules
}

exports.updateCIRules = function* () {
  let result = yield* ciStageService.getFirstStageOfFlow(this.params.flow_id)
  this.status = result.status
  this.body = result
  if (result.status > 299) {
    return
  }
  let stage = result.results
  let newStage = ciStageService.replaceCIRules(stage, this.request.body)
  result = yield* ciStageService.updateStageOfFlow(this.session.loginUser, this.params.flow_id, stage.metadata.id, newStage)
  this.status = result.status
  this.body = result
}
