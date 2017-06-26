/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 * 
 */

/*
 * The model of tenx_ci_users
 *
 * Sequelize.STRING         // VARCHAR(255)
 * Sequelize.STRING(1234)   // VARCHAR(1234)
 * 
 */
'use strict'

const utils = require('../utils')
const indexConfig = require('../configs')
const sql = require('../database/spliceSQL')(indexConfig.db_type)

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('user', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    user_name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    namespace: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    displayname: DataTypes.STRING,
    password: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    phone: DataTypes.STRING,
    avatar: DataTypes.STRING,
    creation_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    },
    last_login_time: DataTypes.DATE,
    login_frequency: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    confirm_code: DataTypes.STRING,
    active: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    api_token: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'a61df4cc4d490fabf609c0f7616cafbe4eac62eefcfca1cf'
    },
    is_3rd_account: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 0
    },
    env_edition: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    role: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
  },{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_users',
    classMethods: {
      isHaveAuthor: function(user_id, teamspace) {
        return sequelize.query(sql.SELECT_USER_HAVE_THE_TEAMSPACE, {
          replacements: [user_id, teamspace],
          type: sequelize.QueryTypes.SELECT
        })
      },
      findByToken: function* (user_name, token) {
        return yield this.findOne({
          where: {
            user_name: user_name,
            api_token: token
          }
        })
      },
      findByName: function (user_name) {
        return this.findOne({
          where: {
            user_name
          }
        })
      }
    }
  })
}