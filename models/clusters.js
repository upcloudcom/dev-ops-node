/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-08-02
 * @author Zhangpc
 * 
 */

/**
 * The model of tenx_clusters
 */
'use strict'

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Clusters', {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue:DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true
    },
    api_protocol: DataTypes.STRING(45),
    api_host: DataTypes.STRING(200),
    api_token: DataTypes.STRING(200),
    api_version: DataTypes.STRING(8),
    description: DataTypes.TEXT,
    creation_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    config_detail: {
      type: DataTypes.STRING(500),
      defaultValue: '{}'
    },
    /*plugin_namespace: {
      type: DataTypes.STRING(45),
      defaultValue: 'kube-system'
    },
    cluster_display_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true
    },*/
    public_ips: DataTypes.STRING(1000),
    binding_domain: DataTypes.STRING(1000),
    monitor: DataTypes.STRING(1000),
    web_terminal_domain: DataTypes.STRING(500),
    storage: DataTypes.STRING(45),
    is_default: DataTypes.INTEGER
  },{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_clusters',
    classMethods: {
      findClusterById: function (id) {
        return this.findOne({
          where: {
            id: id
          }
        })
      },
      findAllCluster: function() {
        return this.findAll()
      },
      modelSelect: function (sql, params) {
        return sequelize.query(sql, { replacements: params, type: sequelize.QueryType.SELECT })
      }
    }
  })
}