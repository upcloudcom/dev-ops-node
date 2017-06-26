/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-06-25
 * @author Zhang_Shouhong
 * 
 */

/**
 * The model of tenx_ci_projects_link
 */
'use strict'

const utils = require('../utils')

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('ProjectLink', {
    link_id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: sequelize.UUIDV4,
      primaryKey: true
    },
    source_project_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    target_project_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    source_dir: {
      type: DataTypes.STRING,
      allowNull: true
    },
    target_dir: {
      type: DataTypes.STRING,
      allowNull: true
    },
    enabled: {
      type:DataTypes.INTEGER,
      allowNull: false,
      default: 0
    },
    create_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    },
    update_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    }
  },{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_ci_project_links',
    classMethods: {
      findProjectLinkByTargetDir: function* (sourceProjectId, targetProjectId, targetDir) {
        return this.findOne({
          where: {
            source_project_id: {'$ne': sourceProjectId},
            target_project_id: targetProjectId,
            target_dir: targetDir
          }
        })
      },
      findProjectLinkBySourceProjectId: function* (projectId) {
        return this.findOne({
          where: {
            source_project_id: projectId
          }
        })
      },
      findProjectLinkByTargetProjectId: function* (projectId) {
        return this.findAll({
          where: {
            target_project_id: projectId
          }
        })
      },
      updateProjectLink: function* (linkId, projectLink) {
        return this.update(projectLink, {
          where: {
            link_id: linkId
          }
        })
      },
      createOneProjectLink: function* (projectLink) {
        return this.create(projectLink)
      },
      updateProjectLinkByProjectId: function* (projectLink, projectId) {
        return this.update(projectLink, {
          where: {
            '$or':[{
              source_project_id: projectId
            },
            {
              target_project_id: projectId
            }]
          }
        })
      } 
    }
  })
}