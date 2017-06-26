/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-21
 * @author YangYuBiao
 *
 */

/**
 * build_management
 */
'use strict'

const fs = require('fs')
const path = require('path')
const co = require('co')
const _ = require('lodash')
const buildModel = require('../../models').Build
const buildAgentModel = require('../../models').BuildAgent
const lodash = require('lodash')
const logger = require('../../utils/logger').getLogger('build_management');
const DockerUtil = require('../../docker/dockerUtil')

const BUILDAGENTS = {}
const DIRECTORY = []
const MAPDIRECTORY = {}
let isInit = false

exports.init = function () {
  co(function* init() {
    const result = yield* initBuildAgents()
    return result
  }).then(function (value) {
    // logger.info('build agents init successfully')
  })
}

function* initBuildAgents() {
  const method = 'initBuildAgents'
  let agents = yield buildAgentModel.getAllAgent()
  if (!agents || agents.length < 1) {
    const message = 'build agents init failed, no agents found.'
    logger.error(method, message)
    throw new Error(message)
  }
  logger.info(method, 'build agents init successfully.')
  let generatorArray = []
  agents.forEach(function (item) {
    generatorArray.push(function* () {
      let count = yield buildModel.findBuildByBuilderAddr(item.name)
      return {
        name: item.name,
        count: count
      }
    })
  })
  let builderBuildAndWaitCount = yield generatorArray
  agents.forEach(function (item) {
    var tempObj = {
      'name': item.name,
      'workloadNumber': lodash.find(builderBuildAndWaitCount, { name: item.name }).count,
      'disabled': false
    }
    item.config = JSON.parse(item.config)
    item.config.ca = fs.readFileSync(path.join(__root__dirname, `sslkey/imagebuilder/${item.name}/client/ca.pem`))
    item.config.cert = fs.readFileSync(path.join(__root__dirname, `sslkey/imagebuilder/${item.name}/client/cert.pem`))
    item.config.key = fs.readFileSync(path.join(__root__dirname, `sslkey/imagebuilder/${item.name}/client/key.pem`))

    item.agent = JSON.parse(item.agent)

    BUILDAGENTS[item.name] = item
    DIRECTORY.push(tempObj)
    MAPDIRECTORY[item.name] = tempObj
  })
  isInit = true
  return true
}
exports.initBuildAgents = initBuildAgents

exports.increaseBuilderWorkload = function (builderName) {
  var method = 'increaseBuilderWorkload';
  logger.info(method, 'Increase the workload of ' + builderName);
  if (MAPDIRECTORY[builderName]) {
    return MAPDIRECTORY[builderName].workloadNumber++
  }
  throw new Error('the builder of ' + builderName + ' is not exit')
}

exports.decreaseBuilderWorkflow = function (builderName) {
  var method = 'decreaseBuilderWorkflow';
  logger.info(method, 'Decrease the workload of ' + builderName);
  if (MAPDIRECTORY[builderName]) {
    return MAPDIRECTORY[builderName].workloadNumber--
  }
  throw new Error('the builder of ' + builderName + ' is not exit')
}

function getFitBuilder() {
  let builderAgent = []
  DIRECTORY.forEach(item => {
    if(item.disabled === true) {
      return item.workloadNumber = 0
    }
    builderAgent.push(item)
  })
  let result = lodash.sortBy(builderAgent, 'workloadNumber')[0]
  if(!result) {
    return null
  }
  return  _.cloneDeep(BUILDAGENTS[result.name])
}
exports.getFitBuilder = getFitBuilder

exports.getBuilderByName = function (builderName) {
  let builder = BUILDAGENTS[builderName]
  if (!builder) {
    builder = getFitBuilder()
  }
  return _.cloneDeep(builder)
}

exports.getDockerHandlerByBuilder = function (builderName) {
  var matchedBuilder = BUILDAGENTS[builderName]
  if (matchedBuilder) {
    return new DockerUtil(matchedBuilder.config);
  }
  throw new Error('the builder of ' + builderName + ' is not exit')
}

exports.disableBulidAgentByName = function(agentName) {
  DIRECTORY.some(item => {
    if(item.name === agentName) {
      item.disabled = true
      return true
    }
  })
}

exports.enableBulidAgentByName = function(agentName) {
  DIRECTORY.some(item => {
    if(item.name === agentName) {
      item.disabled = false
      return true
    }
  })
}