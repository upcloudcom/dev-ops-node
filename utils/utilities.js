/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 */
/**
* Common utility for tenxcloud
*
* @author Huangqg
* @date 2015-01-26
*/

'use strict';

var config = require('../configs');
var logger = require('../utils/logger').getLogger("utilities");

// 检查 basic 认证
exports.checkBasicAuthorization = function (req) {
  var method = 'checkBasicAuthorization'
  var authorization = req.headers['authorization']
  if (!authorization) {
    return false
  }
  var basicAuthorization = 'Basic ' + Buffer(config.tenx_storage_user.user + ':' + config.tenx_storage_user.password).toString('base64')
  if (authorization !== basicAuthorization) {
    logger.warn(method, "Not authorized user is trying storage service")
    return false
  }
  logger.info(method, "Admin user is trying storage service")
  req.authorization = 'admin'
  return true
}


//generator random string
exports.getRandomString = function(length, keyString) {
  if(!length) {
    length = 4
  }
  if(!keyString){
    keyString = 'abcdefghijklmnopqrstuvwxyz1234567890' 
  }
  let randomMax = keyString.length
  let randomString = []
  for(let i = 0; i < length; i++){
     let index = parseInt(Math.random() * (randomMax + 1) + 1, 10)
     randomString.push(keyString[index])
  }
  return randomString.join('')
}