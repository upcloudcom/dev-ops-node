/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-18
 * @author Zhangpc
 * 
 */

/*
 * database config
 */
'use strict'

const config = require('./index')
const database = {
  production: {
    dialect: config.db_type,
    host: process.env.DB_HOST || '192.168.1.87',
    port: process.env.DB_PORT || 3306,
    db: process.env.DB_NAME || 'tenxcloud_2_0',
    timezone: '+08:00', // Need to add timezone
    username: process.env.DB_USER || 'tenxcloud',
    password: process.env.DB_PASSWORD || 'tenxcloud',
    // port: process.env.SECRET_DB_PORT || 5432,
    pool: {
      max: 200,
      min: 0,
      // The maximum time, in milliseconds, that a connection can be idle before being released
      idle: 20000
    },
    logging: false
  }
}

let dbConfig = database.developer
if (config.production) {
  dbConfig = database.production
} else if (config.staging) {
  dbConfig = database.staging
}

module.exports = dbConfig