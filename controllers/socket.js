/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-28
 * @author Zhangpc
 * 
 */

/**
 * Controller for socket
 */
'use strict'

// const stream = require('stream')
const https = require('https')
const buildService = require('../services/build')
const projectService = require('../services/project')
const flowBuildService = require('../services/flow_build')
const logger = require('../utils/logger').getLogger('contronlers/socket')

//判断stage构建状态，如果已为失败或构建完成，则从ElasticSearch中获取日志
//如构建中，则从k8s API获取实时日志
module.exports = function handleSocket(socket) {
  const method = 'handleSocket'
  socket.on('ciLogs', function (data) {
    if (!data.flowId || !data.stageId || !data.stageBuildId) {
      socket.emit('ciLogs', `<font color="red">[Tenx Flow API Error] Missing parameters.</font>\n`)
      logger.error(method, 'Missing parameters', data)
      socket.disconnect()
      return
    }
    flowBuildService.getStageBuildLogsFromK8S(data.flowId, data.stageId, data.stageBuildId, socket)
    .then(function (result) {
      if (result.status > 299) {
        logger.error(method, 'Failed to get build logs:', result)
        let message = 'Unexpected Error'
        try {
          const resultMessage = JSON.parse(result.results) || ''
          if(resultMessage.message && resultMessage.message.indexOf('PodInitializing') > 0) {
            message = '<font color="#ffc20e">[Tenx Flow API] Pod启动中，请稍后查看</font>'
            socket.emit('pod-init', message)
            socket.disconnect()
            return
          }
          if(resultMessage.code && resultMessage.code == 404) {
            message = '<font color="#ffc20e">[Tenx Flow API] 构建任务不存在</font>'
            socket.emit('ciLogs', message)
            socket.disconnect()
            return
          }
        } catch (error) {
        }
        if (result.results && result.results.message) {
          message = result.results.message
        }
        socket.emit('ciLogs', `<font color="red">[Tenx Flow API Error] ${message}</font>\n`)
        socket.disconnect()
        return
      } else {
        data.state = result.results.buildStatus
        socket.emit('ciLogs-ended', data, function (dataEnded) {
          // logger.info(method, `build ${data.buildId} logs handled by socket ended.`)
        })
        return
      }
    })
    .catch (function (err) {
      socket.emit('ciLogs-ended', 'Failed to get logs')
      logger.error(method, 'Failed to get logs:', err)
      socket.disconnect()
    })
  })

  socket.on('disconnect', function () {
    socket.emit('user disconnected')
  })

  socket.on('error', function (err) {
    logger.error(method, err.stack)
  })

}
