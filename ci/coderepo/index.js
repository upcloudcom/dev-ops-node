/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-06-21
 * @author Zhangpc
 *
 */

/**
 * Index for all APIs
 */
'use strict'
const path = require('path')

class CodeRepoApis {
  constructor(depot, repoInfo) {
    if (!depot) {
      const error = new Error('Parameter error')
      error.message = 'depot is required.'
      error.status = 400
      throw error
    }
    let repoAPI
    try {
      // For webpack: the request of a dependency must be not an expression
      repoAPI = require(`./api/${depot}`)
    } catch (error) {
      error = new Error(`${depot} api not found.`)
      error.status = 404
      throw error
    }
    return new repoAPI(repoInfo)
  }
}

module.exports = CodeRepoApis