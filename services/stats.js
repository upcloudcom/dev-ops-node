/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-18
 * @author huangxin
 *
 */

/**
 * Service for server stats check
 */
'use strict'

const FlowBuild = require('../models').FlowBuild

/*
Collect server stats, including
1) Number of successful flow build
2) Number of running flow build
3) Number of failed flow build
*/
exports.collectServerStats = function* (namespace) {
  var status = 200
  var results = {}
  try {
    // Only for valid namespace(user or teamspace)
    if (namespace && namespace != '') {
      let result = yield FlowBuild.queryFlowBuildStats(namespace)
      results.flow_build = {
        succeed_number: 0,
        running_number: 0,
        failed_number: 0
      }
      // Covert the data format
      result.forEach(function(row) {
        if (row.status == 0) {
          results.flow_build.succeed_number = row.count
        } else if (row.status == 1) {
          results.flow_build.failed_number = row.count
        } else if (row.status == 2) {
          results.flow_build.running_number = row.count
        }
      })
    }
  } catch (err) {
    results.message = JSON.stringify(err)
    status = 500
  }
  return { status, results }
  /*let imageBuilder = new ImageBuilderV2()
  let results = {}
  let status = 200
  let check = yield imageBuilder.checkK8S()
  results['K8S-API'] = check
  if (check.status > 200) {
    status = 500
  }

  try {
    check = yield imageBuilder.checkES()
    results['ElasticSearch'] = check
    if (check.status > 200) {
      status = 500
    }
  } catch (err) {
    results['ElasticSearch'] = {
      status: 500,
      message: err
    }
    status = 500
  }

  try {
    yield modelIndex.healthCheck()
    results['TenxCloud-DB'] = {
      status: 200
    }
  } catch (err) {
    results['TenxCloud-DB'] = {
      status: 500,
      message: err
    }
    status = 500
  }
  return { status, results }*/
}
