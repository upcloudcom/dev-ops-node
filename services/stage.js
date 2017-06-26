/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-1
 * @author huangxin
 *
 */

/**
 * Service for stage
 */
'use strict'

const idGenerator = require('../utils/id_generator.js')
const Stage = require('../models').Stage
const StageLink = require('../models').StageLink
const CIFlow = require('../models').CIFlow
const Project = require('../models').ManagedProject
const Dockerfile = require('../models').CIDockerfiles
const CIImage = require('../models').CIImages
const UserPreference = require('../models').UserPreference
const modelUtil = require('../models/utils')
const logger = require('../utils/logger').getLogger('service/stage')
const serviceUtils = require('./utils');
const indexConfig = require('../configs')
const ciFlowService = require('./ci_flow')

// stage类型：1-单元测试，2-代码编译，3-构建镜像，4-集成测试，5-自定义
const BUILD_IMAGE_STAGE_TYPE = 3
const DEFAULT_STAGE_TYPE = BUILD_IMAGE_STAGE_TYPE
const CUSTOM_STAGE_TYPE = 5
const STAGE_TYPE_MIN = 1
const STAGE_TYPE_MAX = CUSTOM_STAGE_TYPE

// Dockerfile来源：1-代码库，2-在线创建的
const FROM_REPO = 1
const ONLINE = 2
const DEFAULT_FROM = FROM_REPO
const FROM_MIN = FROM_REPO
const FROM_MAX = ONLINE

// 镜像仓库类型：1-为本地仓库 2-为DockerHub 3-为自定义
const LOCAL_REGISTRY = 1
const CUSTOM_REGISTRY = 3
const DEFAULT_REGISTRY_TYPE = LOCAL_REGISTRY
const REGISTRY_TYPE_MIN = LOCAL_REGISTRY
const REGISTRY_TYPE_MAX = CUSTOM_REGISTRY

// 镜像tag类型：1-代码分支为tag 2-时间戳为tag 3-自定义tag
const BRANCH_TAG = 1
const CUSTOM_TAG = 3
const DEFAULT_TAG_TYPE = BRANCH_TAG
const TAG_TYPE_MIN = BRANCH_TAG
const TAG_TYPE_MAX = CUSTOM_TAG

exports.customRegistryType = CUSTOM_REGISTRY

// 检查字段有效性，并生成数据库记录
// 注：数据库记录中不包含flow_id和seq，插入数据库前需要手动设置
exports.checkAndGenStage = function* (stage, user) {
  const method = 'checkAndGenStage'
  let results = yield _checkAndSetDefaults(stage, user)
  if (results && results.status) {
    logger.error(method, 'Invalid stage error:', results)
    return results
  }
  stage = results.newStage
  let stageRec = {
    stage_id: idGenerator.newStageID(),
    stage_name: stage.metadata.name,
    // namespace: user.namespace,
    project_id: stage.spec.project.id,
    default_branch: stage.spec.project.branch,
    type: stage.metadata.type,
    custom_type: stage.metadata.customType,
    image: stage.spec.container.image,
    ci_enabled: stage.spec.ci ? stage.spec.ci.enabled : 0,
    ci_config: stage.spec.ci ? JSON.stringify(stage.spec.ci.config) : null
  }
  delete(stage.spec.container.image)
  stageRec.container_info = JSON.stringify(stage.spec.container)
  if (stage.spec.build) {
    stageRec.build_info = JSON.stringify(stage.spec.build)
  }

  return stageRec
}

// 插入stage记录并更新link
// 注：字段有效性须提前判断
exports.insertStageRec = function (flowId, stageRec, previousLink, t) {
  const method = 'insertStageRec'
  stageRec.flow_id = flowId
  //stage插入新记录
  return Stage.insertOneStage(stageRec, t)
  //获取flow的tail stage
  .then(function () {
    return StageLink.getNilTargets(flowId, t)
  })
  //更新link
  .then(function (tails) {
    let stageLink = {
      source_id: stageRec.stage_id,
      flow_id: flowId
    }
    if (tails.length < 2) {
      //没有或只有一个tail时，将当前stage作为tail插入flow
      return StageLink.insertOneLink(stageLink, t).then(function () {
        if (tails.length === 1) {
          //存在tail时，更新旧tail的target为新建的stage
          let oldTail = {
            target_id: stageRec.stage_id
          }
          //如果指定了旧tail与当前stage的link directories，则一并更新
          if (previousLink) {
            oldTail.enabled = previousLink.enabled
            oldTail.source_dir = previousLink.source_dir
            oldTail.target_dir = previousLink.target_dir
          }
          //更新link
          return StageLink.updateOneBySrcId(oldTail, tails[0].source_id, t).then(function () {
            return stageRec
          })
        }
        //无tail时，不操作
        return stageRec
      })
    }
    // 多个tail时，在日志中记录警告
    logger.warn(method, `New Stage cannot be appended automotically because there is more than one tail of ${flowId}`)
    return stageRec
  })
}

