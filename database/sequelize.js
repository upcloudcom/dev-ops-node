/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 * 
 */

/*
 * Support for mysql orm
 */
'use strict'

const Sequelize = require('sequelize')
const indexConfig = require('../configs')
const database = require('../configs/db')
const logger = require('../utils/logger').getLogger('sequelize')

const sequelize = new Sequelize(database.db, database.username, database.password, database)
logger.info(`Initializing the connection pool for ${indexConfig.db_type}...`)
// Force sync all models into db
if (process.env.FORCE_INIT_DB === 'true') {
  // sequelize.sync({force: true})
}
module.exports = sequelize