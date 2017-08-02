/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-08
 * @author Lei
 */

/**
 * The model of tenx_ci_dockerfiles
 *
 */
'use strict'

const utils = require('../utils')
const modelUtil = require('./utils')
const indexConfig = require('../configs')
const sql = require('../database/spliceSQL')(indexConfig.db_type)

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('ci_dockerfiles',
    {
      flow_id: {
        type: DataTypes.STRING(24),
        allowNull: false,
        primaryKey: true
      },
      stage_id: {
        type: DataTypes.STRING(24),
        allowNull: false,
        primaryKey: true
      },
      namespace: {
       type: DataTypes.STRING,
        allowNull: false
      },
      content: {
        type: DataTypes.BLOB,
        allowNull: false
      },
      modified_by: {
       type: DataTypes.STRING,
        allowNull: true
      },
      create_time: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: utils.DateNow
      },
      update_time: {
        type: DataTypes.DATE,
        allowNull: true
      },
      type: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    }, {
      timestamps: false,
      freezeTableName: true,
      tableName: 'tenx_ci_dockerfiles',
      classMethods: {
        // Create a new CI flow
        addDockerfile: function (file) {
          return this.create(file)
        },
        listDockerfiles: function(namespace) {
          let options = {
            replacements: [namespace],
            type: sequelize.QueryTypes.SELECT
          }
          return sequelize.query(sql.SELECT_CI_DOCKERFILES, options)
        },
        getDockerfile: function(namespace, flow_id, stage_id) {
          return this.findOne({
            where: {
              flow_id: flow_id,
              stage_id: stage_id,
              namespace: namespace
            }
          })
        },
        getAllByFlowId: function (namespace, flow_id) {
          return this.findAll({
            where: {
              flow_id: flow_id,
              namespace: namespace
            }
          })
        },
        updateDockerfile: function(namespace, flow_id, stage_id, modified_by, data) {
          data.modified_by = modified_by
          return this.update(data, {
            where: {
              flow_id: flow_id,
              stage_id: stage_id,
              namespace: namespace
            }
          })
        },
        removeByFlowId: function (namespace, flow_id, t) {
          return this.destroy(modelUtil.setOptions({
            where: {
              flow_id: {
                in: flow_id,
              },
              namespace: namespace
            }
          }, t))
        },
        removeDockerfile: function(namespace, flow_id, stage_id, t) {
          return this.destroy(modelUtil.setOptions({
            where: {
              flow_id: flow_id,
              stage_id: stage_id,
              namespace: namespace
            }
          }, t))
        }
      }
    })
}