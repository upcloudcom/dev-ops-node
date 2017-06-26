/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-20
 * @author YangYuBiao
 * 
 */

/**
 * Routes for build_agents
 * @deprecated
 */
'use strict'

const buildAgent = require('../controllers/build_agent')
const buildManagement = require("../controllers/build_management")
const auth = require('../utils/auth')
module.exports=function (Router){
  
  const router=new Router({
    prefix:'/api/v1/buildagents'
  })
  
  router.get('/:name', auth.basicAuth, buildAgent.getBuildAgentByName)
  router.post('/:name', auth.basicAuth, buildAgent.addBuildAgent)
  router.del('/:name', auth.basicAuth, buildAgent.deleteBuildAgentByName)
  router.put('/', auth.basicAuth, buildAgent.updateBulidAgentByName)
  router.put('/:name',  auth.basicAuth, buildAgent.enableBulidAgentByName)

  //router.get('/getfitbuilder',buildManagement.getFitBuilder)
  // router.get('/getfitbuilder/:builderName',buildManagement.getBuilderByName)
  // router.post('/getfitbuilder/:builderName',buildManagement.increaseBuilderWorkload)
  // router.del('/getfitbuilder/:builderName',buildManagement.decreaseBuilderWorkflow)
  // router.post('/getfitbuilder/docker/:builderName',buildManagement.getDockerHandlerByBuilder)
  return router.routes()
}