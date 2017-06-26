/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-10-18
 * @author HuangXin
 *
 */

/**
 * imageBuilder v2.0 to use kubernetes job for worker
 */
'use strict'

const child_process = require('child_process')
const logger = require('../../utils/logger').getLogger("imageBuilder_v2")
const assert = require('assert')
const indexConfig = require('../../configs')
const buildAgentService = require('../../services/build_agent')
const configsSercvice = require('../../services/configs')
const K8sApiClient = require('../../kubernetes/api/v1');
const JobTemplate = require('./k8sTemplates/batch/v1/jobTemplate.json');
const LogFormat = require('./log_format.js')
const logFormatter = new LogFormat()
const Https             = require('https');
const Http              = require('http');
const tailLines = require('../../configs/index').tailLines

var request = require('request');
var moment  = require('moment');

const SCM_CONTAINER_NAME = "tenx-scm"
const BUILDER_CONTAINER_NAME = "tenx-builder"
const DEPENDENT_CONTAINER_NAME = "tenx-deps"
const DEFAULT_IMAGE_BUILDER = indexConfig.default_image_builder
const KIND_ERROR = "Status"
const MANUAL_STOP_LABEL = "tenx-manual-stop-flag"
const GET_LOG_RETRY_COUNT = 3
const GET_LOG_RETRY_MAX_INTERVAL = 30

const STATUS_UNKNOWN = {
  conditions: [{
    status: 'Unknown'
  }]
}

const STATUS_TIMEOUT = {
  conditions: [{
    status: 'Timeout'
  }]
}

class ImageBuilder {
  constructor (clusterID) {
    this.builderName = BUILDER_CONTAINER_NAME
    this.scmName = SCM_CONTAINER_NAME
    this.k8sConfig = global.K8SCONFIGS
    if(clusterID) {
      const getTarget = global.allBuildCluster.some(cluster => {
        if(cluster.id == clusterID) {
          this.client = new K8sApiClient({
            protocol: cluster.api_protocol,
            host: cluster.api_host,
            token: cluster.api_token,
            version: cluster.api_version,
            clusterId: cluster.id
          })
          return true
        }
        return false
      })
      if(getTarget) {
        return
      }
    }
    this.client = new K8sApiClient(this.k8sConfig)
  }

