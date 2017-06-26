/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-08-02
 * @author Zhangpc
 * 
 */

/**
 * The model of tenx_configs
 */
'use strict'

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('Configs', {
    config_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    config_type: DataTypes.STRING(45),
    config_detail: DataTypes.STRING(2000),
    create_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    description: DataTypes.STRING(2000)
  }, {
      timestamps: false,
      freezeTableName: true,
      tableName: 'tenx_configs',
      classMethods: {
        findAllConfigs: function () {
          return this.findAll()
        },
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