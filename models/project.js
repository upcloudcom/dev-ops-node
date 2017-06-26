/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 Tenxloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 * 
 */

/**
 * The model of tenx_ci_projects
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
  return sequelize.define('Project', {
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: sequelize.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    namespace: {
      type: DataTypes.STRING,
      allowNull: true
    },
    project_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    repo_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    code_type: DataTypes.STRING,
    // default values for dates => current time
    creation_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    },
    image_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    clone_url: {
      type: DataTypes.STRING,
      allowNull: false
    },
    source_full_name: DataTypes.STRING,
    webhook_initialized:  {
      type: DataTypes.STRING(1),
      allowNull: false,
      defaultValue: '0'
    },
    description: DataTypes.STRING(400),
    detail: DataTypes.TEXT,
    dockerfile_location: DataTypes.STRING,
    is_repo_private: {
      type: DataTypes.STRING,
      defaultValue: 'private'
    },
    build_on_change: { 
      type: DataTypes.STRING(1),
      allowNull: false,
      defaultValue: '0'
    },
    deploy_on_push: { 
      type: DataTypes.STRING(1),
      allowNull: false,
      defaultValue: '0'
    },
    webhook_id: DataTypes.STRING,
    ci_config: DataTypes.STRING,
    cd_config: DataTypes.STRING,
    default_tag: {
      type: DataTypes.STRING,
      defaultValue: 'latest'
    },
    use_cache: {
      type: DataTypes.STRING,
      defaultValue: 'on'
    },
    push_on_complete: {
      type: DataTypes.STRING,
      defaultValue: 'on'
    },
    default_branch:  { 
      type: DataTypes.STRING(50),
      allowNull: true
    },
    is_need_privilege: {
      type: DataTypes.STRING(5),
      allowNull: true,
      defaultValue: 'off'
    },
    gitlab_projectId: DataTypes.STRING,
    notification_config: DataTypes.STRING,
    build_image: {
      type: DataTypes.STRING(100)
    }
  },{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_ci_projects',
    classMethods: {
      findProjectById: function (id) {
        return this.findOne({
          where: {
            project_id: id
          }
        })
      },
      findProjectByName: function (namespace, projectName) {
        return this.findOne({
          where: {
            namespace: namespace,
            project_name: projectName
          }
        })
      },
      findProjectById: function (projectId) {
        return this.findOne({
          where: {
            project_id: projectId
          }
        })
      },
      updateProjectByName: function (namespace, projectName, project) {
        return this.update(project, {
          where: {
            namespace: namespace,
            project_name: projectName
          }
        })
      },
      updateProjectById: function (namespace, projectId, project) {
        return this.update(project, {
          where: {
            namespace: namespace,
            project_id: projectId
          }
        })
      },
      deleteProjectByName: function (namespace, projectName) {
        return this.destroy({
          where: {
            namespace: namespace,
            project_name: projectName
          }
        })
      },
      createOneProject: function (project) {
        return this.create(project)
      },
      checkImageName: function (namespace, imageName) {
        return this.findOne({
          where: {
            namespace: namespace,
            image_name: imageName
          }
        })
      },
      findProjectByProps: function (namespace, repoType, fullName) {
        return this.findOne({
          where: {
            namespace: namespace,
            repo_type: repoType,
            source_full_name: fullName
          }
        })
      },
      findProjectsBuildsByUserNamespace: function (namespace){
        return this.modelSelect(sql.SELECT_CI_PROJECTS_AND_BUILDS_BY_USERNAMESPACE, [namespace])
      },
      findPorjectOnlyByImage: function (repository){
        return this.modelSelect(sql.SELECT_CI_PROJECTS_ONLY_BY_IMAGE, [repository])
      },
      findProjectReplicator: function(namespace, projectName, image) {
        return this.modelSelect(sql.SELECT_CD_PROJECT_BY_PROJECTNAME_AND_USER_NAMESPACE, [namespace, projectName, `%/${image}:%`])
      },
      modelSelect: function (sql, array){
        return sequelize.query(sql, {replacements: array, type: sequelize.QueryTypes.SELECT})
      }
    }
  })
}