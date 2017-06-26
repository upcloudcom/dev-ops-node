/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-12
 * @author Lei
 * 
 */

/**
 * The model of tenx_cd_rules
 */
'use strict'

const utils = require('../utils')

module.exports = function (sequelize, DataTypes) {
  return sequelize.define("cd_rule", {
    rule_id: {
      field:'rule_id',
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    namespace: {
      field:'namespace',
      type: DataTypes.STRING,
      allowNull: false
    },
    flow_id: {
      field: "flow_id",
      type: DataTypes.STRING,
      allowNull: false
    },
    image_name: {
      field: "image_name",
      type: DataTypes.STRING,
      allowNull: false,
    },
    binding_cluster_id: {
      field:'binding_cluster_id',
      type: DataTypes.STRING,
      allowNull: false
    },
    binding_deployment_id: {
      field:'binding_deployment_id',
      type: DataTypes.STRING,
      allowNull: false
    },
    binding_deployment_name: {
      field:'binding_deployment_name',
      type: DataTypes.STRING,
      allowNull: false
    },
    upgrade_strategy: {
      field:'upgrade_strategy',
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    match_tag: {
      field: "match_tag",
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    enabled: {
      field: "enabled",
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    create_time: {
      field:'create_time',
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    },
    update_time: {
      field:'update_time',
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
      timestamps: false,
      freezeTableName: true,
      tableName: 'tenx_cd_rules',
      classMethods: {
        // Create a new rule
        createOneRule: function(namespace, rule) {
          rule.namespace = namespace
          return this.create(rule)
        },
        listRulesByFlowId: function(namespace, flow_id) {
          return this.findAll({
            where: {
              namespace: namespace,
              flow_id: flow_id,
              enabled: 1
            }
          })
        },
        findMatchingRule: function(namespace, flow_id, image_name, match_tag, clusterId, deploymentName) {
          return this.findOne({
            where: {
              namespace: namespace,
              flow_id: flow_id,
              image_name: image_name,
              match_tag: match_tag,
              binding_cluster_id: clusterId,
              binding_deployment_name: deploymentName,
              enabled: 1
            }
          })
        },
        updateRuleById: function(namespace, flow_id, rule_id, rule) {
          return this.update(rule, {
            where: {
              rule_id: rule_id,
              namespace: namespace,
              flow_id: flow_id
            }
          })
        },
        removeRule: function(namespace, flow_id, rule_id) {
          return this.update({enabled: 0}, {
            where: {
              rule_id: rule_id,
              namespace: namespace,
              flow_id: flow_id
            }
          })
        },
        findEnabledRuleByImage: function(imageName) {
          return this.findAll({
            where: {
              image_name: imageName,
              enabled: 1
            }
          })
        },
        findDeploymentCDRule: function (namespace, cluster, name) {
          return this.findAll({
            where: {
              namespace: namespace,
              binding_cluster_id: cluster,
              binding_deployment_name: {
                  in: name
              }
            }
          })
        },
        deleteDeploymentCDRule: function(namespace, cluster, name) {
          return this.destroy({
            where: {
              namespace: namespace,
              binding_cluster_id: cluster,
              binding_deployment_name: {
                  in: name
              }
            }
          })
        }
      }
    })
}
