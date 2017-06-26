/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-18
 * @author Zhangpc
 * 
 */

/**
 * The model of tenx_ci_repos
 */
'use strict'

const utils = require('../utils')
const security = require('../utils/security')

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Repo', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
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
    repo_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    access_token: DataTypes.STRING,
    access_user_name: DataTypes.STRING,
    access_refresh_token: DataTypes.STRING,
    access_token_secret: DataTypes.STRING,
    create_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    },
    user_info: {
      type: DataTypes.STRING.BINARY 
    },
    repo_list: DataTypes.BLOB,
    gitlab_url: DataTypes.STRING,
    is_encrypt: {
      type:DataTypes.INTEGER,
      allowNull: false,
      default: 0
    }
  },{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_ci_repos',
    classMethods: {
      findOneRepo: function (namespace, repoType) {
        return this.findOne({
          where: {
            namespace: namespace,
            repo_type: repoType
          }
        }).then(function (result) {
          return _decryptRepoAuthInfo(result)
        })
      },
      findOneRepoToken: function (namespace, repoType) {
        return this.findOne({
          where: {
            namespace: namespace,
            repo_type: repoType
          },
          attributes: ['user_id', 'repo_type', 'access_token', 'access_user_name', 'access_refresh_token', 'access_token_secret', 'gitlab_url', 'user_info', 'is_encrypt']
        }).then(function (result) {
          return _decryptRepoAuthInfo(result)
        })
      },
      deleteOneRepo: function (namespace, repoType) {
        return this.destroy({
          where: {
            namespace: namespace,
            repo_type: repoType
          }
        })
      },
      updateOneRepo: function (namespace, repoType, repo) {
        repo = _encryptRepoAuthInfo(repo)
        return this.update(repo, {
          where: {
            namespace: namespace,
            repo_type: repoType
          }
        })
      },
      createOneRepo: function (repo) {
        repo = _encryptRepoAuthInfo(repo)
        return this.create(repo)
      },
      getGitlabRepo: function (namespace, repoType) {
        return this.findOne({
          where: {
            namespace: namespace,
            repo_type: repoType
          },
          attributes:['access_token', 'access_user_name', 'gitlab_url']
        }).then(function (result) {
          return _decryptRepoAuthInfo(result)
        })
      },
    }
  })
  
  function _encryptRepoAuthInfo(repoInfo) {
    repoInfo.access_token = security.encryptContent(repoInfo.access_token)
    repoInfo.access_user_name = security.encryptContent(repoInfo.access_user_name)
    repoInfo.token_secret = security.encryptContent(repoInfo.token_secret)
    return repoInfo
  }
  
  function _decryptRepoAuthInfo(repoInfo) {
    if (!repoInfo || repoInfo.is_encrypt !== 1) {
      return repoInfo
    }
    repoInfo.access_token = security.decryptContent(repoInfo.access_token)
    repoInfo.access_user_name = security.decryptContent(repoInfo.access_user_name)
    repoInfo.token_secret = security.decryptContent(repoInfo.token_secret)
    return repoInfo
  }
}