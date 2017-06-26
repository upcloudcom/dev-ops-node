/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-02
 * @author Lei
 */

/**
 * The model of tenx_ci_flows
 *
 */
'use strict'

const utils = require('../utils')
const modelUtil = require('./utils')
const indexConfig = require('../configs')
const sql = require('../database/spliceSQL')(indexConfig.db_type)

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('ci_flow',
    {
      flow_id: {
        type: DataTypes.STRING(24),
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      owner: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      namespace: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      init_type: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      notification_config: {
        type: DataTypes.STRING(200),
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
      uniform_repo: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1
      },
      is_build_image: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
    }, {
      timestamps: false,
      freezeTableName: true,
      tableName: 'tenx_ci_flows',
      classMethods: {
        // Create a new CI flow
        createOneFlow: function (flow, t) {
          return this.create(flow, modelUtil.setOptions(null, t))
        },
        countBySpace: function (namespace) {
          return this.count({
            where: {
              namespace: namespace
            }
          })
        },
        findFlowByName: function(namespace, name) {
          return this.findAll({
            where: {
              namespace: namespace,
              name: name
            }
          })
        },
        findFlowById: function(namespace, id) {
          return this.findOne({
            where: {
              flow_id: id,
              namespace: namespace
            }
          })
        },
        findWithDockerfileCountById: function (namespace, id) {
          let options = {
            replacements: [id, namespace],
            type: sequelize.QueryTypes.SELECT
          }
          return sequelize.query(sql.SELECT_FLOWS_WITH_DOCKERFILE_COUNT, options)
        },
        updateFlowById: function(namespace, id, flow) {
          return this.update(flow, {
            where: {
              flow_id: id,
              namespace: namespace
            }
          })
        },
        listFlowsAndLastBuild: function (namespace, isBuildImage) {
          let options = {
            replacements: [namespace, namespace, namespace, isBuildImage],
            type: sequelize.QueryTypes.SELECT
          }
          return sequelize.query(sql.SELECT_CI_FLOW_AND_LAST_BUILD, options)
        },
        listFlowsAndLastBuildAndImage: function(namespace) {

        },
        findFlowWithLastBuildById: function (namespace, id) {
          let options = {
            replacements: [id, namespace],
            type: sequelize.QueryTypes.SELECT
          }
          return sequelize.query(sql.SELECT_FLOW_WITH_LAST_BUILD_BY_ID, options)
        },
        removeFlow: function(namespace, id) {
          // CI stages / CI stage-links / CD rules / stage(flow) log /Dockerfiles will be cascade removed
          return this.destroy({
            where: {
              flow_id: {
                in: id
              },
              namespace: namespace
            }
          })
        }
      }
    })
}