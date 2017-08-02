/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2017 TenxCloud. All Rights Reserved.
 * v0.1 - 2017-06-29
 * @author lizhen
 */

/**
 * Controllers for CI scripts
 */

'use strict'

const ciScriptService = require('../services/ci_scripts')

exports.getScriptByID = function* () {
  const id = this.params.id
  const result = yield ciScriptService.getScriptByID(id)
  this.status = result.status
  this.body = result
}

exports.addScript = function* () {
  const content = this.request.body.content
  if (!content) {
    this.status = 400
    this.body = {
      status: 400,
      message: "empty content"
    }
    return
  }
  const result = yield ciScriptService.addScript(content)
  this.status = result.status
  this.body = result
}

exports.updateScriptByID = function* () {
  const id = this.params.id
  const content = this.request.body.content
  const result = yield ciScriptService.updateScriptByID(id, content)
  this.status = result.status
  this.body = result
}

exports.deleteScriptByID = function* () {
  const id = this.params.id
  const result = yield ciScriptService.deleteScriptByID(id)
  this.status = result.status
  this.body = result
}
