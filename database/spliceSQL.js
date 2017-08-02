/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 *
 */

/*
 * Support for different database
 */
'use strict'

const _ = require('lodash')
const SQLCollection = {
  common: {
    // For user modal
    USER_TEST_SQL: 'select * from tenx_users',

    // For project modal
    SELECT_CI_PROJECTS_AND_BUILDS_BY_USERNAMESPACE: "select p.project_id,p.repo_type, p.project_name, p.default_tag, p.creation_time as `projectCreationTime`, build_on_change, deploy_on_push, source_full_name, clone_url, code_type, build_id, last_build_time, bb.end_time, bb.status, bb.branch_name, bb.image_tag, image_name from (select project_id, max(creation_time) as last_build_time from tenx_ci_builds group by project_id) b join tenx_ci_builds bb on b.last_build_time = bb.creation_time and b.project_id = bb.project_id right join tenx_ci_projects p on b.project_id = p.project_id where p.namespace = ? order by last_build_time desc;",
    SELECT_CI_PROJECTS_ONLY_BY_IMAGE: "SELECT * FROM tenx_ci_projects, tenx_users where tenx_ci_projects.user_id = tenx_users.user_id and image_name = ? and deploy_on_push = '1'",
    SELECT_CI_BUILD_STATUS: "select tenx_ci_projects.project_id, build_id, container_id, builder_addr, status from tenx_ci_builds, tenx_ci_projects where tenx_ci_builds.project_id = tenx_ci_projects.project_id and project_name = ? and namespace = ? and build_id = ?",
    SELECT_CI_BUILD_LOGS: "select tenx_ci_projects.project_id, build_id, container_id, builder_addr, status, build_log from tenx_ci_builds, tenx_ci_projects where tenx_ci_builds.project_id = tenx_ci_projects.project_id and project_name = ? and namespace = ? and build_id = ?",

    // for build model
    SELECT_CI_BUILD_BY_PROJECTID_AND_USERID: "select b.branch_name, b.commit_sha, p.default_tag, b.build_id, b.builder_addr, b.container_id, b.end_time, b.exit_reason, b.image_tag, b.is_webhook, b.start_time, b.status from tenx_ci_projects p left join tenx_ci_builds b on p.project_id = b.project_id where p.project_name = ? and p.namespace = ? order by b.creation_time desc limit ? offset ?",

    // for cd-rule model
    SELECT_CD_RULES_BY_USER_ID: "select tenx_cd_rules.* from tenx_cd_rules, tenx_kuber_replicator where tenx_cd_rules.replicator_id = tenx_kuber_replicator.rc_uid and user_id = ? and tenx_cd_rules.is_delete = '0'",
    //for replicator modal (tenx_kuber_replicator)
    SQL_SELECT_REPLICATOR_BY_USER_NAME: "SELECT tenx_kuber_replicator.* FROM tenx_kuber_replicator, tenx_users where tenx_users.user_id = tenx_kuber_replicator.user_id and is_deleted = '0' and user_name = ? ",
    //SQL_IS_RC_EXIST : "select count(*) as number from tenx_kuber_replicator where rc_name = ? and user_id = ? and namespace = ? and hosting_cluster = ? and is_deleted != -1",
    //SQL_UPDATE_RC_IMAGE : "update tenx_kuber_replicator set image = ? where rc_name = ? and user_id = ? and namespace = ? and hosting_cluster = ? and is_deleted != -1"
    SELECT_CD_PROJECT_BY_PROJECTNAME_AND_USER_NAMESPACE: "select t2.default_tag,t1.user_id,t2.project_id,t2.project_name,t2.image_name,t3.image,t3.hosting_cluster,t3.rc_name,t3.rc_uid from tenx_users as t1 inner join tenx_ci_projects as t2 on t1.user_id = t2.user_id inner join tenx_kuber_replicator as t3 on t1.user_id = t3.user_id where t2.namespace = ? and t2.project_name = ? and t3.image like ? and t3.is_deleted = '0' ",
    SELECT_USER_HAVE_THE_TEAMSPACE: "select * from tenx_users t1 inner join tenx_team_user_ref t2 on t1.user_id = t2.user_id inner join tenx_team_space t3 on t2.team_id = t3.team_id where t1.user_id = ? and t3.namespace = ?",

    // list flows and last flow build
    SELECT_CI_FLOW_AND_LAST_BUILD:
      "select tmp_flow.*, scount.stages_count, project_id, repo_type, default_branch, address, build_info as buildInfo " +
         //tmp_flow查找flow信息和最后一次构建时间和状态
         "from (select f.flow_id, f.name, f.owner, f.namespace, f.init_type, f.create_time, f.update_time, b.start_time as last_build_time, b.status, b.build_id as last_build_id, f.is_build_image " +
                 "from tenx_ci_flows f left join " +
                      //l1查找flow的最近构建时间，再根据时间查出构建记录
                      "(select l2.* " +
                         "from (select flow_id, max(start_time) as last_build_time " +
                                 "from tenx_ci_flow_build_logs " +
                                 "where flow_id in (select flow_id from tenx_ci_flows where namespace = ?) " +
                                 "group by flow_id) l1 left join " +
                              "tenx_ci_flow_build_logs l2 on l1.flow_id = l2.flow_id and l1.last_build_time = l2.start_time) b " +
                 "on f.flow_id = b.flow_id where namespace = ? ) tmp_flow left join " +
         //scount查找flow对应的stage数量
         "(select f.flow_id, count(s.stage_id) as stages_count, project_id, repo_type, s.build_info, default_branch, p.address, f.is_build_image " +
            "from tenx_ci_flows f left join " +
                 "tenx_ci_stages s on s.flow_id = f.flow_id left join tenx_ci_managed_projects p on s.project_id = p.id " +
            "where f.namespace= ? group by f.flow_id) scount "+
         "on scount.flow_id = tmp_flow.flow_id  where tmp_flow.is_build_image = ? " +
         "order by tmp_flow.create_time desc",
    // select flow with last build by id and namespace
    SELECT_FLOW_WITH_LAST_BUILD_BY_ID:
      "select f.*, l.start_time as last_build_time, l.status " +
        "from tenx_ci_flows f left join tenx_ci_flow_build_logs l on f.flow_id = l.flow_id " +
        "where f.flow_id = ? and f.namespace = ? order by last_build_time desc limit 1",
    // select stages with links
    SELECT_STAGES_AND_LINKS_BY_FLOW_ID:
      "select tenx_ci_stage_build_logs.build_id, tenx_ci_stage_build_logs.status, tenx_ci_stage_build_logs.pod_name, tenx_ci_stages.*, link.*, link.enabled as link_enabled, repo_type " +
        "from " +
          //根据flow_id查询所有stage的最后一次构建时间
          "(select stage.stage_id, max(build.creation_time) as build_time, repo_type " +
             "from tenx_ci_stages as stage left join tenx_ci_stage_build_logs as build on stage.stage_id = build.stage_id " +
             "LEFT JOIN tenx_ci_managed_projects AS project ON stage.project_id = project.id " +
             "where stage.flow_id = ? " +
             "group by stage.stage_id) as last_build_status " +
          //使用最后一次构建时间查询最后一次构建记录
          "left join tenx_ci_stage_build_logs " +
            "on last_build_status.stage_id = tenx_ci_stage_build_logs.stage_id " +
              "and last_build_status.build_time = tenx_ci_stage_build_logs.creation_time " +
          //查询stage信息
          "join tenx_ci_stages on last_build_status.stage_id = tenx_ci_stages.stage_id " +
          //查询link信息
          "join tenx_ci_stage_links as link on last_build_status.stage_id = source_id " +
        "order by seq",
    SELECT_EXPECTED_LAST_STAGE_OF_FLOW:
      "select * from tenx_ci_stages, (select max(seq) as maxseq from tenx_ci_stages where flow_id = ?) as m " +
        "where stage_id = ? and seq = m.maxseq",
    SELECT_BUILDS_OF_FLOW_WITH_USER:
      "select flowBuild.*, u.user_name from tenx_ci_flow_build_logs as flowBuild join tenx_users as u on flowBuild.user_id = u.user_id " +
        "where flowBuild.flow_id = ? order by creation_time desc limit ?",
    // Get dockerfiles of a namespace
    SELECT_CI_DOCKERFILES:
      "SELECT d.flow_id, d.stage_id, d.type, s.stage_name, f.name, d.create_time, d.update_time FROM tenx_ci_flows f, tenx_ci_stages s, tenx_ci_dockerfiles d where f.namespace = ? and " +
      "f.flow_id = d.flow_id and s.stage_id = d.stage_id order by d.update_time desc",
    // Deployment log of CD
    SELECT_FLOW_DEPLOYMENT_LOGS:
      "SELECT r.binding_deployment_name as app_name, r.image_name as image_name, l.target_version, c.name as cluster_name, r.upgrade_strategy, l.result, l.create_time from tenx_cd_deployment_logs l, tenx_cd_rules r, tenx_clusters c " +
      "where r.namespace = ? and r.flow_id = ? and l.cd_rule_id = r.rule_id and r.binding_cluster_id = c.id order by l.create_time desc limit ?",
    // FLow and stage build
    SELECT_LAST_BUILD_OF_FLOW_WITH_STAGES_BY_FLOW_ID:
      "SELECT f.*, stage_id, stage_name, s.status as stage_build_status, s.creation_time as stage_build_creation_time, " +
             "s.start_time as stage_build_start_time, s.end_time as stage_build_end_time, s.build_id as stage_build_build_id " +
      "FROM (SELECT * from tenx_ci_flow_build_logs where flow_id = ? ORDER BY creation_time DESC LIMIT 1) as f " +
           "LEFT JOIN tenx_ci_stage_build_logs as s ON f.build_id = s.flow_build_id " +
      "ORDER BY stage_build_creation_time ",
    // Server stats
    SELECT_SERVER_FLOW_BUILD_STATS: "SELECT status, count(*) as count FROM tenx_ci_flows f, tenx_ci_flow_build_logs b where f.flow_id = b.flow_id and f.namespace = ? group by status",
    SELECT_USER_AUTHORIZED_IMAGES: "SELECT id, image_name, image_url, category_id, category_name, is_system, description, is_allow_deletion from tenx_ci_images where namespace = ? or is_system = 1 order by category_id",
    SELECT_CHECK_DEPENDENCY_IMAGES: "SELECT 1 as count from tenx_ci_images where (namespace = ? or is_system = 1) and image_url in (?) and category_id > 100",
    SELECT_CHECK_CI_IMAGES: "SELECT 1 as count from tenx_ci_images where (namespace = ? or is_system = 1) and image_url in (?) and category_id < 100",
    SELECT_STAGES_COUNT_BY_NAMESPACE: "SELECT COUNT(*) AS num FROM tenx_ci_flows AS f JOIN tenx_ci_stages AS s ON f.flow_id = s.flow_id WHERE namespace = ?",
    SELECT_FLOWS_WITH_DOCKERFILE_COUNT:
      "SELECT f.*, count(stage_id) AS num FROM tenx_ci_flows AS f LEFT JOIN tenx_ci_dockerfiles AS d ON f.flow_id = d.flow_id " +
      "WHERE f.flow_id = ? AND f.namespace = ?"
  },
  mysql: {},
  postgres: {}
}
SQLCollection.postgres = {
  SELECT_CI_PROJECTS_AND_BUILDS_BY_USERNAMESPACE: SQLCollection.common.SELECT_CI_PROJECTS_AND_BUILDS_BY_USERNAMESPACE.replace(/`/g, '"')
}

module.exports = function spliceSQL(dbType) {
  dbType = dbType ? dbType : 'mysql'
  let commonSQL = _.cloneDeep(SQLCollection.common)
  return _.merge(commonSQL, SQLCollection[dbType])
}