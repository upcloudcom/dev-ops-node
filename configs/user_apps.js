/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-18
 * @author Zhangpc
 * 
 */

/*
 * app folder config
 */
'use strict'

const config = require('./index')
const userAppsConfig = {
  production: {
    appFolder: '/tenxcloud/app_data/'
  }
}

let appConfig = userAppsConfig.developer
if (config.production) {
  appConfig = userAppsConfig.production
} else if (config.staging) {
  appConfig = userAppsConfig.staging
}

module.exports = appConfig