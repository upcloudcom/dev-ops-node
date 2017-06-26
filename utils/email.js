/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 */
/**
* Common utility for tenxcloud
*
* @author Yangyubiao
* @date 2016-08-02
*/

'use strict'

const nodemailer = require('nodemailer')
const config = require('../configs')
const logger = require('../utils/logger').getLogger('email')
const tenxConfigsModel = require('../models').Configs


exports.sendEmail = function (mailOptions) {
  const method = 'sendEmail'
  const smtpTransport = nodemailer.createTransport("SMTP", mailOptions.host)
  return new Promise(function (resovle, reject) {
    // send email
    smtpTransport.sendMail(mailOptions, function (error, response) {
      if (error) {
        logger.error(method, error)
        reject(error)
      } else {
        logger.info(method, "Message sent: " + response.message)
      }
      smtpTransport.close()
      resovle(response)
    })
  })
}

