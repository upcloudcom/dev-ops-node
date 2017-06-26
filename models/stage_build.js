/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-5
 * @author huangxin
 * 
 */

/**
 * The model of tenx_stage_build_logs
 */
'use strict'

const modelUtil = require('./utils')
const utils = require('../utils')

module.exports = function (sequelize, DataTypes) {
	return sequelize.define('StageBuildLogs', {
		build_id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    flow_build_id: {
      type: DataTypes.STRING
    },
    stage_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stage_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    job_name: {
      type: DataTypes.STRING
    },
    pod_name: {
      type: DataTypes.STRING
    },
    node_name: {
      type: DataTypes.STRING
    },
    namespace: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    is_first: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    build_alone: {
      type: DataTypes.INTEGER,
      defaultValue: 0
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
    branch_name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },
	},{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_ci_stage_build_logs',
    classMethods: {
      findAllByIdWithStatus: function (stageId, status, t) {
        return this.findAll(modelUtil.setOptions({
          where: {
            stage_id: stageId,
            status
          },
          order: 'creation_time'
        }, t))
      },
      findAllOfFlowBuild: function (flowBuildId, t) {
        return this.findAll(modelUtil.setOptions({
          where: {
            flow_build_id: flowBuildId
          },
          order: 'creation_time'
        }, t))
      },
      findAllOfStage: function (stageId, size, t) {
        return this.findAll(modelUtil.setOptions({
          where: {
            stage_id: stageId
          },
          order: [['creation_time', 'desc']],
          limit: size
        }, t))
      },
      findUnfinishedByFlowBuildId: function (flowBuildId, t) {
        return this.findAll(modelUtil.setOptions({
          where: {
            flow_build_id: flowBuildId,
            status: {
              gt: 1
            }
          }
        }, t))
      },
      findOneById: function (buildId, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            build_id: buildId
          }
        }, t))
      },
      findOneOfStageByFlowBuildId: function (flowBuildId, stageId, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            flow_build_id: flowBuildId,
            stage_id: stageId
          }
        }, t))
      },
      insertOne: function (build, t) {
        return this.create(build, modelUtil.setOptions(null, t))
      },
      deleteById: function (buildId, t) {
        return this.destroy(modelUtil.setOptions({
          where: {
            build_id: buildId
          }
        }, t))
      },
      updateById: function (build, buildId, t) {
        return this.update(build, modelUtil.setOptions({
          where: {
            build_id: buildId
          }
        }, t))
      },
      findStageBuild: function (stageId, stageBuildId, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            build_id: stageBuildId,
            stage_id: stageId
          }
        }, t))
      }
    }
  })
}