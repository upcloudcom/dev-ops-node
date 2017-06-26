/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-10
 * @author Lei
 */

/**
 * Service for Deployment Logs
 */
'use strict'

const DeploymentLogs = require('../models').DeploymentLogs
const logger         = require('../utils/logger').getLogger('service/cd_rule')
const idGenerator    = require('../utils/id_generator')

// Add a new cd rule
exports.createDeploymentLog = function* (log) {
  var method = 'createDeploymentLog'
  // Generate a shortid before insert the new record
  log.id = idGenerator.newCDLogID()
  log.create_time = new Date()
  log.result = JSON.stringify(log.result)
  var result = yield DeploymentLogs.createOneLog(log)

  return result
}

// List CD rules for specified flow
exports.listLogsOfFlow = function* (namespace, flowId, limit) {
  // Default to 10
  if (!limit) {
    limit = 10
  }
  limit = parseInt(limit)
  let results = yield DeploymentLogs.listLogsByFlowId(namespace, flowId, limit)
  // Conver result to json
  results.forEach(function(log) {
    log.result = JSON.parse(log.result)
  })
  if (!results) {
    return {
      status: 200,
      message: 'No CD rule created for now'
    }
  }
  return {
    status: 200,
    total: results.length,
    results
  }
}
