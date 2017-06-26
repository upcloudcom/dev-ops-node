/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-5
 * @author huangxin
 * 
 */

/**
 * The model of tenx_flow_build_logs
 */
'use strict'

const modelUtil = require('./utils')
const utils = require('../utils')
const indexConfig = require('../configs')
const sql = require('../database/spliceSQL')(indexConfig.db_type)

module.exports = function (sequelize, DataTypes) {
	return sequelize.define('FlowBuildLogs', {
		build_id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    flow_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    creation_time: {
      type: DataTypes.DATE,
      defaultValue: utils.DateNow
    },
    start_time: {
      type: DataTypes.DATE
    },
    end_time: {
      type: DataTypes.DATE
    },
	},{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_ci_flow_build_logs',
    classMethods: {
      insertOne: function (build, t) {
        return this.create(build, modelUtil.setOptions(null, t))
      },
      updateById: function (build, buildId, t) {
        return this.update(build, modelUtil.setOptions({
          where: {
            build_id: buildId
          }
        }, t))
      },
      findFlowBuild: function (flowId, buildId, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            build_id: buildId,
            flow_id: flowId
          }
        }, t))
      },
      findOneById: function (flowBuildId, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            build_id: flowBuildId
          }
        }, t))
      },
      findAllOfFlow: function (flowId, size, t) {
        return this.findAll(modelUtil.setOptions({
          where: {
            flow_id: flowId
          },
          order: [['creation_time', 'desc']],
          limit: size
        }, t))
      },
      findLastBuildOfFlowWithStages: function (flowId, t) {
        let options = {
          replacements: [flowId],
          type: sequelize.QueryTypes.SELECT
        }
        if (t) {
          options.transaction = t
        }
        return sequelize.query(sql.SELECT_LAST_BUILD_OF_FLOW_WITH_STAGES_BY_FLOW_ID, options)
      },
      // Query failed/running/success flow builds
      queryFlowBuildStats: function(namespace) {
        let options = {
          replacements: [namespace],
          type: sequelize.QueryTypes.SELECT
        }
        return sequelize.query(sql.SELECT_SERVER_FLOW_BUILD_STATS, options)
      }
    }
  })
}