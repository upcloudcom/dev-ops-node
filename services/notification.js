/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 */

'use strict'

const co = require('co')
const CIFlow = require('../models').CIFlow
const emailUtil = require('../utils/email.js')
const tenxConfigsModel = require('../models').Configs
const logger = require('../utils/logger').getLogger('notification')
const utils = require('../utils')

// For v2, using k8s job to build
/*
Detail should be in the fomrat below:
{
  "type": "xxx",
  "result": "xxx",
  "subject": "xxx",
  "body": "xxxx"
}
*/
exports.sendEmailUsingFlowConfig = function (namespace, flowId, detail) {
  var method = 'sendEmailUsingFlowConfig'
  co(function* () {
    let flowInfo = yield CIFlow.findFlowById(namespace, flowId)
    if (!flowInfo) {
      logger.error('The flow ' + flowId + ' does not exist.')
      return
    }
    if (!flowInfo.notification_config) {
      logger.info('The flow ' + flowId + ' does not have any notification config')
      return
    }
    let config = utils.parse(flowInfo.notification_config)
    if (config[detail.type] && config[detail.type][`${detail.result}_notification`] === true) {
      let emailConfig = yield tenxConfigsModel.findTenxConfig('mail')
      if (!emailConfig) {
        logger.warn(method, 'No email server configured to send email.')
        return
      }
      emailConfig = utils.parse(emailConfig.config_detail)
      let user = emailConfig.senderMail
      let temp = emailConfig.mailServer.split(':')
      let server = temp[0]
      let port = parseInt(temp[1])
      emailConfig.host = {
        host: server,
        port: port,
        secureConnection: port === 465, // use SSL
        auth: {
          user: emailConfig.senderMail,
          pass: emailConfig.senderPassword
        }
      }
      let emailList = config['email_list']
      if ( Object.prototype.toString.call(config['email_list']) === '[object Array]') {
        emailList = config['email_list'].join(',')
      }
      let senderName = emailConfig.senderName || 'system'
      let mailOptions = {
        from: user ? `${senderName} <${user}>` : '',
        to: emailList,
        subject: `TenxFlow(${flowInfo.name}): ${detail.subject}`,
        html: `${detail.body}`,
        host: emailConfig.host
      }
      logger.info(method, "Sending email using flow config...")
      emailUtil.sendEmail(mailOptions).catch(function (error) {
        logger.error(method, error)
      })
    }
  })
}

// For v1, using docker container to build
exports.sendEmailByProjectId = function (projectId, detail) {
  var method = 'sendEmailByProjectId'
  co(function* () {
    let projectInfo = yield projectModel.findById(projectId)
    if (!projectInfo) {
      logger.error('The project ' + projectId + ' does not exist.')
      return
    }
    let config = utils.parse(projectInfo.notification_config)
    if (!config) {
      logger.info('The project ' + projectId + ' has no CI/CD rules.')
      return
    }

    if (config[detail.type] && config[detail.type][`${detail.result}_notification`] === true) {
      let emailConfig = yield tenxConfigsModel.findTenxConfig('mail')
      if (!emailConfig) {
        return
      }
      emailConfig = utils.parse(emailConfig.config_detail)
      let user = emailConfig.senderMail
      let temp = emailConfig.mailServer.split(':')
      let server = temp[0]
      let port = parseInt(temp[1])
      emailConfig.host = {
        host: server,
        port: port,
        secureConnection: port === 465, // use SSL
        auth: {
          user: emailConfig.senderMail,
          pass: emailConfig.senderPassword
        }
      }
      let senderName = emailConfig.senderName || 'system'
      let mailOptions = {
        from: user ? `${senderName} <${user}>` : '',
        to: config['email_list'].join(','),
        subject: `${detail.subject}`,
        html: `${detail.body}`,
        host: emailConfig.host
      }
      emailUtil.sendEmail(mailOptions).catch(function (error) {
        logger.error(method, error)
      })
    }
  })
}
