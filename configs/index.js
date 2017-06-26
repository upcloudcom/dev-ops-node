/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-18
 * @author Zhangpc
 *
 */

/*
 * base config
 */
'use strict'
const env = process.env

const repo_info = {
 scm_image: env.CICD_REPO_CLONE_IMAGE || 'tenx_containers/clone-repo:v2.0',
 clone_location: '/app'
}

const cd_config = {
  cooldown_seconds: 30
}

const config = {
  url: 'https://portal.tenxcloud.com',
  protocol: 'http',
  host: '0.0.0.0',
  db_type: env.DB_TYPE || 'mysql',
  mode: env.RUNNING_MODE || 'enterprise',
  port: 8090,
  session_secret: 'tenxcloud_ci_cd_secret_carrot', // 务必修改
  auth_cookie_name: 'tenxcloud_ci_cd',
  production: true,
  system_user: {
    user: env.SYSTEM_USER || 'system',
    password: env.SYSTEM_PASSWORD || '31e120b3-512a-4e3b-910c-85c747fb1ec2'
  },
  default_image_builder: env.CICD_IMAGE_BUILDER_IMAGE || 'tenx_containers/image-builder:v2.2',
  default_push_project: 'public',
  repo_info,
  shared_volume: {
    build_dir: '/tenxcloud/build_cache/',
    build_at_same_node: true
  },
  flow_detail_url: env.USERPORTAL_URL + '/ci_cd/tenx_flow/tenx_flow_build' || 'https://portal.tenxcloud.com/ci_cd/tenx_flow/tenx_flow_build',
  cd_config,
  tailLines: 200
}

module.exports = config
