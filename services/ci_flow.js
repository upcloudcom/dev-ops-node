/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2017 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-02
 * @author Lei
 */

/**
 * Service for ci flows
 */
'use strict'

const CIFlow           = require('../models').CIFlow
const Stage            = require('../models').Stage
const CIDockerfiles    = require('../models').CIDockerfiles
const logger           = require('../utils/logger').getLogger('service/repo')
const idGenerator      = require('../utils/id_generator')
const stageService     = require('./stage')
const stageLinkService = require('./stage_link')
const indexConfig      = require('../configs')
const YAML             = require('js-yaml')
const serviceUtils     = require('./utils')
const modelUtil        = require('../models/utils')

const resourceQuotaService = require('./resource_quota')

exports.validateNamespace = function* (user, flowId) {
  let flow = yield CIFlow.findFlowById(user.namespace, flowId)
  if (!flow) {
    return false
  }
  return true
}

// Add a flow
exports.createCIFlow = function* (user, flow, isBuildImage) {
  var method = 'createCIFlow'
  let rec = yield _checkAndGenFlow(user, flow)
  if (rec.status > 299) {
    return rec
  }
  rec.is_build_image= isBuildImage
  var result = yield CIFlow.createOneFlow(rec)

  return {
    status: 200,
    "flow_id": rec.flow_id,
    "message": "Flow created successfully"
  }
}

// List flow for specified user
exports.listCIFlow = function* (namespace, isBuildImage) {
  const results = yield CIFlow.listFlowsAndLastBuild(namespace, isBuildImage)
  if (!results) {
    return {
      status: 200,
      message: 'No flow added yet'
    }
  }
  // Remove unnecessary info from the result
  let flowSet = {}
  let flows = []
  results.forEach(function(flow) {
    if (flowSet[flow.flow_id]) {
      return
    }
    flow.notification_config = undefined
    flow.cd_rule_id = undefined
    if(flow.buildInfo) {
      flow.image = JSON.parse(flow.buildInfo.toString('utf8')).image
      delete flow.buildInfo
    }
    flowSet[flow.flow_id] = true
    flows.push(flow)
  })
  return {
    status: 200,
    total: results.length,
    results: flows
  }
}

// Remove a flow
exports.removeCIFlow = function* (namespace, flowId, auditInfo) {
  let flow = yield CIFlow.findFlowById(namespace, flowId)
  if (!flow) {
    return {
      status: 404,
      message: "No flow found matching the flow id"
    }
  }
  auditInfo.resourceName = flow.name
  yield CIDockerfiles.removeByFlowId(namespace, flowId)

  yield CIFlow.removeFlow(namespace, flowId)
  return {
    status: 200,
    message: "Flow removed successfully"
  }
}

// Get a flow by id
exports.getFlowById = function* (namespace, flowId) {
  let records = yield CIFlow.findFlowWithLastBuildById(namespace, flowId)
  if (!records || records.length < 1) {
    return {
      status: 404,
      message: "No flow found mathcing the flow id"
    }
  }
  let flowInfo = records[0]
  // Get the stages info of the flow
  let stageInfo = yield stageService.listStagesOfFlow(flowId)
  var results = JSON.parse(JSON.stringify(flowInfo))
  if (stageInfo.status === 200) {
    results.stage_info = stageInfo.results
  }
  return {
    status: 200,
    results
  }
}

exports.getFlowOnly = function* (namespace, flowId) {
  let flowInfo = yield CIFlow.findFlowById(namespace, flowId)
  if (!flowInfo) {
    return {
      status: 404,
      message: "No flow found mathcing the flow id"
    }
  }
  return {
    status: 200,
    results: flowInfo
  }
}

