/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-12-07
 * @author YangYuBiao
 * 
 */

/**
 * The model of tenx_audit
 */
'use strict'

const utils = require('../utils')
const indexConfig = require('../configs')
const sql = require('../database/spliceSQL')(indexConfig.db_type)

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Audit', {
    id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    namespace: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cluster_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    operation_type: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    resource_type: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    resource_id: {
       type: DataTypes.STRING,
       allowNull: true
    },
    resource_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resource_config: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // default values for dates => current time
    time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    remark:  {
      type: DataTypes.STRING,
      allowNull: true,
    },
    url: DataTypes.TEXT,
    http_method: {
      type: DataTypes.STRING,
      allowNull: true
    },
    operator: { 
      type: DataTypes.STRING,
      allowNull: true,
    }
  },{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_audit',
  })
}