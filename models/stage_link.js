/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-2
 * @author huangxin
 * 
 */

/**
 * The model of tenx_ci_stage_links
 */
'use strict'

const modelUtil = require('./utils')
const Sequelize = require('sequelize')

module.exports = function (sequelize, DataTypes) {
	return sequelize.define('StageLink', {
		source_id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    flow_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    target_id: {
      type: DataTypes.STRING
    },
    source_dir: {
      type: DataTypes.STRING
    },
    target_dir: {
      type: DataTypes.STRING
    },
    enabled: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
	},{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_ci_stage_links',
    classMethods: {
      insertOneLink: function (link, t) {
        return this.create(link, modelUtil.setOptions(null, t))
      },
      updateOneBySrcId: function (link, srcId, t) {
        return this.update(link, modelUtil.setOptions({
          where: {
            source_id: srcId
          }
        }, t))
      },
      getAllLinksOfStage: function (flowId, stageId, t) {
        return this.findAll(modelUtil.setOptions({
          // where: Sequelize.and(
          //   {flow_id: flowId}, 
          //   Sequelize.or({
          //     source_id: stageId
          //   }, {
          //     target_id: stageId
          //   })
          // )
          where: {
            flow_id: flowId,
            '$or': [
              {source_id: stageId},
              {target_id: stageId}
            ]
          }
        }, t))
      },
      getNilTargets: function (flowId, t) {
        return this.findAll(modelUtil.setOptions({
          where: {
            flow_id: flowId,
            target_id: null
          }
        }, t))
      },
      getOneBySourceId: function (sourceId, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            source_id: sourceId
          }
        }, t))
      }
    }
  })
}