  buildImage(buildInfo, volumeMapping, registryConfig) {
    const method = 'buildImage'
    // const registryConfig = global.REGISTRY_CONFIG
    // assert(buildInfo.repoUrl != null);
    // assert(buildInfo.imageName != null);
    // var internalRegistryAddress = registryConfig.internalip + ":" + registryConfig.internalport;
    var jobTemplate = JSON.parse(JSON.stringify(JobTemplate))
    // 设置labels，方便通过label查询
    jobTemplate.metadata.labels = this._setBuildLabels(buildInfo)
    jobTemplate.spec.template.metadata.labels = this._setBuildLabels(buildInfo)

    //构造build container
    let buildImage = buildInfo.build_image ? buildInfo.build_image : DEFAULT_IMAGE_BUILDER
    var volumeMounts = []
    volumeMounts.push({
        name: 'repo-path',
        mountPath: buildInfo.clone_location
      }, {
      // TODO: To see if we should remove this later
        name: 'localtime',
        mountPath: '/etc/localtime'
      }
    )
    // If it's to build image, force the command to TenxCloud image builder
    if (buildInfo.type == 3) {
      // Mount docker socket to the build container
      volumeMounts.push({
        name: 'docker-socket',
        mountPath: '/var/run/docker.sock'
      })
      // If it's to build image, pass in the secret
      volumeMounts.push({
        "name": "registrysecret",
        "mountPath": "/docker/secret",
        "readOnly": true
      })
    }

    // TODO: maybe update later
    if (buildImage.split('/').length === 2) {
      buildImage = `${registryConfig.host}/${buildImage}`
    }

    let buildAtSameNode = indexConfig.shared_volume.build_at_same_node ? indexConfig.shared_volume.build_at_same_node : true

    if (buildInfo.nodeName && buildAtSameNode) {
      //设置nodeName使得构建pod运行在同一node上
      jobTemplate.spec.template.spec.nodeName = buildInfo.nodeName
    }
    jobTemplate.spec.template.spec.containers = [{
      name: BUILDER_CONTAINER_NAME,
      // image: buildInfo.build_image ? buildInfo.build_image: DEFAULT_IMAGE_BUILDER,
      image: buildImage,
      imagePullPolicy: "Always",
      // command: ["/home/app/exec-job.sh"],
      args: buildInfo.build_command,
      volumeMounts: volumeMounts
    }]
    // Force to update cmd/args and workingDir
    if (buildInfo.type == 3) {
      // Overwrite cmd & args for building docker image step
      //jobTemplate.spec.template.spec.containers[0].cmd = []
      //jobTemplate.spec.template.spec.containers[0].args = ['/build.sh']
      jobTemplate.spec.template.spec.containers[0].workingDir = '/'
    } else {
      // Set the working dir to the app path
      jobTemplate.spec.template.spec.containers[0].workingDir = buildInfo.clone_location
    }

    //构造dependency container
    let depIndex = 0
    if (buildInfo.dependencies) {
      buildInfo.dependencies.forEach(function (d) {
        let container = {
          name: `${DEPENDENT_CONTAINER_NAME}${depIndex}`,
          image: d.image
        }
        if (d.env) {
          container.env = d.env
        }
        jobTemplate.spec.template.spec.containers.push(container)
        depIndex++
      })
    }
    jobTemplate.spec.template.spec.volumes = [{
        // TODO: To see if we should remove this later
        name: 'localtime',
        hostPath: {
          path: '/etc/localtime'
        }
      }, {
        name: 'repo-path',
        hostPath: {
          // Use fixed path for clone location
          path: indexConfig.shared_volume.build_dir + buildInfo.flowName + '/' + buildInfo.stageName + '/repository'
        }
      }
    ];
    if (buildInfo.type == 3) {
      // Mount docker socket to the build container
      jobTemplate.spec.template.spec.volumes.push({
        name: 'docker-socket',
        hostPath: {
          path: '/var/run/docker.sock'
        }
      })
      // Mount registry secret
      jobTemplate.spec.template.spec.volumes.push({
        name: 'registrysecret',
        secret: {
          secretName: "registrysecret"
        }
      })
    }
    var env = []
    if (buildInfo.env) {
      env = buildInfo.env
    }
    // Used to build docker images
    if (buildInfo.type == 3) {
      // Check the name of type of target image to build
      let targetImage = buildInfo.targetImage.image
      if (buildInfo.targetImage.imageTagType == 1) {
        // branch name
        targetImage += ":" + buildInfo.branch
      } else if (buildInfo.targetImage.imageTagType == 2) {
        // timestamps
        targetImage += ":" + moment().format('YYYYMMDD.HHmmss.SS')
      } else if (buildInfo.targetImage.imageTagType == 3) {
        // custom tag
        targetImage += ":" + buildInfo.targetImage.customTag
      }
      let registryUrl = registryConfig.host
      if (3 === buildInfo.targetImage.registryType) {
        registryUrl = buildInfo.targetImage.customRegistryConfig.url
      }
      env.push(
        {
          // Set the code repository to env to switch the location
          name: "APP_CODE_REPO",
          value: buildInfo.clone_location
        },
        {
          name: 'IMAGE_NAME',
          value: targetImage,
        },
        {
          name: 'DOCKERFILE_PATH',
          value: buildInfo.targetImage.DockerfilePath
        },
        {
          name: 'REGISTRY',
          value: registryUrl
        }
      )
      if (buildInfo.targetImage.DockerfileName) {
        env.push({
          name: 'DOCKERFILE_NAME',
          value: buildInfo.targetImage.DockerfileName
        })
      }
    }

    // Handle stage link
    let i = 1
    let target
    volumeMapping.forEach(function (v) {
      if (buildInfo.type == 3 && 'target' === v.type) {
        target = v
        target.name = 'volume-mapping-' + i
      }
      jobTemplate.spec.template.spec.containers[0].volumeMounts.push({
        name: 'volume-mapping-' + i,
        mountPath: v.containerPath
      })
      jobTemplate.spec.template.spec.volumes.push({
        name: 'volume-mapping-' + i,
        hostPath: {
          path: v.volumePath
        }
      })
      i++
    })

    //构造init container
    let initContainer = {
      name: SCM_CONTAINER_NAME,
      // image: "192.168.1.113/huangxin/clone-repo",
      image: buildInfo.scmImage,
      imagePullPolicy: "Always",
      env: [
        {
          name: "GIT_REPO",
          value: buildInfo.repoUrl
        }, {
          name: "GIT_TAG",
          value: buildInfo.branch
        }, {
          name: "GIT_REPO_URL",
          value: buildInfo.git_repo_url
        }, {
          name: "PUB_KEY",
          value: buildInfo.publicKey
        }, {
          name: "PRI_KEY",
          value: buildInfo.privateKey
        }, {
          name: "REPO_TYPE",
          value: buildInfo.repoType
        }, {
          name: 'DOCKERFILE_PATH',
          value: buildInfo.targetImage.DockerfilePath
        }, {
          name: 'ONLINE_DOCKERFILE',
          value: buildInfo.targetImage.DockerfileOL
        },
        // TODO: get user/password from service account
        {
          name: "SVN_USERNAME",
          value: buildInfo.svn_username
        }, {
          name: "SVN_PASSWORD",
          value: buildInfo.svn_password
        }, {
          name: "CLONE_LOCATION",
          value: buildInfo.clone_location
        }
      ],
      volumeMounts: [
        {
          name: 'repo-path',
          // mountPath: '/app'
          mountPath: buildInfo.clone_location
        }
      ]
    }
    //类型为构建，仓库类型为‘本地镜像仓库’
    if (buildInfo.type == 3 && 1 == buildInfo.targetImage.registryType) {
      // Disable upload Dockerfile and README after move to harbor
      initContainer.env.push({
        // Let init container konw it's building an image
        name: 'BUILD_DOCKER_IMAGE',
        value: "1"
      }, /*{
        name: 'UPLOAD_URL',
        value: `${registryConfig.protocol}://${registryConfig.host}:${registryConfig.port}/v1`
      }, {
        name: 'AUTH',
        value: 'Basic ' + Buffer(registryConfig.user + ':' + registryConfig.password).toString('base64')
      }, */{
        name: 'IMAGE_NAME',
        value: buildInfo.targetImage.image
      }, {
        name: 'FILES_PATH',
        value: buildInfo.clone_location + buildInfo.targetImage.DockerfilePath
      }/*{
        name: 'CONTRIBUTOR',
        value: buildInfo.imageOwner
      }*/)
      if (buildInfo.targetImage.DockerfileName) {
        initContainer.env.push({
          name: 'DOCKERFILE_NAME',
          value: buildInfo.targetImage.DockerfileName
        })
      }
    }
    if (target) {
      initContainer.env.push({
        name:'PREVIOUS_BUILD_LEGACY_PATH',
        value: '/tenx-scm/' + target.containerPath
      })
      initContainer.volumeMounts.push({
        name: target.name,
        mountPath: '/tenx-scm/' + target.containerPath
      })
    }
    jobTemplate.spec.template.metadata.annotations = {
      "pod.alpha.kubernetes.io/init-containers": JSON.stringify([initContainer])
    }

    jobTemplate.spec.template.spec.containers[0].env = env
    // Check if this conatainer exist first
    let self = this;
    let jobName = this._genJobName(buildInfo.flowName, buildInfo.stageName)
    // 使用generateName生成随机name
    jobTemplate.metadata.generateName = jobName
    jobTemplate.metadata.namespace = buildInfo.namespace
    logger.info(method, "Creating job of " + buildInfo.namespace)
    logger.debug(method, "Job object:", JSON.stringify(jobTemplate))
    return self.client.batchNamespaces.createBy([buildInfo.namespace, 'jobs'], null, jobTemplate).then(function (job) {
      return job;
    });
  }

