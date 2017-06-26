/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-11-15
 * @author huangxin
 * 
 */

/**
 * Service for stage link
 */
'use strict'

const StageLink = require('../models').StageLink
const Stage = require('../models').Stage
const StageBuild = require('../models').StageBuild
const serviceUtils = require('./utils')
const logger = require('../utils/logger').getLogger('service/stage_link')
const indexConfig = require('../configs')

const HOST_PATH = indexConfig.shared_volume.build_dir

exports.getVolumeSetting = function* (flowId, stageId, flowBuildId, stageBuildId) {
  const method = 'getVolumeSetting'
	let links = yield StageLink.getAllLinksOfStage(flowId, stageId)
  if (!links || links.length < 1) {
    return serviceUtils.responseInternalError('No link exists of the stage')
  }
  let setting = []
  for (var i in links) {
    let link = links[i]
    if (stageId === link.source_id && link.enabled && link.target_id && link.source_dir && link.target_dir) {
      setting.push({
        type: 'source',
        containerPath: link.source_dir,
        volumePath: HOST_PATH + flowId + '/' + link.source_id + '/' + stageBuildId + '/' + link.source_dir
      })
    } else if (stageId === link.target_id && link.enabled && link.source_dir && link.target_dir) {
      //获取上一步stage对应的build
      let lastStageBuild = yield StageBuild.findOneOfStageByFlowBuildId(flowBuildId, link.source_id)
      if (!lastStageBuild) {
        logger.error(method, 'Failed to get build of', link.source_id)
        return serviceUtils.responseForbidden('Cannot find build of source stage which should be built before')
      }
      setting.push({
        type: 'target',
        containerPath: link.target_dir,
        volumePath: HOST_PATH + flowId + '/' + link.source_id + '/' + lastStageBuild.build_id + '/' + link.source_dir
      })
    }
  }
  return setting
}

exports.updateLinkDirs = function* (user, flowId, sourceId, targetId, link, auditInfo) {
  if (!link) {
    return serviceUtils.responseBadRequest('No link specified')
  }
  let check = this.checkLink(link)
  if (check.status > 299) {
    return check
  }

  let stages = yield Stage.findByIds(flowId, [sourceId, targetId])
  if (!stages || stages.length < 2) {
    return serviceUtils.responseNotFound('Associated stages cannot be found')
  }
  let sourceName, targetName
  stages.forEach(function (s) {
    if (s.stage_id === sourceId) {
      sourceName = s.stage_name
    } else if (s.stage_id === targetId) {
      targetName = s.stage_name
    }
  })
  auditInfo.resourceName = sourceName + ' >>> ' + targetName

  let oldLinks = yield StageLink.getAllLinksOfStage(flowId, sourceId)
  //sourceId
  if (!oldLinks || oldLinks.length < 1) {
    return serviceUtils.responseNotFound('No link of the stage')
  }

  let exist
  let targetDir
  let linkRec = {}
  for (var i in oldLinks) {
    if (sourceId === oldLinks[i].source_id) {
      exist = true
      // 判断source和target是否匹配
      if (targetId !== oldLinks[i].target_id) {
        return serviceUtils.responseForbidden('Stage does not link to the target')
      }
      let nextLink = yield StageLink.getOneBySourceId(targetId)

      // 设置enabled默认值
      if (!link.enabled) {
        link.enabled = 0
      }
      // 设置更新字段
      if (oldLinks[i].enabled !== link.enabled) {
        linkRec.enabled = link.enabled
      }
      if (link.sourceDir && oldLinks[i].source_dir !== link.sourceDir) {
        linkRec.source_dir = link.sourceDir
      }
      if (link.targetDir && oldLinks[i].target_dir !== link.targetDir) {
        if (nextLink && _isInvalidDirsOfStage(link.targetDir, nextLink.source_dir)) {
          return serviceUtils.responseForbidden('Target directory can not be set because it was used as source of next link')
        }
        linkRec.target_dir = link.targetDir
      }
    } else {
      // sourceId === oldLinks[i].target_id
      targetDir = oldLinks[i].target_dir
    }
  }

  if (!exist) {
    return serviceUtils.responseNotFound('No link of the stage')
  }

  check = this.checkLinkedDirsOfStage(targetDir, linkRec.source_dir)
  if (check.status > 299) {
    return check
  }

  if (Object.keys(linkRec).length > 0) {
    yield StageLink.updateOneBySrcId(linkRec, sourceId)
  }
  return serviceUtils.responseSuccess({message: 'success'})
}

exports.checkLink = function (link) {
  if (1 === link.enabled && (!link.sourceDir || !link.targetDir)) {
    return serviceUtils.responseForbidden('Can not enable link without source or target directory')
  }
  if ((link.sourceDir && link.sourceDir[0] != '/') || (link.targetDir && link.targetDir[0] != '/')) {
    return serviceUtils.responseForbidden('Absolute path should be specified')
  }
  return {status: 200}
}

exports.checkLinkedDirsOfStage = function (prevTargetDir, sourceDir) {
  if (_isInvalidDirsOfStage(prevTargetDir, sourceDir)) {
    return serviceUtils.responseForbidden('Source directory can not be set because it was used as target of previos link')
  }
  return {status: 200}
}

function _isInvalidDirsOfStage(prevTargetDir, sourceDir) {
  return sourceDir && prevTargetDir === sourceDir
}