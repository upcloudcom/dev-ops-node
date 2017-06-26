/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-05-07
 * @author Zhangpc
 *
 */

/**
 * Service for k8s
 */
'use strict'
const logger = require('../utils/logger').getLogger('services')
const SystemClusterMgr = require('./system_cluster_mgr')
const KubernetesService = require('./kubernetes')

exports.getKuberneteService = function (clusterId) {
  const method = 'getKuberneteService'
  return SystemClusterMgr.findClusterById(clusterId).then(function (kuberConfig) {
    logger.info(method, 'Get k8s service from config: ' + JSON.stringify(kuberConfig))
    if (kuberConfig) {
      return new KubernetesService(kuberConfig)
    } else {
      return null
    }
  })
}