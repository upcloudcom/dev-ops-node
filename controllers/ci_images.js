/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-26
 * @author Lei
 *
 */

/*
 * Controllers for supported CI images
 */
'use strict'

const ciImagesService = require('../services/ci_images')
const logger = require('../utils/logger').getLogger('controllers/stage')
const configService = require('../services/configs')

// Return all available base CI iamges
exports.getAvailableImages = function* () {
  const result = yield ciImagesService.getAvailableImages(this.session.loginUser)
  const registry = yield configService.getRegistryConfig()
  this.status = result.status
  if(registry) {
    delete registry.user
    delete registry.password
  }
  result.registry = registry
  this.body = result
}

exports.validateUserRole = function* (next) {
  const result = ciImagesService.isAdminRole(this.session.loginUser)
  if (!result) {
    logger.info("Not authoried...")
    this.status = 403
    return
  } else {
    this.status = 200
  }
  yield next
}

/**
 * Create a new base CI image
 * ```
 * {
 *   "image_name": "xxxx",
 *   "image_url": "xxxx",
 *   "namespace": "xxx",
 *   "category_id": 1/2/3/4/5...,
 *   "description": "my description"
 * }
 * ```
 */
exports.createNewBaseImage = function* () {
  const result = yield ciImagesService.createNewBaseImage(this.session.loginUser, this.request.body)
  this.status = result.status
  this.body = result
}

/**
 * Update a base CI image
 * ```
 * {
 *   "image_name": "xxxx",
 *   "image_url": "xxxx",
 *   "category_id": 1/2/3/4/5...,
 *   "description": "my description"
 * }
 * ```
 */
exports.updateBaseImage = function* () {
  const id = this.params.id
  const imageInfo = this.request.body
  const result = yield ciImagesService.updateBaseImage(id, this.session.loginUser, imageInfo)
  this.status = result.status
  this.body = result
}

exports.deleteBaseImage = function* () {
  const result = yield ciImagesService.deleteBaseImage(this.session.loginUser, this.params.id)
  this.status = result.status
  this.body = result
}
