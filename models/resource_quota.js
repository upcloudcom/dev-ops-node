/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2017-1-4
 * @author huangxin
 * 
 */

'use strict';

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('ResourceQuota', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    namespace: {
      type: DataTypes.STRING,
      allowNull: false
    },
    limit_type: {
      type: DataTypes.INTEGER,
      allowNull: false,
      default: 0
    },
    limit_details: {
      type: DataTypes.STRING,
      allowNull: false
    }
  },{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_resource_quotas',
    classMethods: {
      findOneByNamespace: function (namespace) {
        return this.findOne({
          where: {
            namespace: namespace
          }
        })
      }
    }
  })
}