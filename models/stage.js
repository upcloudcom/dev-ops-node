/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-2
 * @author huangxin
 * 
 */

/**
 * The model of tenx_ci_stages
 */
'use strict'
const utils = require('../utils')
const indexConfig = require('../configs')
const sql = require('../database/spliceSQL')(indexConfig.db_type)
const modelUtil = require('./utils')

module.exports = function (sequelize, DataTypes) {
	return sequelize.define('Stage', {
		stage_id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    flow_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stage_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    project_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    default_branch: {
      type: DataTypes.STRING,
      allowNull: true
    },
    seq: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    type: {
      type: DataTypes.INTEGER,
      default: 5
    },
    custom_type: {
      type: DataTypes.STRING
    },
    image: {
      type: DataTypes.STRING,
      allowNull: false
    },
    container_info: {
      type: DataTypes.BLOB,
      allowNull: true
    },
    build_info: {
      type: DataTypes.BLOB,
      allowNull: true
    },
    ci_enabled: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    ci_config: {
      type: DataTypes.STRING,
      allowNull: true
    },
    creation_time: {
      type: DataTypes.DATE,
      defaultValue: utils.DateNow
    },
	},{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_ci_stages',
    classMethods: {
      insertOneStage: function (stage, t) {
        return this.create(stage, modelUtil.setOptions(null, t))
      },
      countBySpace: function (namespace) {
        let options = {
          replacements: [namespace],
          type: sequelize.QueryTypes.SELECT
        }
        return sequelize.query(sql.SELECT_STAGES_COUNT_BY_NAMESPACE, options)
      },
      updateOneById: function (stageId, stage, t) {
        return this.update(stage, modelUtil.setOptions({
          where: {
            stage_id: stageId
          }
        }, t))
      },
      deleteById: function (stageId, t) {
        return this.destroy(modelUtil.setOptions({
          where: {
            stage_id: stageId
          }
        }, t))
      },
      findOneById: function (stageId, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            stage_id: stageId
          }
        }, t))
      },
      findByIds: function (flowId, ids, t) {
        return this.findAll(modelUtil.setOptions({
          where: {
            stage_id: {
              $in: ids
            },
            flow_id: flowId
          }
        }, t))
      },
      findOneByName: function (flowId, name, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            flow_id: flowId,
            stage_name: name
          }
        }, t))
      },
      findFlowMaxSeq: function (flowId, t) {
        return this.max('seq', modelUtil.setOptions({
          where: {
            flow_id: flowId
          }
        }, t))
      },
      findFirstOfFlow: function (flowId, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            flow_id: flowId
          },
          order: 'seq'
        }, t))
      },
      findNextOfFlow: function (flowId, seq, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            flow_id: flowId,
            seq: {
              gt: seq
            }
          },
          order: 'seq'
        }, t))
      },
      findWithLinksByFlowId: function (flowId, t) {
        let options = {
          replacements: [flowId],
          type: sequelize.QueryTypes.SELECT
        }
        if (t) {
          options.transaction = t
        }
        return sequelize.query(sql.SELECT_STAGES_AND_LINKS_BY_FLOW_ID, options)
      },
      findExpectedLast: function (flowId, stageId, t) {
        let options = {
          replacements: [flowId, stageId],
          type: sequelize.QueryTypes.SELECT
        }
        if (t) {
          options.transaction = t
        }
        return sequelize.query(sql.SELECT_EXPECTED_LAST_STAGE_OF_FLOW, options)
      },
      findByProjectId: function(projectId) {
        return this.findOne({
          where: {
            project_id: projectId
          },
          order: 'seq'
        })
      },
      findByProjectIdAndCI: function(projectId, ci_enabled) {
        return this.findAll({
          where: {
            project_id: projectId,
            ci_enabled: ci_enabled
          }
        })
      },
      findBuildEnabledStages: function(flowId) {
        return this.findAll({
          where: {
            flow_id: flowId,
            $not: [
              {
                build_info: null
              }
            ]
          }
        })
      }
    }
  })
}
