/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-07-01
 * @author Zhangpc
 * 
 */

/**
 * request url
 */
'use strict'

const urllib = require('urllib')
const logger = require('../../../utils/logger').getLogger('coderepo/_request')
const TIMEOUT = 1000 * 30

module.exports = function (name) {
  return function request(url, options) {
    // Gitlab require this option
    if (!options) {
      options = { dataType: 'json' }
    } else if (!options.dataType) {
      options.dataType = 'json'
    }
    options.timeout = TIMEOUT
    return urllib.request(url, options).then((result) => {
      if (result.status >= 500) {
        let error = new Error(`${name} server error occurred`)
        error.status = result.status
        logger.error(name, result.data)
        throw error
      }
      if (result.status >= 300) {
        let error = new Error(`${name} api error` + JSON.stringify(result))
        error.status = result.status
        if (result.data && result.data.message) {
          error.message = result.data.message
        }
        throw error
      }
      return {
        data: result.data,
        headers: result.res.headers
      }
    })
  }
}