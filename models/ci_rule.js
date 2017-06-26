/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-27
 * @author YangYuBiao
 * 
 */

/**
 * The model of tenx_ci_rules
 */
'use strict'

const utils = require('../utils')

module.exports = function (sequelize, DataTypes) {
  return sequelize.define("ci_rule", {
    ruleId: {
      field: 'rule_id',
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    projectId: {
      field: 'project_id',
      type: DataTypes.UUID,
      allowNull: false
    },
    type: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    dockerfileLocation: {
      field: 'dockerfile_location',
      type: DataTypes.STRING(200),
      allowNull: true
    },
    tag: {
      field: 'our_image_tag',
      type: DataTypes.STRING(45),
      allowNull: true
    },
    createTime: {
      field: 'create_time',
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: utils.DateNow
    },
    is_delete: {
      type: DataTypes.STRING(1),
      allowNull: true,
      defaultValue: 0
    },
    delete_time: {
      type: DataTypes.DATE,
      allowNull: true,
    }
  }, {
      timestamps: false,
      freezeTableName: true,
      tableName: 'tenx_ci_rules',
      classMethods: {
        findOneRuleByCondition: function (condition) {
          return this.findOne({
            where: condition
          })
        },
        findAllRuleByCondition: function (condition) {
          return this.findAll({
            where: condition
          })
        },
        deleteByCondition: function (condition) {
          return this.update({
            is_delete: '1',
            delete_time: utils.DateNow()
          },
            {
              where: condition
            })
        },
        updateByCondition: function (entity, condition) {
          return this.update(entity, {
            where: condition
          })
        },
        modelSelect: function (sql, parmas) {
          return sequelize.query(sql, { replacements: parmas, type: sequelize.QueryTypes.SELECT })
        }
      }
    })
}