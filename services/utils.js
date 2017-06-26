/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-4
 * @author huangxin
 * 
 */

/**
 * utilities of service
 */
'use strict'

exports.responseSuccess = function (results) {
  return {
    status: 200,
    results
  }
}

exports.responseForbidden = function (message) {
  return _httpErr(403, message)
}

exports.responseNotFound = function (message) {
  return _httpErr(404, message)
}

exports.responseConflict = function (message) {
  return _httpErr(409, message)
}

exports.responseBadRequest = function (message) {
  return _httpErr(400, message)
}

exports.responseGone = function (message) {
  return _httpErr(410, message)
}

exports.responseInternalError = function (message) {
  return _httpErr(500, message)
}

exports.responsePreconditionError = function (message, kind, level) {
  return _httpErr(412, message, kind, level)
}

function _httpErr(code, message, kind, level) {
  return {
    status: code,
    message,
    details: {kind, level}
  }
}