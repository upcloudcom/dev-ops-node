/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-20
 * @author YangYuBiao
 * 
 */

/**
 * Routes for build_agents
 */

 'use strict'

const lodash = require('lodash')
const buildAgentService = require('../services/build_agent')
 
exports.getBuildAgentByName=function* (){
  let name = this.params.name
  if(!name){
    return this.body={status:0,result:'the name is must'}
  }
  let build_agent = yield buildAgentService.getBuildAgentByName(name)
  this.status = 200
  this.body = { result: build_agent }
}

exports.addBuildAgent = function* () {
  let body = this.request.body
  if(!body||!body.name||!body.config||!body.agent){
    this.status = 400
    return this.body = { result:'the buildAgent information is must' }
  }
  let isExit = yield buildAgentService.getBuildAgentByName(body.name)
  if(isExit){
     this.status = 200
     return this.body = { message: 'the buildAgent name is already existing' }
  } 
  body.agent.user = process.env.SYSTEM_USER || 'system'
  body.agent.password = process.env.SYSTEM_PASSWORD || '31e120b3-512a-4e3b-910c-85c747fb1ec2'
  let buildAgent = {
     name: body.name,
     config: JSON.stringify(body.config),
     agent: JSON.stringify(body.agent)
  }
  let result = yield buildAgentService.addBuildAgent(buildAgent)
  this.status = result.status
  this.body = { message: result.message }
}

exports.deleteBuildAgentByName = function* () {
  let name = this.params.name
  if (!name) {
    this.status = 400
    return this.body = { message: 'the name of builder is must' }
  }
  let result = yield buildAgentService.deleteBuildAgentByName(name)
  this.status = result.status
  this.body = { message: result.message }
}

exports.updateBulidAgentByName = function* () {
  let body = this.request.body
  let name = body.name
  if(!name){
    this.status = 400
    this.body = { message: 'the name of buildAgent is must' }
  }
  delete body.name
  let value = lodash.clone(body);
  lodash.forEach(value,function(itemValue,key){
    value[key] = JSON.stringify(itemValue)
  })
  value.createTime = new Date()
  let result = yield buildAgentService.updateBulidAgentByName(name,value)
  this.status = result.status
  this.body = { message: result.message }
}

exports.enableBulidAgentByName = function* () {
  let agentName = this.params.name
  if(!agentName || !agentName.trim()) {
    this.status = 400
    this.body = { message: 'The agent name is required'}
    return
  }
  buildAgentService.enableBulidAgentByName(agentName)
  this.status = 200
  this.body = { message: 'Success' }
}