  _setBuildLabels(buildInfo) {
    let labels = {
      "flow-id": buildInfo.flowName,
      "stage-id": buildInfo.stageName,
      "stage-build-id": buildInfo.stageBuildId
    }
    if (buildInfo.flowBuildId) {
      labels["flow-build-id"] = buildInfo.flowBuildId
    }
    return labels
  }

  stopJob(namespace, jobName, options) {
    const method = "stopJob"
    let self = this
    return this.getJob(namespace, jobName).then(function (job) {
      if (job.message && KIND_ERROR === job.message.kind) {
        logger.error(method, 'failed to get job', job)
        return job
      }
      //parallelism设为0，pod会被自动删除，但job会保留
      job.spec.parallelism = 0
      if (options) {
        if (options.forced) {
          //用来判断是否手动停止
          job.metadata.labels[MANUAL_STOP_LABEL] = 'true'
        }
        if (options.status) {
          //job watcher用来获取运行结果
          job.metadata.labels['tenx-builder-succeed'] = options.status.toString()
        }
      }
      return self.client.batchNamespaces.updateBy([namespace, 'jobs', jobName], null, job).then(function (job) {
        if (job.message && KIND_ERROR === job.message.kind) {
          //发生错误
          logger.error(method, 'failed to stop job', job)
        }
        return job
      })
    })
  }

  getEvents(namespace, jobName, podName, typeSelector) {
    const method = 'getEvents'
    let self = this
    typeSelector = typeSelector ? typeSelector : ''
    let jobSelector = {fieldSelector:`involvedObject.kind=Job,involvedObject.name=${jobName},${typeSelector}`}
    let jobEvents
    return this.client.namespaces.getBy([namespace, 'events'], jobSelector).then(function (events) {
      if (events.message && KIND_ERROR === events.message.kind) {
        logger.error(method, 'failed to get events of job', jobName)
        return events
      }
      jobEvents = events.items
      return _getPodEvents(namespace, jobName, podName, typeSelector).then(function (events) {
        if (events.message && KIND_ERROR === events.message.kind) {
          logger.error(method, 'failed to get events of pod of job', jobName)
          return events
        }
        return {
          jobEvents,
          podEvents: events.items
        }
      })
    })
  }

  _getPodEvents(namespace, podName, typeSelector) {
    const method = '_getPodEvents'
    typeSelector = typeSelector ? typeSelector : ''
    let podSelector = {fieldSelector:`involvedObject.kind=Pod,involvedObject.name=${podName},${typeSelector}`}
    return this.client.namespaces.getBy([namespace, 'events'], podSelector)
  }

