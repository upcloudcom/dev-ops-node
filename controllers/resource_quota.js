/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2017-1-3
 * @author huangxin
 * 
 */

'use strict'

const indexConfig = require('../configs')
const resourceQuotaService = require('../services/resource_quota')

exports.checkCreatedFlowsQuota = function* (next) {
  let self = this
  yield _doCheck(self, next, function* () {
    let result = yield resourceQuotaService.checkFlowCreation(self.session.loginUser)
    return result
  })
}

exports.checkCreatedStagesQuota = function* (next) {
  let self = this
  yield _doCheck(self, next, function* () {
    let result = yield resourceQuotaService.checkStageCreation(self.session.loginUser, 1)
    return result
  })
}

exports.checkRepoQuota = function* (next) {
  let self = this
  yield _doCheck(self, next, function* () {
    let result = yield resourceQuotaService.checkRepo(self.session.loginUser, self.params.type, "Repo")
    return result
  })
}

exports.checkProjectQuota = function* (next) {
  let self = this
  yield _doCheck(self, next, function* () {
    let result = yield resourceQuotaService.checkRepo(self.session.loginUser, self.request.body.repo_type, "Project")
    return result
  })
}

function* _doCheck (self, next, checker) {
  if ('standard' === indexConfig.mode) {
    //公有云服务判断资源限制
    let result = yield checker()
    if (result.status !== 200) {
      self.status = result.status
      self.body = result
      return
    }
  }
  yield next
}