/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2017-07-05
 * @author lizhen
 */

/**
 * Service for cleaning finished jobs & sync running job when cicd daemon restarted.
 */

'use strict'

const clustersModel = require('../models').Clusters
const flowBuildModel = require('../models').FlowBuild
const K8sApiClient = require('../kubernetes/api/v1')
const logger = require('../utils/logger').getLogger('service/scavenger')
const co = require('co')
const utils = require('../utils')
const flowBuildService = require('./flow_build')
const config = require('../configs')
const https = require('https')
const http = require('http')

module.exports = function () {
  deleteCICDJobs(true)
}

function deleteCICDJobs(firstTime) {
  co(function*() {
    try {
      const clusters = yield getManagedClusterConfigs()
      const finallizers = clusters.reduce((dtors, config) => {
        try {
          const finallizer = new JobFinallizer(config, firstTime)
          dtors.push(finallizer)
        } catch (error) {
          logger.warn("instance finallizer for cluster failed, cluster id: ", config.clusterID, error)
        }
        return dtors
      }, [])
      yield finallizers.map(finallizer => finallizer.cleanSomeJobsUp())
    } catch (error) {
      logger.warn("try deleting jobs failed: ", error)
    }
    setTimeout(deleteCICDJobs.bind(null, false), anHour)
  })
}

function* getManagedClusterConfigs() {
  let daos = yield clustersModel.findAllCluster()
  daos = daos.filter(dao => {
    try {
      const configDetail = JSON.parse(dao.config_detail)
      return configDetail.isBuilder === 1
    } catch (error) {
      logger.warn("parse config detail failed, cluster id: ", dao.id)
    }
    return false
  })
  if (config.managed_clusters) {
    const managedClusters = config.managed_clusters
    daos = daos.filter(dao => managedClusters.indexOf(dao.id) !== -1)
  }
  return daos.map(dao => ({
    protocol: dao.api_protocol,
    host: dao.api_host,
    token: dao.api_token,
    version: dao.api_version,
    clusterID: dao.id,
  }))
}

function JobFinallizer(config, firstTimeAfterBootUp) {
  this.takeCareOfRunningJobs = firstTimeAfterBootUp
  this.config = config
  this.cluster = new K8sApiClient(config)
}

function succeeded(item) {
  return statusPredicate(item, 'succeeded')
}

function failed(item) {
  return statusPredicate(item, 'failed')
}

function running(item) {
  return statusPredicate(item, 'active')
}

function statusPredicate(item, propertyName) {
  const status = item.status
  return status.hasOwnProperty(propertyName) && status[propertyName] > 0
}

function deleteImmediately(item) {
  return item.spec.parallelism === 0
   || item.metadata.labels['tenx-manual-stop-flag'] === 'true'
}

const anHour = 1000 * 60 * 60
const aWeek = anHour * 24 * 7

function tooOld(item) {
  return Date.now() - new Date(item.status.startTime) > aWeek
}

function encodeQueryParameters(query) {
  const parameters = Object.getOwnPropertyNames(query).map(
    parameter => `${encodeURIComponent(parameter)}=${encodeURIComponent(query[parameter])}`).join('&')
  if (parameters) {
    return `?${parameters}`
  }
  return ''
}

JobFinallizer.prototype.getAllJobsInAllNamespaces = function*(query) {
  const response = yield this.cluster.raw.raw({
    endpoint: `/apis/batch/v1/jobs${encodeQueryParameters(query)}`,
    method: 'GET',
  })
  return response
}

JobFinallizer.prototype.deleteOneJobInNamespace = function*(namespace, jobName) {
  const response = yield this.cluster.batchNamespaces.deleteBy([namespace, 'jobs', jobName])
  return response
}

JobFinallizer.prototype.deletePodsInNamespace = function*(namespace, labelSelector) {
  const response = yield this.cluster.namespaces.deleteBy([namespace, 'pods'], labelSelector)
  return response
}

JobFinallizer.prototype.getAllCICDJobsInCluster = function*() {
  const response = yield this.getAllJobsInAllNamespaces({labelSelector: 'system/jobType=devflows'})
  return response.items.reduce((jobs, item) => {
    if (deleteImmediately(item)) {
      jobs.deleteImmediately.push(item)
    } else if (succeeded(item)) {
      jobs.succeeded.push(item)
    } else if (failed(item)) {
      jobs.failed.push(item)
    } else if (running(item)) {
      jobs.running.push(item)
    } else if (tooOld(item)) {
      jobs.tooOld.push(item)
    } else {
      logger.warn("unknown job status, job name: ", item.metadata.name, "namespace: ", item.metadata.namespace,
        "cluster id: ", this.config.clusterID)
    }
    return jobs
  }, {running: [], succeeded: [], failed: [], deleteImmediately: [], tooOld: []})
}

