/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-01
 * @author Lei
 */

/**
 * The model of tenx_managed_projects
 *
 */
'use strict'

const utils = require('../utils')

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('managed_project',
    {
      id: {
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
      is_private: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      repo_type: {
        type: DataTypes.STRING(10),
        allowNull: false
      },
      source_full_name: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      address: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      gitlab_project_id: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      private_key: {
        type: DataTypes.STRING.BINARY,
        allowNull: true
      },
      public_key: {
        type: DataTypes.STRING.BINARY,
        allowNull: true
      },
      deploy_key_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      webhook_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      webhook_url: {
        type: DataTypes.STRING,
        allowNull: true
      },
      create_time: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: utils.DateNow
      }
    }, {
      timestamps: false,
      freezeTableName: true,
      tableName: 'tenx_ci_managed_projects',
      classMethods: {
        // Create a new managed project
        createOneProject: function (project) {
          return this.create(project)
        },
        findProjectByNameType: function(namespace, name, type) {
          return this.findAll({
            where: {
              namespace: namespace,
              name: name,
              repo_type: type
            }
          })
        },
        findProjectByAddressType: function(namespace, address, type) {
          return this.findAll({
            where: {
              namespace,
              address,
              repo_type: type
            }
          })
        },
        findProjectById: function(namespace, id) {
          return this.findOne({
            where: {
              id: id,
              namespace: namespace
            }
          })
        },
        findProjectOnlyById: function(id) {
          return this.findOne({
            where: {
              id: id
            }
          })
        },
        listProjects: function(namespace) {
          return this.findAll({
            where: {
              namespace: namespace
            },
            order: 'create_time DESC'
          })
        },
        listProjectsByType: function(namespace, repo_type) {
          return this.findAll({
            where: {
              namespace: namespace,
              repo_type: repo_type
            },
            order: 'create_time DESC'
          })
        },
        removeProject: function(namespace, id) {
          return this.destroy({
            where: {
              id: id,
              namespace: namespace
            }
          })
        }
      }
    })
}