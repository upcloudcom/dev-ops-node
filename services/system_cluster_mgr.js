/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-18
 * @author Zhangpc
 *
 */
'use strict'

const logger = require('../utils/logger').getLogger('system_cluster_mgr')
const clustersModel = require('../models').Clusters

exports.findClusterById = function(clusterId) {
  const method = 'getClusterByName'
  return clustersModel.findClusterById(clusterId).then(function (result) {
    logger.debug(method, `Get k8s config: ${JSON.stringify(result)}`)
    if (!result) {
      return
    }
    return _formatCluster(result)
  })
}

// Format cluster config
function _formatCluster(cluster) {
  const configFormat = {
    name: cluster.cluster_name,
    displayname: cluster.cluster_display_name,
    protocol: cluster.api_protocol,
    host: cluster.api_host,
    version: cluster.api_version,
    token: cluster.api_token
  }
  return configFormat
}