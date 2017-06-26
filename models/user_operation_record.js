/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
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

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('UserOperationRecord', {
    op_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue:DataTypes.UUIDV4
    },
    op_type: {
      type: DataTypes.STRING(45),
      allowNull: false
    },
    op_name: {
      type: DataTypes.STRING(45),
      allowNull: false
    },
    hosting_cluster: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    oped_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    oped_name: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    oped_config: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    op_timestrap: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    },
    remark: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  },{
    tableName: 'tenx_user_operation_record',
    timestamps: false,
    freezeTableName: true,
    classMethods:{}
  })
}