exports.appendStageIntoFlow = function* (user, flowId, stage) {
  const method = 'appendStageIntoFlow'
  let results = yield _checkFlowId(user.namespace, flowId)
  if (results && results.status) {
    return results
  }

  let stageRec = yield this.checkAndGenStage(stage, user)

  if (stageRec.status > 299) {
    return stageRec
  }

  results = yield _checkUnique(flowId, stage.metadata.name)
  if (results && results.status) {
    return results
  }

  // 当用户勾选 “当前流水线所有任务（包括新建任务），统一使用该代码库” 时，更新其他 state 以及 flow
  yield ciFlowService.updateForUniformRepo(user.namespace, flowId, stage)
  delete stage.spec.uniformRepo

  let self = this
  yield modelUtil.trans(function (t) {
    return Stage.findFlowMaxSeq(flowId, t)
    //插入stage
    .then(function (maxSeq) {
      stageRec.seq = maxSeq ? maxSeq + 1 : 1
      stageRec.flow_id = flowId
      return self.insertStageRec(flowId, stageRec, null, t)
    })
  })

  return serviceUtils.responseSuccess({
    stageId: stageRec.stage_id
  })
}

exports.listStagesOfFlow = function* (flowId) {
  const method = 'ListStageOfFlow'
  let stages = yield Stage.findWithLinksByFlowId(flowId)
  logger.debug('Stages with links: ', stages)
  let results = []
  stages.forEach(function (stage) {
    if (results[stage.seq - 1]) {
      return
    }
    results.push(_formatStage(stage))
  })
  return serviceUtils.responseSuccess(results)
}

exports.getStageOfFlow = function* (flowId, stageId) {
  const method = 'getStageOfFlow'
  let stage = yield this.getAndCheckMemberShip(flowId, stageId)
  if (stage.status) {
    return stage
  }
  return serviceUtils.responseSuccess(_formatStage(stage))
}

exports.getFirstStageOfFlow = function *(flowId) {
  let stage = yield Stage.findFirstOfFlow(flowId)
  if (!stage) {
    return serviceUtils.responseNotFound('Stage cannot be found')
  }
  return serviceUtils.responseSuccess(_formatStage(stage))
}

exports.extractCIRules = function (stage) {
  if (stage.spec && stage.spec.ci) {
    return stage.spec.ci
  }
  return {enabled: 0}
}

exports.replaceCIRules = function (stage, rules) {
  if (stage.spec) {
    stage.spec.ci = rules
  }
  return stage
}

