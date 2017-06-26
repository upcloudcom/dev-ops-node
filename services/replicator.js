/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-18
 * @author YangYuBiao
 * 
 */


'use strict'

var replicatorModel = require('../models').Replicator;


exports.getRcByUsername=function* (username) {
  var result = yield replicatorModel.getRcByUsername(username);
  return result;
}