/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-27
 * @author YangYuBiao
 *
 */

/**
 * Routes for ci_rule
 */

'use strict'

const ciRuleService = require('../services/ci_rule')
const projectService = require('../services/project')
const repoService = require('../services/repo')

exports.insertOrUpdate = function* (next) {
  let entity = this.request.body
  if (!entity) {
    this.status = 400
    // this.body = { message: "请输入rule规则" }
    this.body = {
      message: "Please enter a continuous integration rules."
    }
    return
  }
  let projectName = entity.projectName
  let result = yield ciRuleService.insertOrUpdate(entity.data)
  if (result.status !==200 ) {
    this.status = result.status
    return this.body = { message: result.message }
  }
  const user = this.session.loginUser
  let updateChange = yield projectService.updateProject(user, projectName, { buildOnChange:1 })
  if (updateChange.status !== 200) {
    this.status = updateChange.status
    return this.body = { message: updateChange.message }
  }
  let projectInfo = yield projectService.getProject(user, projectName)
  let webhook = yield repoService.createWebhook(user, projectInfo.results)
  if (webhook.status === 200 && !webhook.result.hook_id) {
    this.status = 500
    return this.body = { message: `cant't create webhook` }
  }
  if (projectInfo.webhok_id && projectInfo.webhook_id === webhook.result.hook_id) {
    this.status = 200
    return this.body = { message: 'success' }
  }
  let updateData = { webhook_id: webhook.result.hook_id }
  if (webhook.status === 500) {
    updateData.webhook_initialized = '-1'
    let updatewebhook = yield projectService.updateProject(user, projectName, updateData)
    this.status = 200
    return this.body = { message: { webhook_initialized: '-1' } }
  }
  let updatewebhook = yield projectService.updateProject(user, projectName, updateData)
  if (updatewebhook.status !== 200) {
    this.status = updatewebhook.status
    return this.body = { message: updatewebhook.message }
  }

  this.status = 200
  return this.body = { message: 'success' }
}

exports.findByProjectId = function* (next) {
  let projectId = this.params.projectId
  let result = yield ciRuleService.findByProjectId(projectId)
  this.status = result.status
  this.body = { message: result.message }
}

exports.getOneRuleByRuleId = function* (next) {
  let result = yield ciRuleService.find
}

exports.updateRule = function* (next) {
  let entity = this.request.body
  if (entity) {
    this.status = 400
    this.body = { message: "the update value is must" }
  }
  let result = yield ciRuleService.updateRule(entity)
  this.status = result.status
  this.body = { message: result.message }
}

exports.deleteRuleByRuleId = function* () {
  let ruleId = this.query.ruleId
  let change = this.query.change
  let projectName = this.query.projectName
  let result = yield ciRuleService.deleteByCondition({ ruleId })
  if (result.status !==200 ) {
    this.status = result.status
    return this.body = { message: result.message }
  }
  if (change == '0') {
    let updateChange = yield projectService.updateProject(this.session.loginUser, projectName, { buildOnChange: change })
    if (updateChange.status !== 200) {
      this.status = updateChange.status
      return this.body = { message: updateChange.message }
    }
  }
  this.status = 200
  return this.body = { message: 'success' }
}

exports.updateProjectChange = function* () {
  let projectName = this.params.projectName
  let change = this.params.change
  let updateChange = yield projectService.updateProject(this.session.loginUser, projectName, { buildOnChange:change })
  this.status = updateChange.status
  this.body =  { message: updateChange.message }
}

