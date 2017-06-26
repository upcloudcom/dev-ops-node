/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 * 
 */

/**
 * Routes for cd
 * @deprecated
 */
'use strict'

const cdRule = require("../controllers/cd_rule")

module.exports = function(Router) {
  const router = new Router({
    prefix: '/api/v1/cd'
  })

  /*router.get('/rules/:projectId', cdRule.findByProjectId)
  router.post('/rules', cdRule.insertOrUpdate)
  router.put('/rules', cdRule.updateRule)
  router.put('/rules/:projectName/:change', cdRule.updateProjectDeploy)
  router.delete('/rules', cdRule.deleteRuleByRuleId)
  router.get('/rules/getUserRules', cdRule.getUserRules)*/
  return router.routes();
}