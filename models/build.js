/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author YangYuBiao
 * 
 */

/**
 * The model of tenx_ci_bulids
 *
 * Sequelize.STRING         // VARCHAR(255)
 * Sequelize.STRING(1234)   // VARCHAR(1234)
 * 
 */
'use strict'

const utils = require('../utils')
const indexConfig = require('../configs')
const sql = require('../database/spliceSQL')(indexConfig.db_type)

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('builds',
    {
      build_id: {
        type: DataTypes.UUID,
        allowNull: false, 
        primaryKey: true,
        defaultValue:DataTypes.UUIDV4
      },
      project_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      branch_name: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      commit_sha: {
        type: DataTypes.STRING(45), 
        allowNull: true
      },
      image_tag: {
        type: DataTypes.STRING(100), 
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(45), 
        allowNull: true
      },
      creation_time: {
        type: DataTypes.DATE, 
        allowNull: false,
        defaultValue: utils.DateNow
      },
      build_log: {
        type: DataTypes.BLOB('medium'),
        allowNull: true
      },
      start_time: {
        type: DataTypes.DATE, 
        allowNull: false,
        defaultValue: utils.DateNow
      },
      container_id: {
        type: DataTypes.STRING(100), 
        allowNull: true
      },
      end_time: {
        type: DataTypes.DATE, 
        allowNull: true
      },
      builder_addr: {
        type: DataTypes.STRING(100), 
        allowNull: true
      },
      is_webhook: {
        type: DataTypes.STRING(1), 
        allowNull: true, 
        defaultValue: '0'
      },
      exit_reason: {
        type: DataTypes.STRING(1), 
        allowNull: true, 
        defaultValue: '0'
      },
      dockerfile_location: {
        type: DataTypes.STRING(200)
      },
      pull_image_status: {
        type: DataTypes.INTEGER
      }
    }, {
      timestamps: false,
      freezeTableName: true,
      tableName: 'tenx_ci_builds',
      classMethods: {
        findBuildById: function (projectId, buildId) {
          return this.findOne({
            where: {
              build_id: buildId,
              project_id: projectId
            }
          })
        },
        findBuildByBuilderAddr: function (builderName) {
          return this.count({
            where: {
              builder_addr: builderName,
              status: {
                $in: ['2','3']
              }
            }
          })
        },
        updateBuildById: function (projectId, buildId, build) {
          return this.update(build, {
            where: {
              build_id: buildId,
              project_id: projectId
            }
          })
        },
        deleteBuildById: function (projectId, buildId) {
          return this.destroy({
            where: {
              build_id: buildId,
              project_id: projectId
            }
          })
        },
        createOneBuild: function (build) {
          return this.create(build)
        },
        getProjectBuildsCountBySatus: function (projectId, statusArray) {
          return this.count({
            where: {
              project_id: projectId,
              status: {
                $in: statusArray
              }
            }
          })
        },
        getProjectBuildsBySatus: function (projectId, statusArray) {
          return this.findAll({
            where: {
              project_id: projectId,
              status: {
                $in: statusArray
              }
            }
          })
        },
        getProjectLastBuild: function (projectId) {
          return this.findOne({
            where: {
              project_id: projectId,
              status: {
                $notIn: ['2', '3']
              },
              container_id: {
                $not: null
              }
            },
            order: 'creation_time DESC'
          })
        },
        getProjectBuilds: function (projectName, namespace, start, pageSize) {
          return this.modelSelect(sql.SELECT_CI_BUILD_BY_PROJECTID_AND_USERID, [projectName, namespace, pageSize, start])
        },
        getBuildStatus: function (projectName, namespace, buildId) {
          return this.modelSelect(sql.SELECT_CI_BUILD_STATUS, [projectName, namespace, buildId])
        },
        getBuildLogs: function (projectName, namespace, buildId) {
          return this.modelSelect(sql.SELECT_CI_BUILD_LOGS, [projectName, namespace, buildId])
        },
        modelSelect: function (sql, array){
          return sequelize.query(sql, {replacements: array, type: sequelize.QueryTypes.SELECT})
        }
      }
    })
}