  getPodName(namespace, jobName) {
    const method = 'getPodName'
    return this.getPod(namespace, jobName).then(function (pod) {
      let podName = ""
      if (pod) {
        // 使用第一个pod读取日志
        podName = pod.metadata.name
      }
      return podName
    })
  }

  getPod(namespace, jobName) {
    const method = 'getPod'
    return this.client.namespaces.getBy([namespace, 'pods'], {labelSelector:`job-name=${jobName}`}).then(function (pods) {
      let pod
      if (pods.items && pods.items.length > 0) {
        pod = pods.items[0]
        for (var i in pods.items) {
          if (pods.items[i].status && pods.items[i].status.phase === 'Failed') {
            //优先获取失败状态的pod
            pod = pods.items[i]
          }
        }
      } else {
        logger.warn(method, "failed to get a pod of job:", pods)
      }
      return pod
    })
  }

  getJob(namespace, jobName) {
    return this.client.batchNamespaces.getBy([namespace, 'jobs', jobName], null)
  }

  waitForJob(namespace, jobName, buildWithDependency) {
    let self = this
    return this.getJob(namespace, jobName).then(function (job) {
      if (job.message && KIND_ERROR === job.message.kind && 404 === job.message.code) {
        //job不存在时返回unknown状态
        logger.error(method, 'cannot found the job', jobName)
        return STATUS_UNKNOWN
      }
      if (buildWithDependency) {
        return self._waitForPod(namespace, jobName).then(function (status) {
          //获取job，判断是否为手动停止
          return self.getJob(namespace, jobName).then(function (job) {
            if (!job.message && job.metadata.labels[MANUAL_STOP_LABEL]) {
              //如果为手动停止，在结果中添加标记
              status.forcedStop = true
            } else if (status.succeeded > 0) {
              //如果未停止且成功，则自动停止job
              //执行失败时，外层调用会负责停止job
              self.stopJob(namespace, jobName, {status: status.succeeded})
            }
            return status
          })
        })
      }
      return self._waitForJob(namespace, jobName)
    })
  }

  // 根据builder container的状态返回job状态
  _translatePodStatus(status) {
    const method = '_translatePodStatus'
    const self = this
    if (status.containerStatuses && status.containerStatuses.length > 0) {
      let builderContainerStatus
      status.containerStatuses.forEach(function (s) {
        if (BUILDER_CONTAINER_NAME === s.name) {
          builderContainerStatus = s
        }
      })
      return self._translateBuilderStatus(builderContainerStatus)
    }
    return STATUS_UNKNOWN
  }

  _translateBuilderStatus(builderContainerStatus) {
    const method = '_translateBuilderStatus'
    if (builderContainerStatus && builderContainerStatus.state) {
      if (builderContainerStatus.state.running) {
        logger.warn(method, 'The builder container is still running: ', builderContainerStatus.state.running)
        return {active: 1}
      }
      if (builderContainerStatus.state.waiting) {
        logger.warn(method, 'The builder container is still waiting: ', builderContainerStatus.state.waiting)
        return {active: 1}
      }
      if (builderContainerStatus.state.terminated) {
        if (0 !== builderContainerStatus.state.terminated.exitCode) {
          logger.error(method, 'The builder container is exit abnormally:', builderContainerStatus.state.terminated)
          return {failed: 1}
        }
        return {succeeded: 1}
      }
      return STATUS_UNKNOWN
    }
    return STATUS_UNKNOWN
  }

  _waitForPod(namespace, jobName) {
    const method = "_waitForPod"
    let self = this
    let podName
    return new Promise(function (resolve, reject) {
      // 请求watch api监听pod发生的事件
      const options = self._getOptions(`/api/v1/namespaces/${namespace}/pods?watch=true&labelSelector=job-name=${jobName}`)
      const client = self._getClient()
      const waitingServer = client.request(options, function () {})
      let tmpData = ""
      waitingServer.on('response', (res) => {
        res.on('data', (data) => {
          tmpData += data.toString()
          res.pause(); // 暂停处理其他data事件
          let event
          try {
            logger.debug(method, "data to parse: ", tmpData)
            event = JSON.parse(tmpData);
            tmpData = ""
          } catch (e) {
            logger.warn(method, `Failed to parse an event of the pod of job ${jobName}, error: ${e}. Wait for next data to be appended`)
            res.resume()
            return
          }
          if (!podName) {
            //保存首次收到的事件所属的pod名称
            podName = event.object.metadata.name
          } else if (event.object.metadata.name !== podName) {
            //收到其他pod事件时不处理
            res.resume()
            return
          }
          if ('DELETED' === event.type) {
            //收到deleted事件，pod可能被删除
            logger.error(method, `pod of job ${jobName} is deleted with final status:`, event.object.status)
            resolve(self._translatePodStatus(event.object.status ? event.object.status : {}))
            res.destroy()
          } else if (event.object.status && event.object.status.containerStatuses && event.object.status.containerStatuses.length > 0) {
            //存在containerStatuses时
            let builderContainerStatus
            event.object.status.containerStatuses.forEach(function (s) {
              if (BUILDER_CONTAINER_NAME === s.name) {
                builderContainerStatus = s
              }
            })
            if (builderContainerStatus && builderContainerStatus.state && builderContainerStatus.state.terminated) {
              //builder container为终止状态，视为job执行结束。
              resolve(self._translateBuilderStatus(builderContainerStatus))
              res.destroy()
            } else {
              res.resume()
            }
          } else {
            res.resume()
          }
        })
        res.on('end', () => {
          logger.error(method, "watching", jobName, 'is stop')
          resolve(STATUS_TIMEOUT)
        })
      })
      waitingServer.on('error', (err) => {
        logger.error(method, `call watch api of pod of ${jobName} error:`, error)
        resolve(STATUS_UNKNOWN)
      })
      waitingServer.end()
    })
  }

