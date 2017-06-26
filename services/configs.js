/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-08-02
 * @author Zhangpc
 *
 */

/*
 * service for configs
 */
'use strict'

const env = process.env

const configsModel = require('../models').Configs
const clustersModel = require('../models').Clusters
const logger = require('../utils/logger').getLogger('services/configs')

exports.getRegistryConfig = function () {
  return configsModel.findTenxConfig('harbor').then(function (config) {
    let registryConfig = {}
    if (!config) {
      return registryConfig
    }
    if (config.config_detail && config.config_detail.trim() !== '') {
      registryConfig = JSON.parse(config.config_detail)
    }
    if (registryConfig.url.indexOf('://') > 0) {
      var v2ServerInfo = registryConfig.url.split('://')
      registryConfig.protocol = v2ServerInfo[0]
      registryConfig.host = v2ServerInfo[1]
    } else {
      registryConfig.protocol = 'http'
      registryConfig.host = registryConfig.url
    }
    return registryConfig
  })
}

exports.getCICDConfig = function () {
  return configsModel.findTenxConfig('cicd').then(function(config) {
    // Use the values from env first
    let cicdConfig = {
      protocol: env.DEVOPS_PROTOCOL,
      host: env.DEVOPS_HOST,
      external_protocol: env.DEVOPS_EXTERNAL_PROTOCOL,
      external_host: env.DEVOPS_EXTERNAL_HOST
    }
    if(!config) {
      return cicdConfig
    }
    if(config.config_detail && config.config_detail.trim() !== '') {
      cicdConfig = JSON.parse(config.config_detail)
    }
    return cicdConfig
  })
}

/*
 * Return default cluster for build
 *
*/
exports.getK8SConfigs = function () {
  return clustersModel.findAllCluster().then(function(clusters) {
    // Default cluster config
    var defaultCluster = {
      api_protocol: "http",
      api_host: "localhost:8080",
      api_version: "v1"
    }
    global.allBuildCluster = []
    let setDefaultBuildCluster = false
    if (clusters && clusters.length > 0) {
      // Use the first cluster by default
      defaultCluster = clusters[0]
      for (let i = 0; i< clusters.length; i++) {
        if (clusters[i].config_detail) {
          let detail = JSON.parse(clusters[i].config_detail)
          // Use the first builder
          if (detail && detail.isBuilder === 1) {
            if(!setDefaultBuildCluster) {
              logger.info("default builder cluster: " + clusters[i].name)
              defaultCluster = clusters[i]
              setDefaultBuildCluster = true
            }
            global.allBuildCluster.push(clusters[i])
          }
        }
      }
      return {
        protocol: defaultCluster.api_protocol,
        host: defaultCluster.api_host,
        token: defaultCluster.api_token,
        version: defaultCluster.api_version,
        clusterId: defaultCluster.id
      }
    } else {
      return {
        protocol: defaultCluster.api_protocol,
        host: defaultCluster.api_host,
        token: defaultCluster.api_token,
        version: defaultCluster.api_version
      }
    }
  })
}