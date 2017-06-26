/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 * 
 */

/**
 * Routes for ci
 */
'use strict'

const auditRouters = require('../configs/audit_routers')

module.exports = function(Router) {
  const router = new Router({
    prefix: auditRouters.prefix
  })

  for (var url in auditRouters.routes) {
    auditRouters.routes[url].forEach(function (auditConfig) {
      // console.info(`set route for [${auditConfig.method}]${url}`)
      auditConfig.middlewares.unshift(url)
      router[auditConfig.method].apply(router, auditConfig.middlewares)
    })
  }

  return router.routes()
}