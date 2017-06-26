/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-20
 * @author Zhangpc
 * 
 */

/**
 * API for docker registry
 */
'use strict'

const urllib = require('urllib')
const DEFAULT_PERMISSIONS = 'admin'
const AdminUserName = 'admin'

class DockerRegistryAPIs {
  constructor(config) {
    if (!config) {
      const error = new Error('Parameter error')
      error.message = 'Docker registry config is required.'
      error.status = 400
      throw error
    }
    this.config = config
  }
  
  getImageInfo(loginUsername, imageName) {
    const requestUrl = `${this._getAPIPrefix()}/image/${imageName}`
    const options = {
      dataType: 'json',
      headers: this._getAuthorizationHeader(loginUsername)
    }
    return this._createRequest(requestUrl, options)
  }

  getUserImages(loginUsername, specifiedUsername) {
    const requestUrl = `${this._getAPIPrefix()}/userrepositories?username=${specifiedUsername}`
    const options = {
      dataType: 'json',
      headers: this._getAuthorizationHeader(loginUsername)
    }
    return this._createRequest(requestUrl, options)
  }

  getPrivateImages(loginUsername, showDetail) {
    const requestUrl = `${this._getAPIPrefix()}/myrepositories?showdetail=${showDetail}`
    const options = {
      dataType: 'json',
      headers: this._getAuthorizationHeader(loginUsername)
    }
    return this._createRequest(requestUrl, options)
  }

  updateImageInfo(loginUsername, imageName, image) {
    const requestUrl = `${this._getAPIPrefix()}/image/${imageName}`
    const options = {
      method: 'POST',
      dataType: 'json',
      data: image,
      headers: this._getAuthorizationHeader(loginUsername)
    }
    return this._createRequest(requestUrl, options)
  }
  
  grantPermissions(imageName, username, permissions) {
    const requestUrl = `${this._getInternalAPIPrefix()}/users/${username}/permissions`
    const options = {
      method: 'PUT',
      dataType: 'json',
      data: {
        repo: imageName,
        access: permissions ? permissions : DEFAULT_PERMISSIONS
      },
      headers: this._getAuthorizationHeader(username)
    }
    return this._createRequest(requestUrl, options)
  }
  
  exchangeAuthToken(username, imageName) {
    const exchangeURL = `${this.config.v2AuthServer}/auth?account=${username}&scope=repository:${imageName}:pull&service=${this.config.host}`
    const options = {
      method: 'GET',
      dataType: 'json',
      headers: this._getAuthorizationHeader()
    }
    return this._createRequest(exchangeURL, options)
  }
  
  getTagFromEventsUrl(token, url) {
    const options = {
      method: 'GET',
      dataType: 'json',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
    return this._createRequest(url, options)
  }
  
  _createRequest(url, options) {
    return urllib.request(url, options)
  }
  
  _getAPIPrefix() {
    return `${this.config.protocol}://${this.config.host}:${this.config.port}/v1`
  }
  
  _getInternalAPIPrefix() {
    return `${this.config.protocol}://${this.config.host}:${this.config.port}`
  }
  
  _getAuthorizationHeader(onbehalfUser) {
    let authHeader = {
      'Authorization': 'Basic ' + Buffer(this.config.user + ':' + this.config.password).toString('base64')
    }
    // Only admin user can use onbehalfUser
    if (this.config.user == AdminUserName && onbehalfUser) {
      authHeader.onbehalfuser = onbehalfUser;
    }
    return authHeader
  }
}

module.exports = DockerRegistryAPIs