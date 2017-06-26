/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.2 - 2016-04-27
 * @author Wang Lei
*/

/* 
 * Transfer a local file to remote directory using Linux scp command
 */
'use strict'

const logger = require('./logger').getLogger('transferFile2Remote')
const fs = require('fs')
const execSync = require('child_process').execSync
const path = require('path')
const utils = require('./index')

/*
Transfer file to remote desktop
@localFile - /tenxcloud/app_data/<namespace>/<type>/file
@remoteFile - /tenxcloud/app_data/<namespace>/<type>/file, use the same path as the local one if it's null
@remoteAddr - URL of the remote builder
@user/@password the user/password of remote builder
@is2Remote - 1 means it's to transfer local file to remote, 0 means it's to transfer remote file to local
*/
exports.transferFile = function (localFile, remoteFile, remoteAddr, user, password, is2Remote, callback) {
  const method = 'transferFile2Remote'
  logger.info(method, `Moving file to builder machine: ${localFile}`)
  if (!remoteFile) {
    remoteFile = localFile
  }
  const cmd = `/usr/bin/expect tools/transferFile.sh ${localFile} ${remoteAddr} ${remoteFile} ${user} ${password} ${is2Remote}`
  logger.info(method, `cmd: ${cmd}`)
  try {
    const result = execSync(cmd, {timeout: 1800})
    if (is2Remote == 0) {
      logger.info('Transfer file from remote machine successfully')
    } else {
      logger.info('Transfer file to remote machine successfully')
    }
    return { success: true }
  } catch (err) {
    return utils.handleExecError(err)
  }
  /*var result = child_process.exec('/usr/bin/expect tools/transferFile.sh ' + localFile + ' ' + remoteAddr + ' ' + remoteFile + ' ' + user + ' ' + password + ' ' + is2Remote, function(error, stdout, stderr) {
    if (error) {
      logger.error("Failed to transfer zip file to remote")
      logger.error(error)
      logger.error(stdout)
      logger.error(stderr)
      callback(error, stdout, stderr)
    } else {
      logger.debug(stdout)
      if (is2Remote == 0) {
        logger.info("Transfer file from remote machine successfully")
      } else {
        logger.info("Transfer file to remote machine successfully")
      }
      callback(null, stdout)
    }
  })*/
}
