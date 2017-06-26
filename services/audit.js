/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 */

'use strict'
const pathToRegex = require('path-to-regexp')
const auditModal = require('../models').Audit
const util = require('../utils/id_generator')
const routerAndAudit = require('../configs/audit_routers')
const logger = require('../utils/logger').getLogger('service/audit')

const stack = {}

// Get router regex

function init(table) {
  const keys = Object.getOwnPropertyNames(table)
  keys.forEach(key => {
    const path = routerAndAudit.prefix + key
    table[key].forEach(function (router) {
      let regex = pathToRegex(path)
      if(!stack[router.method]) {
        stack[router.method] = []
      }
      delete regex.keys
      regex.router = router
      stack[router.method].push(regex)
    })
  })
}

init(routerAndAudit.routes)
init(routerAndAudit.notificationRouters)

//Test path 
exports.match = function(method, path) {
  if(!stack[method]) return null
  let result
  stack[method].some(item => {
    if(item.test(path)) {
      result = item.router
      return true
    }
    return false
  })
  return result
}

exports.insertToDB = function* (obj) {
  const entity = {
    id: util.newAuditID(),
    namespace: obj.namespace,
    operation_type: obj.auditOperation,
    resource_type: obj.auditResource,
    resource_id: obj.resource_id,
    resource_name: obj.resource_name,
    resource_config: obj.resource_config,
    duration: obj.duration,
    status: obj.status,
    remark: obj.remark,
    url: obj.path,
    http_method: obj.method.toUpperCase(),
    operator: obj.namespace,
    cluster_id: obj.cluster_id
  }
  const result = yield auditModal.create(entity).catch(err => {
    logger.error("insert audit to db error, ", err)
  })
  return
}

