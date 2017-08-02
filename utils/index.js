/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-21
 * @author Zhangpc
 *
 */

/**
 * nomal tools
 */
'use strict'

const moment = require('moment')
const _ = require('lodash')

exports.DateNow = function () {
  return new Date()
}

exports.toUTCString = function (date) {
  if (!date || !date.toUTCString) {
    return null
  }
  return `${date.toUTCString()}+0800`
}

exports.promisify = function(fn, receiver) {
  return function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key ++) {
      args[_key] = arguments[_key]
    }

    return new Promise(function (resolve, reject) {
      fn.apply(receiver, [].concat(args, [function (err, res) {
        return err ? reject(err) : resolve(res)
      }]))
    })
  }
}


exports.handleExecError = function(method, err) {
  if (!err || Object.keys(err).length < 1) {
    return {}
  }
  let stdout, stderr
  if (err.stdout) stdout = err.stdout.toString()
  if (err.stderr) stderr = err.stderr.toString()
  if (stdout || stderr) {
    logger.error(method, 'stdout: ' + stdout)
    logger.error(method, 'stderr: ' + stderr)
    return {stdout, stderr}
  }
  logger.error(method, JSON.stringify(err))
  return err
}

exports.parse = function (str) {
  return _.attempt(JSON.parse.bind(null, str))
}

exports.getWebHookUrl = function() {
  return `${global.CICDCONFIG.external_protocol}://${global.CICDCONFIG.external_host}/api/v2/devops/managed-projects/webhooks`
}

exports.getScriptUrl = function() {
  return `${global.CICDCONFIG.external_protocol}://${global.CICDCONFIG.external_host}/api/v2/devops/ci-scripts`
}
