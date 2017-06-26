/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-08
 * @author Lei
 */

/**
 * Service for ci dockerfiles
 */
'use strict'

const CIDockerfiles = require('../models').CIDockerfiles
const Stage         = require('../models').Stage
const logger        = require('../utils/logger').getLogger('service/repo')
const idGenerator   = require('../utils/id_generator')

// List dockerfiles for specified namespace
exports.listDockerfiles = function* (namespace) {
  let results = yield CIDockerfiles.listDockerfiles(namespace)
  if (!results) {
    return {
      status: 200,
      message: 'No dockerfiles added yet'
    }
  }
  // Remove unnecessary info from the result
  results.forEach(function(file) {
    file.content = undefined
    file.update_time = (file.update_time ? file.update_time : file.create_time)
  })
  return {
    status: 200,
    total: results.length,
    results
  }
}

// List dockerfiles for specified namespace
exports.addDockerfile = function* (user, flow_id, stage_id, body) {
  // Check if exist
  let result = yield Stage.findOneById(stage_id)
  if (!result || result.length < 1) {
    return {
      status: 404,
      "message": "Stage " + stage_id + " does not exist yet."
    }
  }
  // Check if dockerfile already exist before add a new one
  result = yield CIDockerfiles.getDockerfile(user.namespace, flow_id, stage_id)
  if (result) {
    return {
      status: 409,
      "message": "Dockerfile for this stage already exists"
    }
  }
  var dockerfile = {
    flow_id: flow_id,
    stage_id: stage_id,
    namespace: user.namespace,
    content: body.content,
    modified_by: user.name,
    create_time: new Date(),
    update_time: new Date()
  }
  let results = yield CIDockerfiles.addDockerfile(dockerfile)
  return {
    status: 200,
    message: "Dockerfile added successfully."
  }
}

// Remove dockerfile
exports.removeDockerfile = function* (namespace, flowId, stageId) {
  let results = yield CIDockerfiles.removeDockerfile(namespace, flowId, stageId)

  if (!results || results < 1) {
    return {
      status: 404,
      message: "No dockerfile mathcing the flow and stage id"
    }
  }
  return {
    status: 200,
    message: "Dockerfile removed successfully"
  }
}

// Get dockerfile
exports.getDockerfile = function* (namespace, flowId, stageId) {
  let results = yield CIDockerfiles.getDockerfile(namespace, flowId, stageId)

  if (results && results.content) {
    results.content = results.content.toString()
  }
  return {
    status: 200,
    message: results
  }
}

// Update dockerfile
exports.addOrUpdateDockerfile = function* (namespace, flowId, stageId, user, body) {
  // Check if dockerfile already exist before add a new one
  let results = yield CIDockerfiles.getDockerfile(namespace, flowId, stageId)
  if (results) {
    // Update Dockerfile
    body.update_time = new Date()
    results = yield CIDockerfiles.updateDockerfile(namespace, flowId, stageId, user, body)
  } else {
    // Add a new Dockerfile
    var dockerfile = {
      flow_id: flowId,
      stage_id: stageId,
      namespace: namespace,
      content: body.content,
      modified_by: user,
      create_time: new Date(),
      update_time: new Date()
    }
    results = yield CIDockerfiles.addDockerfile(dockerfile)
    return {
      status: 200,
      message: "Dockerfile added successfully."
    }
  }
  return {
    status: 200,
    message: results
  }
}

