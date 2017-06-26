/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-26
 * @author Lei
 *
 */

/**
 * The model of ci_images
 *
 */
'use strict'

const utils = require('../utils')
const indexConfig = require('../configs')
const sql = require('../database/spliceSQL')(indexConfig.db_type)

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('ci_images',
    {
      id: {
        type: DataTypes.STRING(24),
        allowNull: false,
        primaryKey: true
      },
      image_name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      image_url: {
        type: DataTypes.STRING(1000),
        allowNull: true
      },
      namespace: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      category_name: {
        type: DataTypes.STRING(40),
        allowNull: false
      },
      is_system: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      description: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      create_time: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: utils.DateNow
      },
      is_allow_deletion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      }
    }, {
      timestamps: false,
      freezeTableName: true,
      tableName: 'tenx_ci_images',
      classMethods: {
        getImagesByNamespace: function(namespace) {
          let options = {
            replacements: [namespace],
            type: sequelize.QueryTypes.SELECT
          }
          return sequelize.query(sql.SELECT_USER_AUTHORIZED_IMAGES, options)
        },
        // Create a new base image for CI
        createNewBaseImage: function(imageInfo) {
          return this.create(imageInfo)
        },
        // Update a new base image for CI
        updateBaseImage: function(id, namespace, imageInfo) {
          return this.update(imageInfo, {
            where: {
              id,
              namespace,
            }
          })
        },
        updateBaseImageById: function(id, imageInfo) {
          return this.update(imageInfo, {
            where: {
              id,
            }
          })
        },
        // Delete a new base image for CI
        deleteImage: function(id, namespace) {
          return this.destroy({
            where: {
              id,
              namespace,
              is_allow_deletion: 0,
            }
          })
        },
        deleteImageById: function(id) {
          return this.destroy({
            where: {
              id,
              is_allow_deletion: 0,
            }
          })
        },
        isValidImages: function(isDependent, namespace, images) {
          if (!images || images.length < 1) {
            return true
          }
          let sqlStatement = sql.SELECT_CHECK_CI_IMAGES
          if (isDependent) {
            sqlStatement = sql.SELECT_CHECK_DEPENDENCY_IMAGES
          }
          let options = {
            replacements: [namespace, images.toString()],
            type: sequelize.QueryTypes.SELECT
          }
          return sequelize.query(sqlStatement, options).then(function(result) {
            if (result && result.length > 0) {
              return true
            } else {
              return false
            }
          })
        }
      }
    })
}