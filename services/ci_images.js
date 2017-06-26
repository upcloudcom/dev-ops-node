/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-26
 * @author Lei
 *
 * TenxCloud CI available images service
 *
 */

'use strict'

const CIImages = require('../models').CIImages
const idGenerator = require('../utils/id_generator')
const logger  = require('../utils/logger').getLogger("ci_rule")

const ADMIN_ROLE = 2

exports.getAvailableImages = function* (user) {
  let results = yield CIImages.getImagesByNamespace(user.namespace)
  return {
    status: 200,
    results
  }
}

function isAdminRole(user) {
  if (user.role == ADMIN_ROLE) { // admin role
    return true
  }
  return false
}

exports.isAdminRole = isAdminRole

exports.createNewBaseImage = function* (user, imageInfo) {
  imageInfo.id = idGenerator.getCIMID()
  // imageInfo.namespace = 'tenxcloud' // TODO: fix it later
  imageInfo.namespace = user.namespace
  // imageInfo.is_system = 1
  imageInfo.is_system = isAdminRole(user) ? 1 : 0
  imageInfo.category_name = _getCategoryName(imageInfo.category_id)
  // 用户添加的基础镜像容许删除
  imageInfo.is_allow_deletion = 0
  let results = yield CIImages.createNewBaseImage(imageInfo)
  return {
    status: 200,
    results
  }
}

exports.updateBaseImage = function* (id, user, imageInfo) {
  delete imageInfo.namespace
  imageInfo.is_system = isAdminRole(user) ? 1 : 0
  imageInfo.category_name = _getCategoryName(imageInfo.category_id)
  let results
  if (isAdminRole(user)) {
    results = yield CIImages.updateBaseImageById(id, imageInfo)
  } else {
    results = yield CIImages.updateBaseImage(id, user.namespace, imageInfo)
  }
  imageInfo.id = id
  return {
    status: 200,
    results: imageInfo
  }
}

exports.deleteBaseImage = function* (user, id) {
  let results
  if (isAdminRole(user)) {
    results = yield CIImages.deleteImageById(id)
  } else {
    results = yield CIImages.deleteImage(id, user.namespace)
  }
  return {
    status: 200,
    results
  }
}

function _getCategoryName(category_id) {
  switch(category_id) {
    case 1:
      return "单元测试"
    case 2:
      return "代码编译"
    case 3:
      return "构建镜像"
    case 4:
      return "集成测试"
  }
}
