/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-18
 * @author huangxin
 *
 */

/**
 * Routes for health handler route
 */
'use strict'

const stats = require('../controllers/stats')

module.exports = function (Router) {
  const router = new Router({
    prefix: '/api/v2/devops'
  })
  router.get('/health', stats.collectServerStats)
  router.get('/stats', stats.collectServerStats)

  return router.routes()
}
