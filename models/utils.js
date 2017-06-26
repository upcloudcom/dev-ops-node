/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-3
 * @author huangxin
 * 
 */

/**
 * The model of orm utilities
 */
'use strict'
const sequelize = require('../database/sequelize')

exports.setOptions = function (options, transaction) {
  options = options ? options : {}
  if (transaction) {
    options.transaction = transaction
  }
  return options
}

exports.trans = function* (options) {
  return sequelize.transaction(options).then(function (result) {
    return result
  })
}