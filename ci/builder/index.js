/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-22
 * @author Zhangpc
 * 
 */

/**
 * Service to invoke agent on builder side
 */
'use strict'

const urllib = require('urllib')
class Builder {
  constructor(builderConfig) {
    if (!builderConfig) {
      const error = new Error('Parameter error')
      error.message = 'config is reauired.'
      error.status = 400
      throw error
    }
    this.url = `${builderConfig.agent.protocol}://${builderConfig.config.host}:${builderConfig.agent.agentPort}`
    this.headers = {
      "authorization": 'Basic ' + Buffer(builderConfig.agent.user + ':' + builderConfig.agent.password).toString('base64')
    }
  }

  prepareBuilderUseCache(containerId, envInfo) {
    let endpoint = '/prepareLogAndEnvfile'
    envInfo.containerId = containerId ? containerId : ''
    let options = {
      method: 'POST',
      content: JSON.stringify(envInfo),
      headers: this.headers
    }
    return this._createRequest(endpoint, options)
  }

  healthCheckAagent(endpoint) {
    const reqUrl = this.url + endpoint
    return urllib.request(reqUrl).then(function(result) {
       return true
    }).catch(function(e) {
       return false
    })
  }

  _createRequest(endpoint, options) {
    const reqUrl = this.url + endpoint
    return urllib.requestThunk(reqUrl, options)
  }
}

module.exports = Builder