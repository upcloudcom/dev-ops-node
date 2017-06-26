/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2017-1-3
 * @author huangxin
 *
 */

'use strict'

const CIFlow = require('../models').CIFlow
const Stage = require('../models').Stage
const ResourceQuota = require('../models').ResourceQuota
const serviceUtils = require('./utils')
const logger = require('../utils/logger').getLogger('service/repo')
const clone = require('lodash/cloneDeep')

let STANDARD_QUOTA = {
  limit_details: {
    devops: {
      repo: 'github/gitlab/svn',
      flow: 50,
      stage: 200,
    }
  }
}

let PROFESSIONAL_QUOTA = {
  limit_details: {
    devops: {
      repo: 'github/gitlab/svn',
      flow: 100,
      stage: 400,
    }
  },
  limit_type: 2
}

exports.checkFlowCreation = function* (user) {
  let quota = yield _getUserQuota(user)
  let num = yield CIFlow.countBySpace(user.namespace)
  if (num < quota.limit_details.devops.flow) {
    return {
      status: 200
    }
  }
  return _preconditionErr("TenxFlow", "Too many TenxFlows", quota)
}

exports.checkStageCreation = function* (user, count) {
  let quota = yield _getUserQuota(user)
  let result = yield Stage.countBySpace(user.namespace)
  count = count ? count : 0
  if (result && result.length > 0 && result[0].num + count <= quota.limit_details.devops.stage) {
    return {
      status: 200
    }
  }
  return _preconditionErr("Stage", "Too many Stages", quota)
}

exports.checkRepo = function* (user, type, kind) {
  let quota = yield _getUserQuota(user)
  let repoList = quota.limit_details.devops.repo.split('/')
  for (var i = 0; i < repoList.length; i++) {
    if (repoList[i] === type) {
      return {
        status: 200
      }
    }
  }
  return _preconditionErr(kind, "Unallowed Repo type", quota)
}

function* _getUserQuota (user) {
  let quota = clone(STANDARD_QUOTA)
  if (user.env_edition === 1) {
    quota = clone(PROFESSIONAL_QUOTA)
    let data = yield ResourceQuota.findOneByNamespace(user.namespace)
    if (data) {
      try {
        data.limit_details = JSON.parse(data.limit_details)
      } catch (e) {
        logger.error('_getUserQuota - Failed to parse quota details:', e)
      }
      quota.limit_type = data.limit_type
      Object.assign(quota.limit_details.devops, data.limit_details.devops)
    }
  }
  return quota
}

function _preconditionErr(kind, message, quota) {
  let level
  if (quota.limit_type) {
    level = quota.limit_type + ''
  }
  return serviceUtils.responsePreconditionError("Too many TenxFlows", "DevOps", level)
}