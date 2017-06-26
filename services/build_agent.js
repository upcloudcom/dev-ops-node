/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-13
 * @author YangYuBiao
 * 
 * Tenxcloud buildAgent services
 * 
 */
'use strict'

const buildAgentModel = require('../models').BuildAgent
const buildModel = require('../models').Build
const buildManagement = require('../ci/imagemgr/build_management')
const logger = require('../utils/logger').getLogger('service/build_agent')
const buildCheck = require('../ci/builder')

exports.getBuildAgentByName = function* (name) {
  let result = yield buildAgentModel.getBuildAgentByName(name);
  return result
}

exports.addBuildAgent = function* (buildAgent) {
  let result = yield buildAgentModel.addBuildAgent(buildAgent)
  buildManagement.init()
  return result ? { status: 200, message: 'successful' } : { status: 500, message: 'have some error' }
}

exports.deleteBuildAgentByName = function* (name) {
  let result = yield buildAgentModel.deleteBuildAgentByName(name)
  buildManagement.init()
  return result ? { status: 200, message: 'successful' } : { status: 500, message: `the buidlAgent of ${name} is not exit` }
}

exports.updateBulidAgentByName = function* (name, value) {
  let result = yield buildAgentModel.updateBulidAgentByName(name, value)
  buildManagement.init()
  if (!result) return { status: 500, message: `the builder of ${name} is not exit` }
  return result[0] > 0 ? { status: 200, message: 'update successful' } : { status: 500, message: `the builder of ${name} is not exit` }
}

exports.getFitBuilder = function (isCache, projectId) {
  return new Promise(function (res, rej) {
    /*if (isCache === 'off') {
      const builder = buildManagement.getFitBuilder()
      resovel(builder)
      return
    }*/
    buildModel.getProjectLastBuild(projectId).then(function (lastBuild) {
      if (lastBuild) {
        const builder = buildManagement.getBuilderByName(lastBuild.builder_addr)
        builder.containerId = lastBuild.container_id
        let buildCheckApi = new buildCheck(builder)
        getHealthAgent(new Promise(function(resolve, reject) {
          buildCheckApi.healthCheckAagent('/health').then(function (health) {
            resolve({
              agent: builder,
              health: health
            })
          })
        })).then(function(fitBuilder) {
          if(!fitBuilder) {
            rej(new Error("Can't find usable builder"))
          }
          res(fitBuilder)
        })
        return
      }
      getHealthAgent(new Promise(function(resolve, reject) {
        let fitBuilder = buildManagement.getFitBuilder()
        if (!fitBuilder) {
          rej(new Error("Can't find usable builder"))
        }
        let buildCheckApi = new buildCheck(fitBuilder) 
        buildCheckApi.healthCheckAagent('/health').then(function (health) {
          resolve({
            agent: fitBuilder,
            health: health
          })
        })
      })).then(function(fitBuilder) {
        if (!fitBuilder) {
          rej(new Error("Can't find usable builder"))
        }
        res(fitBuilder)
      })
    })
  }).catch(function(err) {
    err.status = 504
    throw err
  })
}

exports.getBuilderByName = function (builderName) {
  return buildManagement.getBuilderByName(builderName)
}

exports.increaseBuilderWorkload = function (builderName) {
  return buildManagement.increaseBuilderWorkload(builderName)
}

exports.decreaseBuilderWorkflow = function (builderName) {
  return buildManagement.decreaseBuilderWorkflow(builderName)
}

exports.enableBulidAgentByName = function (agentName) {
  return buildManagement.enableBulidAgentByName(agentName)
}


function getHealthAgent(promise) {
  'use strict'
  return new Promise(function (res, rej) {
    recursionPromise(promise, res)
  })
  function recursionPromise(promise, res) {
    promise.then(function (obj) {
      if (obj.health) {
        return res(obj.agent)
      } else {
        buildManagement.disableBulidAgentByName(obj.agent.name)
        recursionPromise(new Promise(function (resolve, reject) {
          let fitBuilder = buildManagement.getFitBuilder()
          if (!fitBuilder) {
            return resolve({
              agent: null,
              health: true
            })
          }
          let buildCheckApi = new buildCheck(fitBuilder)
          buildCheckApi.healthCheckAagent('/health').then(function (health) {
            resolve({
              agent: fitBuilder,
              health: health
            })
          })
        }), res)
      }
    })
  }
}