exports.updateStageOfFlow = function* (user, flowId, stageId, stage) {
  const method = 'editStageOfFlow'
  //获取stage并检查stage是否属于flow
  let oldStage = yield this.getAndCheckMemberShip(flowId, stageId)
  if (oldStage.status) {
    return oldStage
  }
  //检查提交的stage字段有效性
  let results = yield _checkAndSetDefaults(stage, user)
  if (results && results.status) {
    logger.error(method, 'Invalid stage error:', results)
    return results
  }
  stage = results.newStage

  let stageRec
  if (oldStage.stage_name !== stage.metadata.name) {
    // 修改name时判断是否唯一
    results = yield _checkUnique(flowId, stage.metadata.name)
    if (results && results.status) {
      return results
    }
    stageRec = {
      stage_name: stage.metadata.name
    }
  }

  // 当用户勾选 “当前流水线所有任务（包括新建任务），统一使用该代码库” 时，更新其他 state 以及 flow
  yield ciFlowService.updateForUniformRepo(user.namespace, flowId, stage)
  delete stage.spec.uniformRepo

  //更新一些字段
  stageRec = _updateFields(oldStage, stageRec, {
    stage_name: stage.metadata.name,
    project_id: stage.spec.project.id,
    default_branch: stage.spec.project.branch,
    type: stage.metadata.type,
    custom_type: stage.metadata.customType,
    image: stage.spec.container.image,
    ci_enabled: stage.spec.ci ? stage.spec.ci.enabled : 0,
    ci_config: stage.spec.ci ? JSON.stringify(stage.spec.ci.config) : null
  })
  //更新container_info字段
  delete(stage.spec.container.image)
  stageRec = _updateField(oldStage, stageRec, 'container_info',
    Object.keys(stage.spec.container).length > 0 ? JSON.stringify(stage.spec.container) : null)
  //更新build_info字段
  if (stage.spec.build) {
    stageRec = stageRec ? stageRec : {}
    stageRec = _updateField(oldStage, stageRec, 'build_info', JSON.stringify(stage.spec.build))
  } else if (oldStage.build_info) {
    //数据库记录有build_info，请求中没有.spec.build时，清空build_info
    stageRec = stageRec ? stageRec : {}
    stageRec.build_info = null
  }
  //存在数据更新时，访问数据库
  if (stageRec && Object.keys(stageRec).length > 0) {
    yield modelUtil.trans(function (t) {
      // 更新 stage
      return Stage.updateOneById(stageId, stageRec, t)
      .then(function () {
        // Delete Dockerfile if it's to use the one from code repository
        let dockerfileFrom = 1
        if (stage.spec.build) {
          dockerfileFrom = stage.spec.build.DockerfileFrom
        }
        logger.info(method, "dockerfileFrom: " + dockerfileFrom)
      })
    })
    yield Stage.updateOneById(stageId, stageRec)
  }
  return serviceUtils.responseSuccess({stageId})
}

exports.deleteStageOfFlow = function* (flowId, stageId, auditInfo) {
  //检查是否为flow的最后一个stage
  let stages = yield Stage.findExpectedLast(flowId, stageId)
  if (0 === stages.length) {
    return serviceUtils.responseForbidden('Only the last stage of the flow can be removed')
  }
  auditInfo.resourceName = stages[0].stage_name
  yield Stage.deleteById(stageId)
  return serviceUtils.responseSuccess({stageId})
}

//根据stageId获取stage，并检查flow与stage的从属关系是否正确
exports.getAndCheckMemberShip = function* (flowId, stageId) {
  let stage = yield Stage.findOneById(stageId)
  if (stage) {
    if (flowId === stage.flow_id) {
      return stage
    }
    logger.error(method, `Invalid member ship between flow ${flowId} and stage ${stageId}`)
    return serviceUtils.responseConflict('Stage does not belong to Flow')
  }
  return serviceUtils.responseNotFound('Stage cannot be found')
}

exports.isBuildImageStage = function (type) {
  return type === BUILD_IMAGE_STAGE_TYPE
}

//更新指定字段为指定值，如果值相同则不更新
//mapping的key为字段，value为更新的值
function _updateFields(oldRec, newRec, mapping) {
  for (let field in mapping) {
    newRec = _updateField(oldRec, newRec, field, mapping[field])
  }
  return newRec
}

function _updateField(oldRec, newRec, field, newValue) {
  if (oldRec[field] !== newValue) {
    if ('string' === typeof newValue && oldRec[field] && oldRec[field].toString() === newValue) {
      //字符串值相等时不需修改
      return newRec
    }
    newRec = newRec ? newRec : {}
    // undefined转为null，使得sequelize可以将对应字段更新为NULL
    newRec[field] = undefined === newValue ? null : newValue
  }
  return newRec
}

