/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-10
 * @author Lei
 * 
 */

/**
 * The model of tenx_cd_deployment_logs
 */
'use strict'

const utils = require('../utils')
const indexConfig = require('../configs')
const sql = require('../database/spliceSQL')(indexConfig.db_type)

module.exports = function (sequelize, DataTypes) {
  return sequelize.define("cd_deployment_logs", {
    id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    cd_rule_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    target_version: {
      type: DataTypes.STRING,
      allowNull: true
    },
    result: {
      type: DataTypes.STRING,
      allowNull: false
    },
    create_time: {
      field:'create_time',
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    }
  }, {
      timestamps: false,
      freezeTableName: true,
      tableName: 'tenx_cd_deployment_logs',
      classMethods: {
        // Create a new rule
        createOneLog: function(log) {
          return this.create(log)
        },
        listLogsByFlowId: function(namespace, flow_id, limit) {
          let options = {
            replacements: [namespace, flow_id, limit],
            type: sequelize.QueryTypes.SELECT
          }
          return sequelize.query(sql.SELECT_FLOW_DEPLOYMENT_LOGS, options)
        }
      }
    })
}