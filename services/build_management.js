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

const buildAgentModel = require('../models').BuildAgent
const ImageBuilder = require('../ci/imagemgr/image_builder')
const buildModel = require('../models').Build
const isHave = false

function* _getAllAgent () {
  let result = yield buildAgentModel.getAllAgent()
  let generatorArray = []
  result.forEach(function(item){
    generatorArray.push(function* () {
     let count = yield buildModel.findBuildByBuilderAddr(item.name)
     return {
        name: item.name,
        count: count   
      }
    })
  }) 
  let builderBuildAndWaitCount = yield generatorArray
  ImageBuilder.setAgent(result,builderBuildAndWaitCount)
  if(result){
    return true
  }
  return false
}

exports.getFitBuilder = function* (isCache){
  if (!isHave||!isCache) {
    yield _getAllAgent()
  }
  let result = new ImageBuilder()
  return result.builder
}