//检查提交的stage字段，同时为有默认值的未赋值字段设置默认值
function* _checkAndSetDefaults(stage, user) {
  const method = '_checkStage'
  let results = yield _checkRequired(stage)
  //检查required字段
  if (results) {
    return results
  }
  // let result = yield CIImage.isValidImages(false, stage.metadata.namespace, [stage.spec.container.image])
  let result = yield CIImage.isValidImages(false, user.namespace, [stage.spec.container.image])
  if (!result) {
    return serviceUtils.responseBadRequest(`Unknown build image: ${stage.spec.container.image}`)
  }
  if (stage.spec.project && stage.spec.project.id) {
    let project = yield Project.findProjectOnlyById(stage.spec.project.id)
    if (!project) {
      return serviceUtils.responseForbidden(`Project does not exist`)
    }
    stage.spec.project.branch = stage.spec.project.branch
  } else {
    stage.spec.project = {
      id: null,
      branch: null
    }
  }

  if (stage.spec.container.dependencies && stage.spec.container.dependencies.length > 0) {
    let images = []
    for (var i in stage.spec.container.dependencies) {
      // TODO: Check if the dependencies exist first
      images.push(stage.spec.container.dependencies[i].service)
    }
    // let result = yield CIImage.isValidImages(true, stage.metadata.namespace, images)
    let result = yield CIImage.isValidImages(true, user.namespace, images)
    if (!result) {
      return serviceUtils.responseBadRequest(`Unknown dependency service ${images}`)
    }
  }

  //检查type范围
  const type = stage.metadata.type ? stage.metadata.type : DEFAULT_STAGE_TYPE
  if ('number' !== typeof type || type < STAGE_TYPE_MIN || type > STAGE_TYPE_MAX) {
    return serviceUtils.responseForbidden(`Invalid .metadata.type`)
  }

  // 自定义类型时，检查是否设置了自定义类型的文本
  if (CUSTOM_STAGE_TYPE === type &&
      ('string' !== typeof stage.metadata.customType || !stage.metadata.customType.trim())) {

    return serviceUtils.responseForbidden(`.metadata.customType is required with custom stage type`)
  }
  stage.metadata.type = type
  stage.metadata.customType = CUSTOM_STAGE_TYPE === type ? stage.metadata.customType.trim() : ''
  if (BUILD_IMAGE_STAGE_TYPE === type) {
    // stage.spec.container.image = indexConfig.default_image_builder
    // stage.spec.container.args = ['/build.sh']
    // stage.spec.container.env

    // stage为构建镜像类型时，需要.spec.build.image
    if (!stage.spec.build || !stage.spec.build.image) {
      return serviceUtils.responseForbidden(`.spec.build.image is required with this stage type`)
    }
    let parts = stage.spec.build.image.split('/')
    stage.spec.build.image = parts[parts.length - 1].toLowerCase()

    if (stage.spec.build.image.search(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/) < 0) {
      return serviceUtils.responseForbidden(`.spec.build.image contains invalid character(s)`)
    }

    let dockerfileFrom = stage.spec.build.DockerfileFrom ? stage.spec.build.DockerfileFrom : DEFAULT_FROM
    //检查.spec.build.DockerfileFrom范围
    if ('number' !== typeof dockerfileFrom || dockerfileFrom < FROM_MIN || dockerfileFrom > FROM_MAX) {
      return serviceUtils.responseForbidden(`Invalid .spec.build.DockerfileFrom`)
    }
    stage.spec.build.DockerfilePath = stage.spec.build.DockerfilePath ? stage.spec.build.DockerfilePath : '/' // default to '/'
    stage.spec.build.DockerfileName = stage.spec.build.DockerfileName ? stage.spec.build.DockerfileName : '' // default to empty
    stage.spec.build.DockerfileName = dockerfileFrom === ONLINE ? 'Dockerfile' : stage.spec.build.DockerfileName
    stage.spec.build.DockerfileFrom = dockerfileFrom

    //检查.spec.build.registryType
    let registryType = stage.spec.build.registryType ? stage.spec.build.registryType : DEFAULT_REGISTRY_TYPE
    if ('number' !== typeof registryType || registryType < REGISTRY_TYPE_MIN || registryType > REGISTRY_TYPE_MAX) {
      return serviceUtils.responseForbidden(`Invalid .spec.build.registryType`)
    }
    //自定义registry时，检查customRegistry是否存在
    if (CUSTOM_REGISTRY === registryType) {
      if (!stage.spec.build.customRegistry || 'string' !== typeof stage.spec.build.customRegistry ||
          !stage.spec.build.customRegistry.trim()) {
        return serviceUtils.responseForbidden(`.spec.build.customRegistry is required with custom registry type`)
      }
      let thirdRegistry = UserPreference.findOneOf3rdPartyById(stage.spec.build.customRegistry, user.namespace)
      if (!thirdRegistry) {
        return serviceUtils.responseNotFound('.spec.build.customRegistry is in an invalid value')
      }
    }
    stage.spec.build.customRegistry = CUSTOM_REGISTRY === registryType ? stage.spec.build.customRegistry.trim() : undefined
    stage.spec.build.registryType = registryType

    //检查.spec.build.imageTagType范围
    let tagType = stage.spec.build.imageTagType ? stage.spec.build.imageTagType : DEFAULT_TAG_TYPE
    if ('number' !== typeof tagType || tagType < TAG_TYPE_MIN || tagType > TAG_TYPE_MAX) {
      return serviceUtils.responseForbidden(`Invalid .spec.build.imageTagType`)
    }
    //自定义tag类型时，检查.spec.build.customTag是否存在
    if (CUSTOM_TAG === tagType &&
        (!stage.spec.build.customTag || 'string' !== typeof stage.spec.build.customTag ||
          !stage.spec.build.customTag.trim())) {
      return serviceUtils.responseForbidden(`.spec.build.customTag is required with custom tag`)
    }
    stage.spec.build.customTag = CUSTOM_TAG === tagType ? stage.spec.build.customTag.trim() : undefined
    stage.spec.build.imageTagType = tagType

    stage.spec.build.noCache = stage.spec.build.noCache ? stage.spec.build.noCache : false
  } else {
    stage.spec.build = undefined
  }
  return {newStage: stage}
}