  _waitForJob(namespace, jobName) {
    const method = "_waitForJob"
    let self = this
    // 判断job是否还存在
    return new Promise(function (resolve, reject) {
      // 请求watch api监听job发生的事件
      const options = self._getOptions(`/apis/batch/v1/namespaces/${namespace}/jobs?watch=true&fieldSelector=metadata.name=${jobName}`)
      const client = self._getClient()
      const waitingServer = client.request(options, function () {})
      // waitingServer.setSocketKeepAlive(true, 10000)
      let tmpData = ""
      waitingServer.on('response', (res) => {
        res.on('data', (data) => {
          tmpData += data.toString()
          res.pause(); // 暂停处理其他data事件
          let event
          try {
            logger.debug(method, "data to parse: ", tmpData)
            event = JSON.parse(tmpData);
            tmpData = ""
          } catch (e) {
            logger.warn(method, `failed to parse a event of job ${jobName}, error: ${e}. Wait for next data to be appended`)
            logger.debug(method, `bad event is ${tmpData}`)
            res.resume()
            return
          }
          let status = event.object.status ? event.object.status : {}
          if (event.object && event.object.metadata && event.object.metadata.labels &&
              event.object.metadata.labels[MANUAL_STOP_LABEL]) {
            status.forcedStop = true
          }
          if ('DELETED' === event.type) {
            //收到deleted事件，job可能被第三方删除
            logger.error(method, jobName, 'is deleted with final status:', event.object.status)
            resolve(status)
            res.destroy()
          } else if (event.object.status && 1 >= event.object.status.succeeded) {
            //job执行成功
            resolve(status)
            res.destroy()
          } else if (event.object.status && 1 >= event.object.status.failed) {
            //job执行失败
            resolve(status)
            res.destroy()
          } else if (0 === event.object.spec.parallelism) {
            //停止job时
            resolve(status)
            res.destroy()
          } else {
            res.resume()
          }
        })
        res.on('end', () => {
          logger.error(method, "watching", jobName, 'is stop')
          resolve(STATUS_TIMEOUT)
        })
      })
      waitingServer.on('error', (err) => {
        logger.error(method, `call watch api of ${jobName} error:`, err)
        resolve(STATUS_UNKNOWN)
      })
      waitingServer.end()
    })
  }

  getJobLogs(namespace, jobName, podName, socket) {
    const method = 'getJobLogs'
    let self = this
    let getLogs = function () {
      return self._waitForLogs(namespace, podName, SCM_CONTAINER_NAME, socket).then(function (logs1) {
        if (socket && !logs1) {
          return logs1
        }
        return self._waitForLogs(namespace, podName, BUILDER_CONTAINER_NAME, socket).then(function (logs2) {
          let tmp = ''
          if (logs2 && logs2 != '') {
            tmp += "---------------------------------------------------\n"
            tmp += "----- 子任务容器: 仅显示最近 " + tailLines + " 条日志 ----\n"
            tmp += "---------------------------------------------------\n"
          }
          tmp = logs1 + tmp + logs2
          return tmp
        })
      })
    }
    if (socket) {
      return self._watchEvents(namespace, podName, socket).then(function (result) {
        if (result.aborted) {
          return completeLogs
        }
        return getLogs().then(function (success) {
          if (result.response && !success) {
            setTimeout(function () {
              result.response.destroy()
            }, 180000)
          }
          return success
        })
      })
    }
    return getLogs()
  }

