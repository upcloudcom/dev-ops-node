/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-04
 * @author Lei
 */

/**
 * Service for CD rules
 */
'use strict'

const CDRule           = require('../models').CDRule
const logger           = require('../utils/logger').getLogger('service/cd_rule')
const idGenerator      = require('../utils/id_generator')
const kuberneteService = require('../services/kubernete_service')

// Add a new cd rule
exports.createCDRule = function* (namespace, flow_id, rule) {
  var method = 'createCDRule'
  var resData = {}
  rule.flow_id = flow_id
  if (!_isValidRule(rule)) {
    resData.status = 400
    resData.message ='Missing required fields of this rule'
    return resData
  }
  // Check if the cluster/deployment exists
  let k8sService = yield kuberneteService.getKuberneteService(rule.binding_service.cluster_id)
  if (!k8sService) {
    return {
      status: 404,
      "message": "The specified cluster does not exist"
    }
  }
  let deployment = yield k8sService.getDeploymentByName(namespace, rule.binding_service.deployment_name)
  if (!deployment || deployment.statusCode) {
    return {
      status: deployment.statusCode,
      "message": "Failed to validate service information: " + JSON.stringify(deployment)
    }
  }
  if (rule.binding_service.deployment_id != deployment.metadata.uid) {
    return {
      status: 400,
      "message": "The uid of specified service does not match"
    }
  }
  // Check if the cd rule alreay exists
  let matchedRule = yield CDRule.findMatchingRule(namespace, flow_id, rule.image_name, rule.match_tag,
    rule.binding_service.cluster_id, rule.binding_service.deployment_name)
  if (matchedRule) {
    return {
      status: 409,
      "message": "CD rule matching the same conditions already exists"
    }
  }
  // Generate a shortid before insert the new record
  rule.rule_id = idGenerator.newCDRuleID()
  rule.create_time = new Date()
  rule.binding_cluster_id = rule.binding_service.cluster_id
  rule.binding_deployment_id = rule.binding_service.deployment_id
  rule.binding_deployment_name = rule.binding_service.deployment_name
  var result = yield CDRule.createOneRule(namespace, rule)

  return {
    status: 200,
    "rule_id": rule.rule_id,
    "message": "CD rule was created successfully"
  }
}

// List CD rules for specified flow
exports.listCDRules = function* (namespace, flowId) {
  let results = yield CDRule.listRulesByFlowId(namespace, flowId)
  if (!results) {
    return {
      status: 200,
      message: 'No CD rule defined yet'
    }
  }
  return {
    status: 200,
    total: results.length,
    results
  }
}

// Remove a CD rule
exports.removeCDRule = function* (namespace, flowId, ruleId) {
  let results = yield CDRule.removeRule(namespace, flowId, ruleId)

  if (!results || results < 1) {
    return {
      status: 404,
      message: "No rule found mathcing the rule id"
    }
  }
  return {
    status: 200,
    message: "CD rule was removed successfully"
  }
}

// Update a CD rule
exports.updateCDRule = function* (namespace, flowId, ruleId, rule) {
  // Update the update time
  rule.update_time = new Date()
  rule.binding_cluster_id = rule.binding_service.cluster_id
  rule.binding_deployment_id = rule.binding_service.deployment_id
  rule.binding_deployment_name = rule.binding_service.deployment_name
  let results = yield CDRule.updateRuleById(namespace, flowId, ruleId, rule)
  if (!results || results < 1) {
    return {
      status: 404,
      message: "No rule found mathcing the rule id"
    }
  }
  return {
    status: 200,
    message: "CD rule was updated successfully"
  }
}

// get Deployment CDRule
exports.getDeploymentCDRule = function*(namespace, cluster, name) {
  if(!Array.isArray(name)) {
    name = [name]
  }
  let results =  yield CDRule.findDeploymentCDRule(namespace, cluster, name)
  return {
    status: 200,
    total: results ? results.length : 0,
    results: results ? results : []
  }
}

exports.deleteDeploymentCDRule = function*(namespace, cluster, name) {
  if(!Array.isArray(name)) {
    name = [name]
  }
  let results = yield CDRule.deleteDeploymentCDRule(namespace, cluster, name)
  return {
    status: 200,
    message: 'delete cd rule success'
  }
}


function _isValidRule(rule) {
  var method = "_isValidRule"
  if (!rule) {
    return false
  }
  if (!rule.flow_id || !rule.image_name || !rule.match_tag || !rule.binding_service || (rule.upgrade_strategy != 1 && rule.upgrade_strategy != 2)) {
    logger.error(method, "Invalid flow_id, image_name, tag, binding_service or upgrade_strategy")
    return false
  }
  if (!rule.binding_service.cluster_id || !rule.binding_service.deployment_id || ! !rule.binding_service.deployment_name) {
    logger.error(method, "Invalid binding_cluster_id, binding_deployment_id or binding_deployment_name")
  }
  return true
}