exports.getFlowYamlById = function* (namespace, flowId) {
  let flowInfo = yield CIFlow.findFlowById(namespace, flowId)
  if (!flowInfo) {
    return {
      status: 404,
      message: "No flow found mathcing the flow id"
    }
  }
  let results = {
    kind: 'CiFlow',
    name: flowInfo.name
  }
  if (flowInfo.notification_config) {
    try {
      results.notification = JSON.parse(flowInfo.notification_config)
    } catch (e) {
      logger.error('Failed to parse notification config:', flowInfo.notification_config)
    }
  }
  let stageInfo = yield stageService.listStagesOfFlow(flowId)
  if (stageInfo.status === 200) {
    let stages = []
    stageInfo.results.forEach(function (s) {
      let stage = {
        name: s.metadata.name,
        type: s.metadata.type,
        customType: s.metadata.customType,
        project: s.spec.project,
        container: s.spec.container,
        build: s.spec.build,
        ci: s.spec.ci,
      }
      if (s.link) {
        delete(s.link.target)
      }
      stage.link = s.link
      stages.push(stage)
    })
    results.stages = stages
  }
  return {
    status: 200,
    results: YAML.dump(JSON.parse(JSON.stringify(results)))
  }
}

// Get a flow by id
exports.getImagesOfFlow = function* (user, flowId) {
  let flow = yield CIFlow.findFlowById(user.namespace, flowId)
  if (!flow) {
    return {
      status: 404,
      message: "No flow found mathcing the flow id"
    }
  }
  // Get the stages info of the flow
  let stageList = yield Stage.findBuildEnabledStages(flowId)
  let imageList = []
  stageList.forEach(function(stage) {
    var build_info = JSON.parse(stage.build_info.toString())
    if (build_info.project && build_info.project != "") {
      imageList.push({
        projectId: build_info.projectId || 0,
        imageName: build_info.project + '/' + build_info.image
      })
    } else {
      imageList.push({
        projectId: build_info.projectId || 0,
        imageName: indexConfig.default_push_project  + '/' + build_info.image
      })
    }
  })
  return {
    status: 200,
    images: imageList
  }
}

// Update a flow
exports.updateCIFlow = function* (namespace, flowId, flow) {
  // Update the update time
  flow.update_time = new Date()
  let results = yield CIFlow.updateFlowById(namespace, flowId, flow)
  if (!results || results < 1) {
    return {
      status: 404,
      message: "No flow found mathcing the flow id"
    }
  }
  // Convert to string
  if (typeof flow.notification_config === 'object') {
    flow.notification_config = JSON.stringify(flow.notification_config)
  }
  return {
    status: 200,
    message: "Flow updated successfully"
  }
}

exports.updateForUniformRepo= function* (namespace, flowId, stage) {
  const flow = yield CIFlow.findOne({
    where: {
      namespace,
      flow_id: flowId,
    }
  })
  const uniformRepo = stage.spec.uniformRepo
  if (uniformRepo === flow.uniform_repo) {
    return
  }
  const updateArray = []
  updateArray.push(CIFlow.update({
    uniform_repo: uniformRepo
  }, {
    where: {
      namespace,
      flow_id: flowId,
    }
  }))
  if (uniformRepo === 0) {
    updateArray.push(Stage.update({
      project_id: stage.spec.project.id,
      default_branch: stage.spec.project.branch,
    }, {
      where: {
        flow_id: flowId,
      }
    }))
  }
  return yield updateArray
}

exports.createFlowByYaml = function* (user, yaml, auditInfo, isBuildImage) {
  const method = 'createFlowByYaml'
  let records = yield _checkYamlAndGenRecords(user, yaml, auditInfo)
  if (records.status > 299) {
    return records
  }
  if(isBuildImage) {
    records.flowRec.is_build_image = isBuildImage
  }
  yield modelUtil.trans(function (t) {
    return CIFlow.createOneFlow(records.flowRec, t)
    .then(function () {
      return _insertStageRecs(records.flowRec.flow_id, 0, records.stagesWithLink, t)
    })
  })
  auditInfo.resourceId = records.flowRec.flow_id
  return {
    status: 200,
    "flow_id": records.flowRec.flow_id,
    "message": "Flow created successfully"
  }
}