  _watchEvents(namespace, podName, socket) {
    let method = '_watchEvents'
    const self = this
    return new Promise(function (resolve, reject) {
      const options =
        self._getOptions(`/api/v1/namespaces/${namespace}/events?watch&fieldSelector=involvedObject.kind=Pod,involvedObject.name=${podName}`)
      const client = self._getClient()
      const request = client.get(options, function (res) {
        if (200 !== res.statusCode) {
          logger.warn(method, `Failed to get events of container "${containerName}" of pod "${podName}": ${res.statusCode} - ${res.statusMessage}.`)
          if (404 === res.statusCode) {
            // pod已经不存在时，终止后续重试操作
            return resolve({aborted: false})
          }
          return resolve({aborted: true})
        }
        let tmpData = ''
        res.on('data', function (chunk) {
          tmpData += chunk.toString()
          //按换行分隔
          let eventList = tmpData.split(/\r|\n/)
          let len = eventList.length
          for (var i = 0; i < len; i++) {
            //遍历解析json
            if (eventList[i]) {
              try {
                let event = JSON.parse(eventList[i])
                socket.emit('ciLogs', self._eventToLog(event.object))
                //解析成功则清空临时变量
                tmpData = ''
              } catch (e) {
                logger.debug(method, 'Failed to parse event: ', eventList[i], 'with error thrown:', e)
                //解析失败则赋值
                tmpData = eventList[i]
              }
            }
          }
          if (tmpData) {
            //如果最后一个event解析失败，则与下一块数据拼接
            logger.info(method, tmpData, 'will be appended with next data')
          }
        })
        resolve({response: res})
      })
      request.setSocketKeepAlive(true, 10000)
      request.on('error', function(e) {
        logger.error(method, `Failed to get watch pod events of ${podName} in ${namespace}.`)
        return resolve({aborted: false})
      })
    })
  }

  _eventToLog(event) {
    const color = "Normal" == event.type ? "#5FB962" : "yellow"
    const level = "Normal" == event.type ? "Info" : "Warn"
    if (level === "Warn" && event.message) {
      // Skip TeardownNetworkError from log for now, as it'll do no harm
      if (event.message.indexOf('TeardownNetworkError:') > 0) {
        return ''
      }
    }
    return `<font color="${color}">[${moment(event.firstTimestamp).format('YYYY/MM/DD HH:mm:ss')}] [${level}]: ${event.message}</font>\n`
    /*return `<font color="${color}">=============== [Tenx Flow API ${level}] Event Occurred ===============\n</font>` +
      `<font color="${color}">Reason: ${event.reason}\n</font>` +
      `<font color="${color}">Message: ${event.message}\n</font>` +
      `<font color="${color}">Count: ${event.count}\n</font>` +
      (event.count > 1 ? `<font color="${color}">First time: ${moment(event.firstTimestamp).format('YYYY/MM/DD HH:mm:ss')}\n</font>` +
                         `<font color="${color}">Last time: ${moment(event.lastTimestamp).format('YYYY/MM/DD HH:mm:ss')}\n</font>` :
                         `<font color="${color}">Time: ${moment(event.firstTimestamp).format('YYYY/MM/DD HH:mm:ss')}\n</font>`)*/
  }

  _waitForLogs(namespace, podName, containerName, socket, count) {
    let method = '_waitForLog'
    let follow = (socket ? 'true' : 'false')
    let self = this
    return new Promise(function (resolve, reject) {
      let aborted = false
      if (count <= 0) {
        socket.emit('ciLogs', `<font color="red">[Tenx Flow API Error] Failed to get log of ${containerName}!</font>\n`)
        return resolve(false)
      }
      if (!count) {
        count = GET_LOG_RETRY_COUNT
      }
      const options =
        self._getOptions(`/api/v1/namespaces/${namespace}/pods/${podName}/log?tailLines=${tailLines}&follow=${follow}&timestamps=1&container=${containerName}`)
      const client = self._getClient()
      let completeLogs = ''
      let dataCount = 0
      let success = true
      const request = client.get(options, function (res) {
        if (200 !== res.statusCode) {
          logger.warn(method, `Failed to get log of container "${containerName}" of pod "${podName}": ${res.statusCode} - ${res.statusMessage}.`)
          success = false
          if (404 === res.statusCode || 400 === res.statusCode) {
            // pod已经不存在或者正在初始化时，终止后续重试操作
            aborted = true
          }
          let responseData = ''
          res.on('data', function (data) {
            responseData += data.toString()
          })
          res.on('end', function () {
            if (400 !== res.statusCode) {
              reject(responseData)
            }
          })
          return
        }
        if (socket && containerName == BUILDER_CONTAINER_NAME) {
          socket.on('stop_receive_log', () => {
            res.destroy()
            resolve(true)
          })
          socket.emit('ciLogs', "---------------------------------------------------")
          socket.emit('ciLogs', "--- 子任务容器: 仅显示最近 " + tailLines + " 条日志 ---")
          socket.emit('ciLogs', "---------------------------------------------------")
        }
        res.on('data', function (chunk) {
          if (socket) {
            socket.emit('ciLogs', logFormatter.formatLog(chunk, true))
          }
          completeLogs += chunk
        })
      })
      request.setSocketKeepAlive(true, 10000)
      request.on('error', function(e) {
        logger.error(method, `Failed to get the log of ${containerName} container.`)
        reject('Failed to get the log.')
      })
      request.on('close', function (e) {
        if (socket) {
          if (aborted) {
            logger.warn(method, 'Stop to get job logs')
            return resolve(!aborted)
          }
          if (!success) {
            //如果未获取成功，则重试
            let timeout = 10 * (GET_LOG_RETRY_COUNT - count + 1)
            timeout = timeout > GET_LOG_RETRY_MAX_INTERVAL ? GET_LOG_RETRY_MAX_INTERVAL : timeout
            logger.warn(method, `Try to get log again after ${timeout} seconds`)
            setTimeout(function () {
              self._waitForLogs(namespace, podName, containerName, socket, count - 1).then(function (result) {
                return resolve(result)
              })
            }, timeout * 1000);
            return
          }
          logger.info(method, 'Get log successfully from socket.')
          return resolve(!aborted)
        }
        //非实时获取日志时，均为job已停止后再获取日志的情况
        //因此无须重试获取日志
        logger.info(method, 'Get log successfully.')
        if (follow == 'false') {
          return resolve(logFormatter.formatLog(completeLogs, true))
        }
        const childProcess = child_process.fork(`${__dirname}/child_process_log_format.js`)
        let isGetMessage = false
        childProcess.on('exit', () => {
          if(!isGetMessage) {
            return reject(false)
          }
        })
        childProcess.send(completeLogs)
        childProcess.on('message', (message) => {
          isGetMessage = true
          resolve(message)
        })
      })
    })
  }

