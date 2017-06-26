/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-21
 * @author YangYuBiao
 * 
 */

/**
 * Routes for build_management
 */
'use strict'

const buildManagementService = require("../services/build_management")
const build_management = require("../ci/imagemgr/build_management")

exports.getFitBuilder = function* (isCache) {
  let result = yield buildManagementService.getFitBuilder(isCache)
  return result
}

exports.increaseBuilderWorkload = function* (){
  let builderName =  this.params.builderName
  return build_management.increaseBuilderWorkload(builderName)
}

exports.decreaseBuilderWorkflow = function* (){
  let builderName =  this.params.builderName
  return build_management.decreaseBuilderWorkflow(builderName)
}
exports.getDockerHandlerByBuilder = function* () {
   let builderName = this.params.builderName
   return build_management.getDockerHandlerByBuilder(builderName)
   
}
exports.getBuilderByName = function* (){
  let builderName = this.params.builderName
  return build_management.getBuilderByName(builderName)
}
