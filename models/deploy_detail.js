/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-08-02
 * @author Yangyubiao
 *
 */

'use strict'

const utils = require('../utils')

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('deploy_detail',
    {
       Id: {
         type: DataTypes.UUID,
         allowNull: false,
         primaryKey: true,
         defaultValue: DataTypes.UUIDV4
       },
       projectId: {
         type: DataTypes.STRING(45),
         allowNull: true
       },
       image_tag: {
         type: DataTypes.STRING(100),
         allowNull: true
       },
       project_name: {
         type: DataTypes.STRING(255),
         allowNull: true
       },
       rc_uid: {
         type: DataTypes.STRING(2000),
         allowNull: true
       },
       status: {
         type: DataTypes.STRING(45),
         allowNull: true
       },
       cd_rule_id: {
          type: DataTypes.STRING(2000),
          allowNull: true
       },
       create_time: {
         type: DataTypes.DATE,
         allowNull: true,
         defaultValue: utils.DateNow
       }
    }, 
    {
      timestamps: false,
      freezeTableName: true,
      tableName: 'tenx_deploy_detail',
      classMethods: {
        findDeployDetailByProjectId: function(projectId, pageIndex, pageSize) {
          return this.findAll({
            where: {
              projectId: projectId
            },
            limit: pageSize,
            offset: (pageIndex - 1) * pageSize,
            order: [['create_time', 'DESC']]
          })
        },
        modelSelect: function(sql, array) {
          return sequelize.query(sql, {
            replaceMement: array,
            type: sequelize.QueryTypes.SELECT
          })
        }
      }
  })
}