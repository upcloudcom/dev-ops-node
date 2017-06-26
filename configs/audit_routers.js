/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-12-8
 * @author huangxin
 *
 */

/**
 * Routes for ci
 */
'use strict'

var index = -1

const AuditOperation = {
	AuditOperationUnknown: ++index,
	AuditOperationCreate: ++index,                 // 1
	AuditOperationGet: ++index,
	AuditOperationList: ++index,
	AuditOperationUpdate: ++index,
	AuditOperationDelete: ++index,
	AuditOperationStart: ++index,
	AuditOperationStop: ++index,
	AuditOperationRestart: ++index,
	AuditOperationPause: ++index,
	AuditOperationResume: ++index,// 10
	AuditOperationBatchDelete: ++index,
	AuditOperationBatchStart: ++index,
	AuditOperationBatchStop: ++index,
	AuditOperationBatchRestart: ++index,
	AuditOperationQuickRestart: ++index,
	AuditOperationCheckExist: ++index,
	AuditOperationFormat: ++index,
	AuditOperationExpand: ++index,// 18
}

exports.AuditOperation = AuditOperation

index = -1
const AuditResource = {
	AuditResourceUnknown: ++index,
	AuditResourceInstance: ++index,               // 1
	AuditResourceInstanceEvent: ++index,
	AuditResourceInstanceLog: ++index,
	AuditResourceInstanceMetrics: ++index,
	AuditResourceInstanceContainerMetrics: ++index,
	AuditResourceService: ++index,
	AuditResourceServiceInstance: ++index,
	AuditResourceServiceEvent: ++index,
	AuditResourceServiceLog: ++index,
	AuditResourceServiceK8sService: ++index, // 10
	AuditResourceServiceRollingUpgrade: ++index,
	AuditResourceServiceManualScale: ++index,
	AuditResourceServiceAutoScale: ++index,
	AuditResourceServiceQuota: ++index,
	AuditResourceServiceHaOption: ++index,
	AuditResourceServiceDomain: ++index,
	AuditResourceApp: ++index,
	AuditResourceAppService: ++index, // app's service
	AuditResourceAppOperationLog: ++index,
	AuditResourceAppExtraInfo: ++index, // icon etc // 20
	AuditResourceAppTopology: ++index,
	AuditResourceConfigGroup: ++index,
	AuditResourceConfig: ++index,
	AuditResourceNode: ++index,
	AuditResourceNodeMetrics: ++index,
	AuditResourceThirdPartyRegistry: ++index,
	AuditResourceVolume: ++index,
	AuditResourceVolumeConsumption: ++index, // 28

	// user
	AuditResourceUser: ++index,
	AuditResourceUserTeams: ++index,
	AuditResourceUserSpaces: ++index,

	// team
	AuditResourceTeam: ++index,
	AuditResourceTeamUsers: ++index,
	AuditResourceTeamSpaces: ++index,

	// cluster
	AuditResourceCluster: ++index,

	// ci
	AuditResourceRepos: ++index, // 36
	AuditResourceProjects: ++index,
	AuditResourceFlows: ++index,
	AuditResourceStages: ++index,
	AuditResourceLinks: ++index,
	AuditResourceBuilds: ++index,
	AuditResourceCIRules: ++index,
	AuditResourceCDRules: ++index,
	AuditResourceCIDockerfiles: ++index,
	AuditResourceCINotifications: ++index,
	AuditResourceCDNotifications: ++index,
	AuditResourceCIImages: ++index
}
exports.AuditResource = AuditResource

const project = require('../controllers/project')
const projectLink = require('../controllers/project_link')
const build = require('../controllers/build')
const repo = require('../controllers/repo')
const stage = require('../controllers/stage')
const stageLink = require('../controllers/stage_link')
const flowBuild = require('../controllers/flow_build')
const managedProject = require('../controllers/managed_project')
const ciFlow = require('../controllers/ci_flow')
const ciRule = require('../controllers/ci_rule')
const cdRule = require('../controllers/cd_rule')
const continuousDeployment = require('../controllers/continuous_deployment')
const ciDockerfiles = require('../controllers/ci_dockerfiles')
const ciImages = require('../controllers/ci_images')
const resourceQuota = require('../controllers/resource_quota')
const auth = require('../utils/auth')

