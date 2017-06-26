--
-- Table structure for table `tenx_ci_repos`
--
CREATE TABLE IF NOT EXISTS `tenx_ci_repos` (
  `cut_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'token id',
  `user_id` int(11) NOT NULL,
  `namespace` varchar(255) COLLATE utf8_bin DEFAULT NULL,
  `repo_type` varchar(45) CHARACTER SET armscii8 COLLATE armscii8_bin DEFAULT NULL COMMENT '1=github\n2=bitbucket\n3=tce\n4=gitcafe\n6=gitlab\n5=gitlab\n5=coding',
  `access_token` varchar(200) CHARACTER SET armscii8 COLLATE armscii8_bin DEFAULT NULL,
  `access_user_name` varchar(100) CHARACTER SET utf8 DEFAULT NULL COMMENT 'depot''s user_name',
  `create_time` datetime DEFAULT NULL,
  `access_refresh_token` varchar(200) CHARACTER SET utf8 DEFAULT NULL,
  `access_token_secret` varchar(200) CHARACTER SET utf8 DEFAULT NULL,
  `user_info` varbinary(2000) DEFAULT NULL COMMENT '用户信息，包括组织信息 JSON格式',
  `repo_list` blob COMMENT '项目列表 JSON',
  `gitlab_url` varchar(300) COLLATE utf8_bin DEFAULT NULL COMMENT '存储用户gitlab地址',
  `is_encrypt` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否加密，0=未加密，1=加密',
  PRIMARY KEY (`cut_id`)
) ENGINE=InnoDB AUTO_INCREMENT=200 DEFAULT CHARSET=utf8 COLLATE=utf8_bin COMMENT='用户token表(持续集成)';

--
-- Table structure for table `tenx_ci_builds`
--
DROP TABLE IF EXISTS `tenx_ci_builds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenx_ci_builds` (
  `build_id` varchar(45) NOT NULL,
  `project_id` varchar(45) NOT NULL,
  `branch_name` varchar(100) DEFAULT NULL,
  `commit_sha` varchar(45) DEFAULT NULL,
  `image_tag` varchar(100) DEFAULT NULL,
  `status` varchar(45) DEFAULT NULL COMMENT '0 = ''success''\n1 = ''fail''\n2 = ''building''\n3 = ''waitting''',
  `creation_time` datetime DEFAULT NULL,
  `build_log` mediumblob,
  `start_time` datetime DEFAULT NULL,
  `container_id` varchar(100) DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `builder_addr` varchar(100) DEFAULT NULL COMMENT 'build镜像主机的IP地址',
  `is_webhook` varchar(1) DEFAULT '0',
  `exit_reason` varchar(1) DEFAULT '0',
  PRIMARY KEY (`build_id`),
  KEY `project_id` (`project_id`),
  KEY `project_id_2` (`project_id`),
  KEY `project_id_3` (`project_id`),
  CONSTRAINT `project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `tenx_ci_projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='用户build表(持续集成)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenx_ci_project_props`
--
DROP TABLE IF EXISTS `tenx_ci_project_props`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenx_ci_project_props` (
  `repo_type` varchar(45) NOT NULL COMMENT '0=unknown\n1=github\n2=bitbucket\n3=tce',
  `source_full_name` varchar(100) NOT NULL,
  `user_id` int(11) NOT NULL,
  `private_key` varbinary(5000) NOT NULL,
  `public_key` varbinary(500) NOT NULL,
  `create_time` datetime NOT NULL,
  `update_time` datetime NOT NULL,
  `external_container_id` varchar(100) DEFAULT NULL,
  `external_buillder_name` varchar(45) DEFAULT NULL,
  `internal_container_id` varchar(100) DEFAULT NULL,
  `internal_buillder_name` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`repo_type`,`source_full_name`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='a table for save repo  private/public keys and project container id';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenx_ci_projects`
--
DROP TABLE IF EXISTS `tenx_ci_projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenx_ci_projects` (
  `project_id` varchar(45) NOT NULL,
  `user_id` int(11) NOT NULL,
  `project_name` varchar(100) DEFAULT NULL,
  `repo_type` varchar(45) DEFAULT NULL COMMENT '0=unknown\n1=github\n2=bitbucket\n3=tce\n4=gitcafe\n5=coding',
  `code_type` varchar(45) DEFAULT NULL COMMENT '1=nodejs ',
  `creation_time` datetime DEFAULT NULL,
  `image_name` varchar(100) DEFAULT NULL,
  `clone_url` varchar(200) DEFAULT NULL,
  `source_full_name` varchar(100) DEFAULT NULL,
  `webhook_initialized` varchar(45) DEFAULT '0' COMMENT 'whether web_hook is initialized',
  `description` varchar(400) DEFAULT NULL COMMENT '简介',
  `detail` text COMMENT '详细信息',
  `dockerfile_location` varchar(200) DEFAULT NULL,
  `is_repo_private` varchar(45) DEFAULT NULL,
  `build_on_change` varchar(1) DEFAULT '0',
  `webhook_id` varchar(20) DEFAULT NULL COMMENT 'Id of webhook',
  `ci_config` varchar(100) DEFAULT NULL,
  `cd_config` varchar(100) DEFAULT NULL,
  `default_tag` varchar(50) DEFAULT NULL,
  `default_branch` varchar(50) DEFAULT NULL,
  `use_cache` varchar(5) NOT NULL DEFAULT 'on',
  `gitlab_projectId` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='用户项目表（持续集成）';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenx_ci_rules`
--
CREATE TABLE IF NOT EXISTS `tenx_ci_rules` (
  `rule_id` varchar(45) NOT NULL,
  `project_id` varchar(45) NOT NULL,
  `type` varchar(45) DEFAULT '0' COMMENT '1 为tag\n2 为brance',
  `name` varchar(100) DEFAULT NULL,
  `dockerfile_location` varchar(200) DEFAULT NULL,
  `our_image_tag` varchar(45) DEFAULT NULL COMMENT '1 代码分支\n2 时间戳\nstring 客户自己输入',
  `create_time` datetime DEFAULT NULL,
  `is_delete` char(1) DEFAULT '0',
  `delete_time` datetime DEFAULT NULL,
  PRIMARY KEY (`rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Table structure for table `tenx_cd_rules`
--
CREATE TABLE IF NOT EXISTS `tenx_cd_rules` (
  `rule_id` varchar(45) NOT NULL,
  `project_id` varchar(45) DEFAULT NULL,
  `replicator_id` varchar(45) DEFAULT NULL,
  `version` varchar(45) DEFAULT NULL,
  `update_strategy` char(2) DEFAULT '1' COMMENT '升级方式\n1 为普通升级\n2 为灰度升级',
  `is_delete` char(1) DEFAULT '0',
  `create_time` datetime DEFAULT NULL,
  `delete_time` datetime DEFAULT NULL,
  PRIMARY KEY (`rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `tenx_ci_project_links` (
  `link_id` varchar(45) NOT NULL,
  `source_project_id` varchar(45) DEFAULT NULL,
  `target_project_id` varchar(45) DEFAULT NULL,
  `source_dir` varchar(100) DEFAULT NULL,
  `target_dir` varchar(100) DEFAULT NULL,
  `enabled` tinyint(1) NOT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  PRIMARY KEY (`link_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='用户项目联结表（持续集成）';
