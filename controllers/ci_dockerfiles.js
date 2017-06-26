/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-08
 * @author Lei
 */

/**
 * Controllers for CI dockerfiles
 */
'use strict'
const ciDockerfileService = require('../services/ci_dockerfiles')

exports.listDockerfiles = function* () {
  const result = yield* ciDockerfileService.listDockerfiles(this.session.loginUser.namespace)
  this.status = result.status
  this.body = result
}

exports.addDockerfile = function* () {
  var body = this.request.body
  const flow_id = this.params.flow_id
  const stage_id = this.params.stage_id
  const result = yield* ciDockerfileService.addDockerfile(this.session.loginUser, flow_id, stage_id, body)
  this.status = result.status
  this.body = result
}

exports.removeDockerfile = function* () {
  const flow_id = this.params.flow_id
  const stage_id = this.params.stage_id
  const result = yield* ciDockerfileService.removeDockerfile(this.session.loginUser.namespace, flow_id, stage_id)
  this.status = result.status
  this.body = result
}

exports.getDockerfile = function* () {
  const flow_id = this.params.flow_id
  const stage_id = this.params.stage_id
  const result = yield* ciDockerfileService.getDockerfile(this.session.loginUser.namespace, flow_id, stage_id)
  this.status = result.status
  this.body = result
}

exports.addOrUpdateDockerfile = function* () {
  const flow_id = this.params.flow_id
  const stage_id = this.params.stage_id
  var body = this.request.body
  const result = yield* ciDockerfileService.addOrUpdateDockerfile(this.session.loginUser.namespace, flow_id, 
    stage_id, this.session.loginUser.name, body)
  this.status = result.status
  this.body = result
}