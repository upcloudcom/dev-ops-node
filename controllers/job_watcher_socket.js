/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-30
 * @author huangxin
 * 
 */

/**
 * Controller for socket of job watcher
 */
'use strict'

const jobWatcherService = require('../services/job_watcher')
const logger = require('../utils/logger').getLogger('contronlers/job_watcher_socket')

module.exports = function handleSocket(socket) {
  const method = 'handleSocket'
  socket.on('stageBuildStatus', function (data) {
    if (!data.flowId || !data.watchedBuilds) {
      socket.emit('stageBuildStatus', {status: 400, results: {message: 'Missing Parameters'}})
      logger.error(method, 'Missing parameters', data)
      socket.disconnect()
      return
    }
    jobWatcherService.watch(data.flowId, data.watchedBuilds, socket)
  })

  socket.on('flowBuildStatus', function (data) {
    if (!data.flows) {
      socket.emit('flowBuildStatus', {status: 400, results: {message: 'Missing Parameters'}})
      logger.error(method, 'Missing parameters', data)
      socket.disconnect()
      return
    }
    data.flows.forEach(function (id) {
      jobWatcherService.watch(id, null, socket)
    })
  })

  socket.on('stopWatch', function () {
    jobWatcherService.removeSocket(socket)
  })

  socket.on('disconnect', function () {
    jobWatcherService.removeSocket(socket)
    socket.emit('user disconnected')
  })

  socket.on('error', function (err) {
    logger.error(method, err.stack)
  })
}