  _genJobName(flowName, stageName) {
    return flowName.toLowerCase().replace(/_/g, '-') + '-' + stageName.toLowerCase().replace(/_/g, '-') + '-'
  }

  _getOptions(path) {
    let port = this.k8sConfig.host.split(':')[1] === undefined ? (this.k8sConfig.protocol === 'https' ? 443 : 80) : this.k8sConfig.host.split(':')[1]
    let authHeader
    if (this.k8sConfig.token) {
      authHeader = {'Authorization': 'bearer ' + this.k8sConfig.token};
    }
    const options = {
      protocol: `${this.k8sConfig.protocol}:`,
      hostname: this.k8sConfig.host.split(':')[0],
      port: port,
      path: path,
      method: 'GET',
      timeout: 60000,
      headers: authHeader
    }
    if (this.k8sConfig.protocol === 'https') {
      options.rejectUnauthorized = false;
    }
    return options
  }

  _getClient() {
    return this.k8sConfig.protocol === 'https' ? Https : Http
  }

  checkK8S () {
    return this.client.namespaces.getBy([]).then(function (namespaces) {
      if (namespaces.message && KIND_ERROR === namespaces.message.kind) {
        return {
          status: 500,
          error: namespaces.message
        }
      }
      return {status: 200}
    }).catch(function (err) {
      return {
        status: 500,
        error: err
      }
    })
  }

  checkES () {
    let self = this
    let healthUrl = `${this.k8sConfig.protocol}://${this.k8sConfig.host}/api/v1/proxy/` +
      `namespaces/kube-system/services/elasticsearch-logging:9200/_cat/health`
    return new Promise(function (resolve, reject) {
      self._sendLoggingRequest(healthUrl, 'GET', null, function(code, data, err) {
        return resolve({
          status: code,
          detail: data,
          error: err
        })
      })
    })
  }

  getJobLogsFromES (namespace, jobName, podName, beginDate, endDate, res, buildStatus) {
    const method = 'getJobLogsFromES'
    let self = this
    if (!beginDate) {
      res.write('[Tenx Flow API Error] Failed to get start time so that logs cannot be fetched!')
      return
    }
    beginDate = moment(beginDate).utc().format('YYYY.MM.DD')
    return self.getJobLogsFromESByDate (namespace, jobName, podName, beginDate, res)
    .then(function (result) {
      if (result && endDate) {
        endDate = moment(endDate).utc().format('YYYY.MM.DD')
        if (endDate != beginDate) {
          return self.getJobLogsFromESByDate (namespace, jobName, podName, endDate, res)
        }
      }
      return result
    })
    .then(function (result) {
      if ('1' == buildStatus) {
        return self._getPodEvents(namespace, podName, 'type!=Normal').then(function (events) {
          if (events && events.items) {
            events.items.forEach(function (event) {
              res.write(self._eventToLog(event))
            })
          }
          return result
        })
      }
      if (result) {
        if (result > 300) {
          return null
        }
        return result
      }
      return "ES_COMPLETE"
    }).catch(function (err) {
      logger.error(method, "Failed to query log from ES")
      throw err
    })
  }

  getJobLogsFromESByDate (namespace, jobName, podName, date, res) {
    let self = this
    //获取scm容器日志
    return self.getContainerLogsFromES (namespace, podName, SCM_CONTAINER_NAME, date, res).then(function (result) {
      if (result) {
        //获取build容器日志
        return self.getContainerLogsFromES (namespace, podName, BUILDER_CONTAINER_NAME, date, res)
      }
    })
  }

