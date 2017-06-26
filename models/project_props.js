/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-21
 * @author Zhangpc
 * 
 */

/**
 * The model of tenx_ci_projects_props
 */
'use strict'

const utils = require('../utils')

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('ProjectProps', {
    repo_type: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    source_full_name: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    user_id: {
      type:DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    namespace: {
      type: DataTypes.STRING,
      allowNull: true,
      primaryKey: true
    },
    private_key: {
      type: DataTypes.STRING.BINARY,
      allowNull: false
    },
    public_key: {
      type: DataTypes.STRING.BINARY,
      allowNull: false
    },
    // default values for dates => current time
    create_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    },
    update_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    },
    is_add_deploy_key: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '0'
    },
    external_container_id: DataTypes.STRING,
    external_buillder_name: DataTypes.STRING,
    internal_container_id: DataTypes.STRING,
    internal_buillder_name: DataTypes.STRING
  },{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_ci_project_props',
    classMethods: {
      findOneProjectProps: function* (namespace, repoType, fullName) {
        return this.findOne({
          where: {
            namespace: namespace,
            repo_type: repoType,
            source_full_name: fullName
          }
        })
      },
      deleteOneProjectProps: function* (namespace, repoType, fullName) {
        return this.destroy({
          where: {
            namespace: namespace,
            repo_type: repoType,
            source_full_name: fullName
          }
        })
      },
      updateProjectProps: function* (namespace, repoType, fullName, projectProps) {
        return this.update(projectProps, {
          where: {
            namespace: namespace,
            repo_type: repoType,
            source_full_name: fullName
          }
        })
      },
      createOneProjectProps: function* (projectProps) {
        return this.create(projectProps)
      }
    }
  })
}