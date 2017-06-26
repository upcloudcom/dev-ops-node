/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 */
/**
 * Script to provide Recording user Operation
 *
 * v0.1 - 2016-04-18
 *
 *  @author YangYuBiao
 */

var logger = require('../utils/logger').getLogger('UserOpRecordsService');
var uuid = require('node-uuid');
var moment = require('moment');
var userOpRecordsModel = require('../models').UserOperationRecord;
var replicatorModel = require('../models').Replicator;

// Recording container Operation
exports.recContainerOp = function* (cluster, hostingCluster, rcName, userId, opType, opName, callback){
  var method = 'recording container Operation';
  var opRecords = {
    op_id: uuid.v4(),
    op_type: opType, // 1 = container; 2 = ci; 3 = image; 4 = hosting
    op_name: opName, // 0 = create; 1 = start; 2 = stop; 3 = delete; 4 = configchange;
    hosting_cluster: hostingCluster,
    user_id: userId,
    op_timestrap: new Date,
    namespace: namespace
  };
  var opedConfig = {};
  if (cluster) {
    opedConfig.name = cluster.rc_name;
    opedConfig.replicas = cluster.container_size;
    opedConfig.cpu = cluster.cpu;
    opedConfig.memory = cluster.memory;
    opedConfig.disksize = cluster.disksize;

    opRecords.oped_id = cluster.rc_uid;
    opRecords.oped_name = cluster.rc_name;
    opRecords.oped_config = JSON.stringify(opedConfig);
    var result = yield userOpRecordsModel.create(opRecords);
    return result;
  } else {
      return replicatorModel.findInstById(userId, rcName, hostingCluster).then(function(results){
      if (results && results.length > 0) {
        logger.debug(method, 'find cluser inst by id: ' + JSON.stringify(results));
        var cluster = results[0];
        opedConfig.name = cluster.rc_name;
        opedConfig.replicas = cluster.container_size;
        opedConfig.cpu = cluster.cpu;
        opedConfig.memory = cluster.memory;
        opedConfig.disksize = cluster.disksize;

        opRecords.oped_id = cluster.rc_uid;
        opRecords.oped_name = cluster.rc_name;
        opRecords.oped_config = JSON.stringify(opedConfig);
        var result = userOpRecordsModel.create(opRecords);
        return result;
      }
    },
    function(err){
      this.throw(err.message);
    });
  }
}