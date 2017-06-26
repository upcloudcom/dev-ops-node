/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-04
 * @author Lei
 */

/**
 * Controllers for CD rules
 */
'use strict'
const cdRuleService = require('../services/cd_rule')

exports.listCDRules = function* () {
  const flow_id = this.params.flow_id
  const result = yield* cdRuleService.listCDRules(this.session.loginUser.namespace, flow_id)
  this.status = result.status
  this.body = result
}

/*
Sample request body to add a new flow
{
  "image_name": "wanglei/test",
  "tag": "v1.0",
  "binding_service": "223344",
  "upgrade_strategy": 1 # 1=>Direct upgrade, 2=>Rolling upgrade
}
*/
exports.createCDRule = function* () {
  var body = this.request.body
  const flow_id = this.params.flow_id

  const result = yield* cdRuleService.createCDRule(this.session.loginUser.namespace, flow_id, body)
  this.session.auditInfo.resourceId = result.rule_id
  this.status = result.status
  this.body = result
}

exports.removeCDRule = function* () {
  const flow_id = this.params.flow_id
  const rule_id = this.params.rule_id

  const result = yield* cdRuleService.removeCDRule(this.session.loginUser.namespace, flow_id, rule_id)
  this.status = result.status
  this.body = result
}

exports.updateCDRule = function* () {
  const flow_id = this.params.flow_id
  const rule_id = this.params.rule_id
  var rule = this.request.body

  const result = yield* cdRuleService.updateCDRule(this.session.loginUser.namespace, flow_id, rule_id, rule)
  this.status = result.status
  this.body = result
}

exports.getDeploymentCDRule = function* () {
  const cluster = this.query.cluster
  let name = this.query.name
  if(!cluster || !name) {
    this.status = 400
    this.body = {
      status: 400,
      message: 'cluster and name is require'
    }
    return
  }
  name = name.split(',')
  const result = yield cdRuleService.getDeploymentCDRule(this.session.loginUser.namespace, cluster, name)
  this.status = result.status
  this.body = result
}

exports.deleteDeploymentCDRule = function* () {
  const cluster = this.query.cluster
  let name = this.query.name
  if(!cluster || !name) {
    this.status = 400
    this.body = {
      status: 400,
      message: 'cluster and name is require'
    }
    return
  }
  name = name.split(',')
  const result = yield cdRuleService.deleteDeploymentCDRule(this.session.loginUser.namespace, cluster, name)
  this.session.auditInfo.clusterId = cluster
  this.session.auditInfo.resourceName = name.join(',')
  this.status = result.status
  this.body = result
}
