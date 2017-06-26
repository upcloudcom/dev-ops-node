/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-01
 * @author Lei
 */

/**
* Helper for ID generator
*
*/

'use strict'

const shortid = require('shortid')

// ID prefix for managed projects
const MANAGED_PROJECT_ID_PREFIX = "MPID-"

const STAGE_ID_PREFIX = "CISID-"

const FLOW_BUILD_ID_PREFIX = "FBID-"

const STAGE_BUILD_ID_PREFIX = "SBID-"

// ID prefix for CI flow
const CI_FLOW_ID_PREFIX = "CIFID-"

// ID prefix for CI images
const CI_IMAGES = "CIMID-"

// ID prefix for CD rule
const CD_RULE_ID_PREFIX = "CDRID-"

// ID prefix for Audit
const AUDIT_ID_PREFIX = "AUDID-"

// ID prefix for Deployment log
const CD_DEPLOYMENT_LOG_ID_PREFIX = "CDLID-"

// Return new id for managed project
exports.newManagedProjectID = function() {
  return _generateID(MANAGED_PROJECT_ID_PREFIX)
}

exports.newStageID = function () {
  return _generateID(STAGE_ID_PREFIX)
}

exports.newFlowBuildID = function () {
	return _generateID(FLOW_BUILD_ID_PREFIX)
}

exports.newStageBuildID = function () {
  return _generateID(STAGE_BUILD_ID_PREFIX)
}

// Return new id for CI flow
exports.newCIFlowID = function() {
  return _generateID(CI_FLOW_ID_PREFIX)
}

exports.getCIMID = function() {
  return _generateID(CI_IMAGES)
}

// Return new id for CD rule
exports.newCDRuleID = function() {
  return _generateID(CD_RULE_ID_PREFIX)
}

// Return new id for CD rule
exports.newAuditID = function() {
  return _generateID(AUDIT_ID_PREFIX)
}

// Return new id for deployment log
exports.newCDLogID = function() {
  return _generateID(CD_DEPLOYMENT_LOG_ID_PREFIX)
}

function _generateID(prefix) {
  let _shortid = shortid.generate()
  let lastChar = _shortid.substr(-1)
  while (lastChar === '-' || lastChar === '_') {
    _shortid = shortid.generate()
    lastChar = _shortid.substr(-1)
  }
  return prefix + _shortid
}
