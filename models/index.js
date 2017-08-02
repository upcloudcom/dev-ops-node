/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 *
 */

/*
 * Support for import model
 *
 * Store model definitions in a single file and use the import method.
 * The returned object is exactly the same as defined in the imported file's function.
 * Since v1:5.0 of Sequelize the import is cached,
 * so you won't run into troubles when calling the import of a file twice or more often.
 * http://docs.sequelizejs.com/en/latest/docs/models-definition/#import
 *
 */
'use strict'

const Sequelize = require('sequelize')
const path = require('path')
const sequelize = require('../database/sequelize')

function load(name) {
  // For webpack build backend files
  if (process.env.RUNNING_MODE === 'enterprise') {
    return require(`./${name}`)(sequelize, Sequelize)
  }
  const modelPath = path.join(__root__dirname, `models/${name}`)
  return sequelize.import(modelPath)
}

module.exports = {
  sequelize: sequelize,
  Project: load('project'),
  ProjectProps: load('project_props'),
  ProjectLink: load('project_link'),
  // Build: load('build'),
  User: load('user'),
  UserPreference: load('user_preference'),
  Replicator: load('replicator'),
  UserOperationRecord: load('user_operation_record'),
  Repo: load('repo'),
  Stage: load('stage'),
  StageLink: load('stage_link'),
  FlowBuild: load('flow_build'),
  StageBuild: load('stage_build'),
  BuildAgent: load('build_agent'),
  CIRule: load('ci_rule'),
  CDRule: load('cd_rule'),
  TenxConfigs: load('tenx_configs'),
  DeployDetail: load('deploy_detail'),
  Configs: load('configs'),
  Clusters: load('clusters'),
  ManagedProject: load('managed_project'),
  ResourceQuota: load('resource_quota'),
  CIFlow: load('ci_flow'),
  CIDockerfiles: load('ci_dockerfiles'),
  CIScripts: load('ci_scripts'),
  Audit: load('audit'),
  DeploymentLogs: load('cd_deployment_logs'),
  CIImages: load('ci_images'),
  query: function* (sql, args) {
    let options = { replacements: args }
    let data = yield this.sequelize.query(sql, options)
    if (/select /i.test(sql)) {
      return data[0]
    }
    return data[1]
  },
  queryOne: function* (sql, args) {
    let rows = yield* this.query(sql, args)
    return rows && rows[0]
  },
  healthCheck: function* () {
    let rows = yield* this.query('select * from tenx_ci_flows limit 1')
    return rows && rows[0]
  }
}