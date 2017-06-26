/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-27
 * @author YangYuBiao
 *
 * Tenxcloud ci_rule services
 *
 */

'use strict'

const logger = require('../utils/logger').getLogger("ci_rule")
const uuid = require('node-uuid')
const ciRuleModel = require('../models').CIRule
const changeColumn = ['type', 'name', 'dockerfileLocation', 'tag', 'updateType']

exports.insertOrUpdate = function* (object) {
  var generatorArray = []
  object.forEach(function (item) {
    generatorArray.push(function* () {
      yield ciRuleModel.upsert(item)
    })
  })
  yield generatorArray
  return { status: 200, message: "success" }
}

exports.findByProjectId = function* (projectId) {
  let result = yield ciRuleModel.findAllRuleByCondition({
    projectId,
    is_delete: '0'
  })
  // return result ? { status: 200, message: result } : { status: 400, message: `没有本条记录` }
  if (!result) {
    return {
      status: 400,
      message: `Project ${projectId} has no ci rules.`
    }
  }
  return {
    status: 200,
    message: result
  }
}

exports.deleteByCondition = function* (condition) {
  let result = yield ciRuleModel.deleteByCondition(condition)
  // return result > 0 ? { status: 200, message: "success" } : { status: 400, message: '该规则不存在' }
  if (result < 1) {
    return {
      status: 400,
      message: `Can not find ci rules by the condition.`
    }
  }
  return {
    status: 200,
    message: "success"
  }
}

exports.updateRule = function* (entity) {
  entity = _formateWebToEntiy(entity)
  let result = yield ciRuleModel.update(entity, { ruleId: entity.ruleId })
  // return result[0] > 0 ? { status: 200, message: "success" } : { status: 500, message: '该规则不存在' }
  if (result[0] < 1) {
    return {
      status: 400,
      message: `This rule does not exist.`
    }
  }
  return {
    status: 200,
    message: "success"
  }
}

exports.findAllByCondition = function* (condition) {
  let result = yield ciRuleModel.findAllRuleByCondition(condition)
  return result
}

function _formateWebToEntiy(web) {
  return {
    type: web.type,
    name: web.name,
    dockerfileLocation: web.dockerfileLocation,
    tag: web.tag,
    updateType: web.updateType
  }
}