exports.prefix = '/api/v2/devops'

const notificationRouters = {
  "/managed-projects/webhooks/:project_id": [
    {
      method: "post",
      middlewares: [build.updateK8sConfigs, build.invokeBuildsByWebhook],
      auditOperation: AuditOperation.AuditOperationStart,
      auditResource: AuditResource.AuditResourceCINotifications,
    }
  ],
  "/registry/notification-handler": [
    {
      method: "post",
      middlewares: [auth.basicAuth, continuousDeployment.invokeContinuousDeployment],
      auditOperation: AuditOperation.AuditOperationStart,
      auditResource: AuditResource.AuditResourceCDNotifications,
    }
  ]
}

exports.notificationRouters = notificationRouters

exports.routes = {
  // configurations for Repo
  "/repos/:type": [
    {
      method: "get",
      middlewares: [repo.getRepositories]
    }, {
      method: "delete",
      middlewares: [repo.logout],
      auditOperation: AuditOperation.AuditOperationDelete,
      auditResource: AuditResource.AuditResourceRepos,
      resourceNameParam: "type"
    }, {
      method: "post",
      middlewares: [resourceQuota.checkRepoQuota, repo.addRepository],
      auditOperation: AuditOperation.AuditOperationCreate,
      auditResource: AuditResource.AuditResourceRepos,
      resourceNameParam: "type"
    }, {
      method: "put",
      middlewares: [resourceQuota.checkRepoQuota, repo.syncRepos],
      auditOperation: AuditOperation.AuditOperationUpdate,
      auditResource: AuditResource.AuditResourceRepos,
      resourceNameParam: "type"
    }
  ],
  "/repos/supported": [{
    method: "get",
    middlewares: [repo.getSupportedRepos]
  }],
  "/repos/:type/branches": [{
    method: "get",
    middlewares: [repo.getBranches]
  }],
  "/repos/:type/tags": [{
    method: "get",
    middlewares: [repo.getTags]
  }],
  "/repos/:type/user": [{
    method: "get",
    middlewares: [repo.getUserInfo]
  }],
  "/repos/:type/auth": [{
    method: "get",
    middlewares: [repo.getAuthRedirectUrl]
  }],

  // configurations for Projects
  "/managed-projects": [
    {
      method: "post",
      middlewares: [resourceQuota.checkProjectQuota, managedProject.createManagedProject],
      auditOperation: AuditOperation.AuditOperationCreate,
      auditResource: AuditResource.AuditResourceProjects
    }, {
      method: "get",
      middlewares: [managedProject.getManagedProjects],
    }
  ],
  "/managed-projects/:project_id": [{
    method: "delete",
    middlewares: [managedProject.removeManagedProject],
    auditOperation: AuditOperation.AuditOperationDelete,
    auditResource: AuditResource.AuditResourceProjects,
    resourceIdParam: "project_id"
  }, {
    method: "get",
    middlewares: [managedProject.getManagedProjectDetail],
    auditOperation: AuditOperation.AuditOperationDelete,
    auditResource: AuditResource.AuditResourceProjects,
    resourceIdParam: "project_id"
  }],

  // configurations for Stages
  "/ci-flows/:flow_id/stages": [
    {
      method: "get",
      middlewares: [ciFlow.validateNamespace, stage.listStages]
    }, {
      method: "post",
      middlewares: [resourceQuota.checkCreatedStagesQuota, ciFlow.validateNamespace, stage.createStage],
      auditOperation: AuditOperation.AuditOperationCreate,
      auditResource: AuditResource.AuditResourceStages
    }
  ],
  "/ci-flows/:flow_id/stages/:stage_id": [
    {
      method: "delete",
      middlewares: [ciFlow.validateNamespace, stage.removeStage],
      auditOperation: AuditOperation.AuditOperationDelete,
      auditResource: AuditResource.AuditResourceStages,
      resourceIdParam: "stage_id"
    }, {
      method: "get",
      middlewares: [ciFlow.validateNamespace, stage.getStage]
    }, {
      method: "put",
      middlewares: [ciFlow.validateNamespace, stage.updateStage],
      auditOperation: AuditOperation.AuditOperationUpdate,
      auditResource: AuditResource.AuditResourceStages,
      resourceIdParam: "stage_id"
    }
  ],

  // configurations for link
  "/ci-flows/:flow_id/stages/:stage_id/link/:target_id": [{
    method: "put",
    middlewares: [ciFlow.validateNamespace, stageLink.updateLinkDirs],
    auditOperation: AuditOperation.AuditOperationUpdate,
    auditResource: AuditResource.AuditResourceLinks
  }],

  // configurations for Builds
  "/ci-flows/:flow_id/builds": [
    {
      method: "get",
      middlewares: [ciFlow.validateNamespace, flowBuild.listBuilds]
    }, {
      method: "post",
      middlewares: [build.updateK8sConfigs, flowBuild.createFlowBuild],
      auditOperation: AuditOperation.AuditOperationStart,
      auditResource: AuditResource.AuditResourceBuilds
    }
  ],
  "/ci-flows/:flow_id/lastbuild": [{
    method: "get",
    middlewares: [ciFlow.validateNamespace, flowBuild.getLastBuildDetails]
  }],
  "/ci-flows/:flow_id/builds/:flow_build_id": [{
    method: "get",
    middlewares: [ciFlow.validateNamespace, flowBuild.listStagesBuilds]
  }],
  "/ci-flows/:flow_id/stages/:stage_id/builds/:build_id/stop": [{
    method: "put",
    middlewares: [ciFlow.validateFlowAndSetAuditFlowName, flowBuild.stopBuild],
    auditOperation: AuditOperation.AuditOperationStop,
    auditResource: AuditResource.AuditResourceBuilds
  }],
  "/ci-flows/:flow_id/stages/:stage_id/builds": [{
    method: "get",
    middlewares: [ciFlow.validateNamespace, flowBuild.listBuildsOfStage]
  }],
  "/ci-flows/:flow_id/stages/:stage_id/builds/:stage_build_id/log": [{
    method: "get",
    middlewares: [ciFlow.validateNamespace, flowBuild.getBuildLogs]
  }],
  "/ci-flows/:flow_id/stages/:stage_id/builds/:stage_build_id/events": [{
    method: "get",
    middlewares: [ciFlow.validateNamespace, flowBuild.getBuildEvents]
  }],

  // configurations for CI Rules
  "/ci-flows/:flow_id/ci-rules": [
    {
      method: "get",
      middlewares: [ciFlow.validateNamespace, ciFlow.getCIRules]
    }, {
      method: "put",
      middlewares: [ciFlow.validateFlowAndSetAuditFlowName, ciFlow.updateCIRules],
      auditOperation: AuditOperation.AuditOperationUpdate,
      auditResource: AuditResource.AuditResourceCIRules
    }
  ],

  // configurations for Flows
  "/ci-flows": [
    {
      method: "post",
      middlewares: [resourceQuota.checkCreatedFlowsQuota, ciFlow.createCIFlow],
      auditOperation: AuditOperation.AuditOperationCreate,
      auditResource: AuditResource.AuditResourceFlows
    }, {
      method: "get",
      middlewares: [ciFlow.getCIFlows],
    }
  ],
  "/ci-flows/:flow_id": [
    {
      method: "get",
      middlewares: [ciFlow.getCIFlowById]
    }, {
      method: "delete",
      middlewares: [ciFlow.removeCIFlow],
      auditOperation: AuditOperation.AuditOperationDelete,
      auditResource: AuditResource.AuditResourceFlows,
      resourceIdParam: "flow_id"
    }, {
      method: "put",
      middlewares: [ciFlow.updateCIFlow],
      auditOperation: AuditOperation.AuditOperationUpdate,
      auditResource: AuditResource.AuditResourceFlows,
      resourceIdParam: "flow_id"
    }
  ],
  "/ci-flows/:flow_id/images": [{
    method: "get",
    middlewares: [ciFlow.validateNamespace, ciFlow.getImagesOfFlow]
  }],
  "/ci-flows/:flow_id/deployment-logs": [{
    method: "get",
    middlewares: [ciFlow.listDeploymentLogsOfFlow]
  }],

  // configurations for CD Rules
  "/ci-flows/:flow_id/cd-rules": [
    {
      method: "get",
      middlewares: [ciFlow.validateNamespace, cdRule.listCDRules]
    }, {
      method: "post",
      middlewares: [ciFlow.validateFlowAndSetAuditFlowName, cdRule.createCDRule],
      auditOperation: AuditOperation.AuditOperationCreate,
      auditResource: AuditResource.AuditResourceCDRules
    }
  ],
  "/ci-flows/:flow_id/cd-rules/:rule_id": [
    {
      method: "put",
      middlewares: [ciFlow.validateFlowAndSetAuditFlowName, cdRule.updateCDRule],
      auditOperation: AuditOperation.AuditOperationUpdate,
      auditResource: AuditResource.AuditResourceCDRules,
      resourceIdParam: "rule_id"
    }, {
      method: "delete",
      middlewares: [ciFlow.validateFlowAndSetAuditFlowName, cdRule.removeCDRule],
      auditOperation: AuditOperation.AuditOperationDelete,
      auditResource: AuditResource.AuditResourceCDRules,
      resourceIdParam: "rule_id"
    }
  ],
  "/cd-rules": [
    {
      method: 'get',
      middlewares: [cdRule.getDeploymentCDRule]
    },
    {
      method: 'delete',
      middlewares: [cdRule.deleteDeploymentCDRule],
      auditOperation: AuditOperation.AuditOperationDelete,
      auditResource: AuditResource.AuditResourceCDRules
    }
  ],

  // configurations for Dockerfiles
  "/dockerfiles": [{
    method: "get",
    middlewares: [ciDockerfiles.listDockerfiles]
  }],
  "/ci-flows/:flow_id/stages/:stage_id/dockerfile": [
    {
      method: "put",
      middlewares: [ciFlow.validateFlowAndSetAuditFlowName, stage.validateStageAndSetAuditStageName, ciDockerfiles.addOrUpdateDockerfile],
      auditOperation: AuditOperation.AuditOperationUpdate,
      auditResource: AuditResource.AuditResourceCIDockerfiles
    }, {
      method: "post",
      middlewares: [ciFlow.validateFlowAndSetAuditFlowName, stage.validateStageAndSetAuditStageName, ciDockerfiles.addDockerfile],
      auditOperation: AuditOperation.AuditOperationCreate,
      auditResource: AuditResource.AuditResourceCIDockerfiles
    }, {
      method: "delete",
      middlewares: [ciFlow.validateFlowAndSetAuditFlowName, stage.validateStageAndSetAuditStageName, ciDockerfiles.removeDockerfile],
      auditOperation: AuditOperation.AuditOperationDelete,
      auditResource: AuditResource.AuditResourceCIDockerfiles
    }, {
      method: "get",
      middlewares: [ciDockerfiles.getDockerfile]
    }
  ],

  "/ci/images": [
    {
      method: "get",
      middlewares: [ciImages.getAvailableImages],
      auditOperation: AuditOperation.AuditOperationGet,
      auditResource: AuditResource.AuditResourceCIImages
    }, {
      method: "post",
      middlewares: [ciImages.createNewBaseImage],
      auditOperation: AuditOperation.AuditOperationCreate,
      auditResource: AuditResource.AuditResourceCIImages
    }
  ],
  "/ci/images/:id": [
    {
      method: "delete",
      middlewares: [ciImages.deleteBaseImage],
      auditOperation: AuditOperation.AuditOperationDelete,
      auditResource: AuditResource.AuditResourceCIImages,
      resourceIdParam: "id"
    }, {
      method: "put",
      middlewares: [ciImages.updateBaseImage],
      auditOperation: AuditOperation.AuditOperationCreate,
      auditResource: AuditResource.AuditResourceCIImages,
      resourceIdParam: "id"
    }
  ]
}


