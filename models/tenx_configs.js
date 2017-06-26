/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-08-10
 * @author Zhangpc
 * 
 */

/**
 * The model of tenx_configs
 */
'use strict'

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('tenx_configs',
    {
      config_id: {
        type: DataTypes.STRING(45),
        allowNull: false,
        primaryKey: true
      },
      config_type: {
        type: DataTypes.STRING(45),
        allowNull: true
      },
      config_detail: {
        type: DataTypes.STRING(2000),
        allowNull: true
      },
      create_time: {
        type: DataTypes.DATE,
        allowNull: true
      },
      description: {
        type: DataTypes.STRING(2000),
        allowNull: true
      }
    }, {
      timestamps: false,
      freezeTableName: true,
      tabaleName: 'tenx_configs',
      classMethods: {
        findTenxConfig: function (configType) {
          return this.findOne({
            where: {
              config_type: configType
            }
          })
        },
        modelSelect: function (sql, params) {
          return sequelize.query(sql, { replacements: params, type: sequelize.QueryType.SELECT })
        }
      }
    })
}