  getContainerLogsFromES(namespace, podName, containerName, date, res) {
    const method = 'getContainerLogsFromES'
    // Should have 9200 on the new k8s version
    let esHost = `${this.k8sConfig.protocol}://${this.k8sConfig.host}/api/v1/proxy/` +
      `namespaces/kube-system/services/elasticsearch-logging:9200`
    let scrollInitUrl = `${esHost}/logstash-${date}/_search?scroll=1m`
    let requestBody = {
      "from" : 0,
      "sort": [
        {"time_nano"  : {"order" : "asc"}}
      ],
      "query": {
        "bool": {
          "must": [
             { 
               "query": {
                 "match": {
                   "kubernetes.container_name": {
                     "query": containerName,
                     "type": "phrase"
                   }
                 }
               }
             },
             { 
               "query": {
                 "match": {
                   "kubernetes.pod_name": {
                     "query": podName,
                     "type": "phrase"
                   }
                 }
               }
             },
             { 
               "query": {
                 "match": {
                   "kubernetes.namespace_name": {
                     "query": namespace,
                     "type": "phrase"
                   }
                 }
               }
             },
          ]
        }
      },
      "_source": ["log", "kubernetes.pod_name", "docker.container_id", "@timestamp"],
      "size": 200
    }
    return this._getLogsFromES(scrollInitUrl, 'GET', requestBody, podName, res)
  }

  _getLogsFromES (url, httpMethod, body, podName, res) {
    const method = '_getLogsFromES'
    let self = this
    return new Promise(function (resolve, reject) {
      self._sendLoggingRequest(url, httpMethod, body, function(code, data) {
        if (data && data.hits && data.hits.hits) {
          if (data.hits.hits.length > 0) {
            return self._refineLog(podName, data.hits.hits).then(function (logs) {
              res.write(logs)
              if (data._scroll_id) {
                //滚动获取后续日志并返回
                return self._scrollRestLogs(data._scroll_id, podName, res).then(function () {
                  if (logs && logs != '') {
                    resolve(true)
                  } else {
                    resolve(404)
                  }
                })
              }
              if (logs && logs != '') {
                resolve(true)
              } else {
                resolve(404)
              }
            })
          }
          if (data._scroll_id) {
            self._clearScroll(data._scroll_id)
          }
          if (data.hits.hits.length <= 0) {
            return resolve(404)
          }
          return resolve(true)
        }
        logger.error(method, `Failed to get logs: (${code})`, data)
        //res.write('[Tenx Flow API Error] Failed to get the rest of logs from ElasticSearch, please try again!')
        // Return normally, try API
        return resolve(code)
      })
    })
  }

  _scrollRestLogs(scrollId, podName, res) {
    const method = '_scrollRestLogs'
    let esHost = `${this.k8sConfig.protocol}://${this.k8sConfig.host}/api/v1/proxy/` +
      `namespaces/kube-system/services/elasticsearch-logging:9200`
    let scrollNextUrl = `${esHost}/_search/scroll`
    let requestBody = {
      "scroll": '1m',
      "scroll_id": scrollId
    }
    let logsAcc = ''
    return this._getLogsFromES (scrollNextUrl, 'GET', requestBody, podName, res)
  }

  _clearScroll(scrollId) {
    let esHost = `${this.k8sConfig.protocol}://${this.k8sConfig.host}/api/v1/proxy/` +
      `namespaces/kube-system/services/elasticsearch-logging:9200`
    let clearScrollUrl = `${esHost}/_search/scroll`
    let requestBody = {
      "scroll_id": [scrollId]
    }
    this._sendLoggingRequest(clearScrollUrl, 'DELETE', requestBody, function(code, data) {
      logger.debug(`clear scroll result: (${code})${data}`)
    })
  }

  _refineLog (podName, dataArray) {
    return new Promise(function (resolve, reject) {
      var refinedLogs = ''
      if (dataArray) {
        dataArray.forEach(function(hit) {
          if (podName === hit._source.kubernetes.pod_name) {
            refinedLogs += `<font color="#ffc20e">[${moment(hit._source["@timestamp"]).format('YYYY/MM/DD HH:mm:ss')}]</font> ${hit._source.log}`
          }
        })
      }
      resolve(refinedLogs)
    })
  }

  _sendLoggingRequest(requestUrl, httpMethod, data, callback) {
    var method = "_sendLoggingRequest";
    var requestAction = request.get;
    data = (data == null ? "": data)
    if (httpMethod == 'POST') {
        requestAction = request.post;
    } else if (httpMethod == 'PUT') {
        requestAction = request.put;
    } else if (httpMethod == 'DELETE') {
        requestAction = request.del;
    }
    requestAction({
        url: requestUrl,
        json: true,
        body: data,
        headers: {
        'Authorization': 'bearer ' + this.k8sConfig.token
      }
    }, function (err, resp, body) {
      if (err) {
        logger.error(method, err);
        callback(500, body, err);
        return;
      }
      if (callback) {
        var statusCode = resp ? resp.statusCode: 200;
        if (!resp) {
            logger.error("No response? " + resp);
        }
        callback(resp.statusCode, body);
      }
    })
  }
}

module.exports = ImageBuilder