//检查提交的stage中必须的字段
function* _checkRequired(stage) {
  if (!stage || !stage.metadata || !stage.metadata.name ) {
    return serviceUtils.responseBadRequest('.metadata.name is required')
  }
  if (!stage.spec) {
    return serviceUtils.responseBadRequest('.spec is required')
  }
  if (stage.metadata.type && BUILD_IMAGE_STAGE_TYPE !== stage.metadata.type) {
    if (!stage.spec || !stage.spec.container || !stage.spec.container.image) {
      return serviceUtils.responseBadRequest('.spec.container.image is required')
    }
  } else if (!stage.spec.container) {
    stage.spec.container = {}
  }
  return null
}

//检查flow是否存在
function* _checkFlowId(namespace, flowId) {
  const method = '_checkFlowId'
  let flow = yield CIFlow.findFlowById(namespace, flowId)
  if (!flow) {
    logger.error(method, 'Cannot find flow ', flowId)
    return serviceUtils.responseNotFound(`CI flow cannot be found`)
  }
  return null
}

//检查name是否唯一
function* _checkUnique(flowId, name) {
  const method = '_checkUnique'
  let stage = yield Stage.findOneByName(flowId, name)
  if (stage) {
    logger.error(method, 'Stage name conflict: ', name)
    return serviceUtils.responseConflict(`Stage already exists`)
  }
  return null
}

//将数据库stage记录转为响应格式
function _formatStage(stage) {
  let result = {
    metadata: {
      name: stage.stage_name,
      id: stage.stage_id,
      creationTime: stage.creation_time,
      type: stage.type,
      customType: CUSTOM_STAGE_TYPE === stage.type ? stage.custom_type : undefined
    },
    spec: {
      container: {},
      ci: {
        enabled: stage.ci_enabled,
        config: stage.ci_config? JSON.parse(stage.ci_config) : undefined
      }
    }
  }
  if (stage.project_id) {
    result.spec.project = {
      id: stage.project_id,
      branch: stage.default_branch,
      repoType: stage.repo_type,
    }
  }
  if (stage.ci_config) {
    result.spec.ci.config = JSON.parse(stage.ci_config)
  }
  if (stage.container_info) {
    let info = JSON.parse(stage.container_info)
    result.spec.container = info
  }
  result.spec.container.image = stage.image

  if (stage.build_info) {
    let info = JSON.parse(stage.build_info)
    result.spec.build = info
  }
  if (stage.target_id) {
    result.link = {
      target: stage.target_id,
      enabled: stage.link_enabled,
      sourceDir: stage.source_dir ? stage.source_dir : undefined,
      targetDir: stage.target_dir ? stage.target_dir : undefined
    }
  }
  if (stage.build_id) {
    result.lastBuildStatus = {
      buildId: stage.build_id,
      status: stage.status,
      pod_name: stage.pod_name
    }
  }
  return result
}

exports.findCIEnabledStages = function* (project_id) {
  let result = yield Stage.findByProjectIdAndCI(project_id, 1)
  return result
}