function logSummary(jobs) {
    logger.info(jobs.deleteImmediately.length + " manual stop jobs")
    logger.info(jobs.running.length + " running jobs")
    logger.info(jobs.succeeded.length + " succeeded jobs")
    logger.info(jobs.failed.length + " failed jobs")
    logger.info(jobs.tooOld.length + " too old jobs")
}

JobFinallizer.prototype.cleanSomeJobsUp = function*() {
  try {
    const jobs = yield this.getAllCICDJobsInCluster()
    logSummary(jobs)
    if (this.takeCareOfRunningJobs) {
      yield jobs.running.map(job => watchOneJob(this.config, job.metadata.namespace, job.metadata.name))
    }
    yield jobs.succeeded.filter(ageOlderThanAnHourSucceed)
      .concat(jobs.failed.filter(ageOlderThanAnHour))
      .concat(jobs.deleteImmediately)
      .concat(jobs.tooOld)
      .map(job => this.deleteOneJob(job))
  } catch (error) {
    logger.warn("clean jobs failed, cluster id: ", this.config.clusterID)
  }
}

function ageOlderThanAnHourSucceed(item) {
  return Date.now() - new Date(item.status.completionTime) > anHour
}

function ageOlderThanAnHour(item) {
  return Date.now() - new Date(item.status.startTime) > anHour
}

JobFinallizer.prototype.deleteOneJob = function*(item) {
  try {
    const metadata = item.metadata
    const jobName = metadata.name
    const namespace = metadata.namespace
    logger.info("deleting job, job name: ", jobName, "namespace: ", namespace, "cluster id: ", this.config.clusterID)
    yield this.deleteOneJobInNamespace(namespace, jobName)
    yield this.deleteJobRelatedPods(namespace, jobName)
  } catch (error) {
    logger.warn("deleting job failed, job name: ", jobName, "namespace: ", namespace, "cluster id: ", this.config.clusterID)
  }
}

JobFinallizer.prototype.deleteJobRelatedPods = function*(namespace, jobName) {
  const esc = encodeURIComponent
  yield this.deletePodsInNamespace(namespace, {[esc('job-name')]: esc(jobName)})
}

function* watchOneJob(config, namespace, jobName) {
  try {
    const result = yield watch(config, namespace, jobName)
    yield syncToDB(result.job, result.status)
  } catch (error) {
    logger.warn("watch job failed, job name: ", jobName, " namespace: ", namespace, " cluster id: ", config.clusterID)
  }
}

function getOptions(path, config) {
  let port = config.host.split(':')[1] === undefined ? (config.protocol === 'https' ? 443 : 80) : config.host.split(':')[1]
  let authHeader
  if (config.token) {
    authHeader = {'Authorization': 'bearer ' + config.token};
  }
  const options = {
    protocol: `${config.protocol}:`,
    hostname: config.host.split(':')[0],
    port: port,
    path: path,
    method: 'GET',
    headers: authHeader
  }
  if (config.protocol === 'https') {
    options.rejectUnauthorized = false;
  }
  return options
}

function getClient(config) {
  return config.protocol === 'https' ? https : http
}

function watch(config, namespace, jobName) {
  return new Promise((resolve, reject) => {
    const client = getClient(config)
    const options = getOptions(`/apis/batch/v1/watch/namespaces/${namespace}/jobs/${jobName}${encodeQueryParameters({watch: true})}`, config)
    const request = client.request(options, () => {
    })
    request.on('response', response => {
      let buffer = ''
      response.on('data', data => {
        buffer += data.toString()
        try {
          const event = JSON.parse(buffer)
          const status = event.object.status
          if (status.hasOwnProperty('active') && status.active > 0) {
            logger.info("job running")
          } else if (status.hasOwnProperty('succeeded') && status.succeeded > 0) {
            resolve({
              status: succeedStatus,
              job: event.object,
            })
          } else if (status.hasOwnProperty('failed') && status.failed > 0) {
            resolve({
              status: failedStatus,
              job: event.object,
            })
          } else {
            resolve({
              status: unknownStatus,
              job: event.object,
            })
          }
        } catch (error) {
          logger.info('data part not full json struct', error)
        }
      })
    })
    request.on('error', error => reject(error))
  })
}

const succeedStatus = flowBuildService.statusSuccess
const failedStatus = flowBuildService.statusFailed
const unknownStatus = -1

function* syncToDB(job, status) {
  if (status == unknownStatus) {
    logger.warn("job in unknown status, job name: ", job.metadata.name, "namespace: ", job.metadata.namespace)
    return
  }
  logger.info("sync job status to db, job name: ", job.metadata.name, "status: ", status)
  const labels = job.metadata.labels
  const flowBuildID = labels['flow-build-id']
  yield flowBuildModel.updateById({
    end_time: utils.DateNow(),
    status
  }, flowBuildID)
}
