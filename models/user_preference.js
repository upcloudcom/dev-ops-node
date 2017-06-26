/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2017-2-13
 * @author huangxin
 * 
 */

/**
 * The model of tenx_user_preference
 */
'use strict'
const utils = require('../utils')
// const indexConfig = require('../configs')
// const sql = require('../database/spliceSQL')(indexConfig.db_type)
const modelUtil = require('./utils')

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('UserPreference', {
    id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    owner_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    config_detail: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    owner_namespace: {
      type: DataTypes.STRING,
      allowNull: false
    },
    create_time: {
      type: DataTypes.DATE,
      defaultValue: utils.DateNow
    },
  },{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_user_preference',
    classMethods: {
      findOneOf3rdPartyById: function (id, namespace, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            id,
            owner_namespace: namespace,
            type: '3rdparty-registry'
          }
        }, t))
      },
      findOneOfPubHub: function (namespace, t) {
        return this.findOne(modelUtil.setOptions({
          where: {
            owner_namespace: namespace,
            type: 'tenxcloud-hub'
          }
        }, t))
      }
    }
  })
}