function _insertStageRecs(flowId, i, records, t) {
  if (i < records.length) {
    return stageService.insertStageRec(flowId, records[i].stageRec, records[i].linkRec, t).then(function () {
      return _insertStageRecs(flowId, i + 1, records, t)
    })
  }
  return
}

function* _checkYamlAndGenRecords(user, yaml, auditInfo) {
  const method = "_checkYamlAndGenRecords"
  let flowDef
  // 解析yaml
  try {
    flowDef = YAML.safeLoad(yaml)
  } catch (err) {
    logger.error(method, 'Failed to parse yaml:', err)
    return serviceUtils.responseBadRequest('Failed to parse yaml')
  }
  auditInfo.resourceName = flowDef.name

  //检查flow字段
  let flowRec = yield _checkAndGenFlow(user, {
    name: flowDef.name,
    init_type: 2,
    notification_config: flowDef.notification
  })
  if (flowRec.status > 299) {
    return flowRec
  }

  let stagesWithLink = []
  let names = {}
  if (flowDef.stages) {
    let previousLink
    for (var i in flowDef.stages) {
      //检查stage字段
      let stageRec = yield stageService.checkAndGenStage({
        metadata: {
          name: flowDef.stages[i].name,
          type: flowDef.stages[i].type,
          customType: flowDef.stages[i].customType
        },
        spec: {
          project: flowDef.stages[i].project,
          container: flowDef.stages[i].container,
          build: flowDef.stages[i].build,
          ci: flowDef.stages[i].ci
        }
      }, user)
      if (stageRec.status > 299) {
        return stageRec
      }
      if (names[flowDef.stages[i].name]) {
        return serviceUtils.responseForbidden('Could not set repeated stage name')
      }
      names[flowDef.stages[i].name] = true
      stageRec.seq = parseInt(i) + 1

      //检查link字段
      if (flowDef.stages[i].link) {
        let check = stageLinkService.checkLink(flowDef.stages[i].link)
        if (check.status > 299) {
          return check
        }
        if (previousLink) {
          check = stageLinkService.checkLinkedDirsOfStage(previousLink.targetDir, flowDef.stages[i].link.sourceDir)
          if (check.status > 299) {
            return check
          }
        }
      }

      let rec = {stageRec}
      if (previousLink) {
        rec.linkRec = {
          enabled: previousLink.enabled,
          source_dir: previousLink.sourceDir,
          target_dir: previousLink.targetDir
        }
      }
      stagesWithLink.push(rec)
      previousLink = flowDef.stages[i].link
    }
  }
  let result = yield resourceQuotaService.checkStageCreation(user, stagesWithLink.length)
  if (result.status > 299) {
    return result
  }
  return {
    flowRec,
    stagesWithLink
  }
}

function* _checkAndGenFlow(user, flow) {
  var resData = {}
  if (!flow || !flow.name || flow.name === "") {
    resData.status = 400
    resData.message ='Missing flow name'
    return resData
  }
  if (!flow.init_type || (flow.init_type != 1 && flow.init_type != 2)) {
    resData.status = 400
    resData.message ='Invalid init_type, must be 1 (user interface) or 2 (yaml)'
    return resData
  }
  // Check if the ci flow alreay exists
  let results = yield CIFlow.findFlowByName(user.namespace, flow.name)
  if (results && results.length > 0) {
    return {
      status: 409,
      "message": "Flow (name - '" + flow.name + "') already exists"
    }
  }
  // Generate a shortid before insert the new record
  flow.flow_id = idGenerator.newCIFlowID()
  flow.owner = user.name
  flow.namespace = user.namespace
  flow.create_time = new Date()
  // Convert to string
  if (flow.notification_config && typeof flow.notification_config === 'object') {
    flow.notification_config = JSON.stringify(flow.notification_config)
  }
  return flow
}