/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-06-01
 * @author Lei
 *
 */

/**
 * Manage volume of linked projects
 */
'use strict'

const ProjectLink = require('../../models').ProjectLink
const logger = require('../../utils/logger').getLogger('build_management')
const SHARED_VOLUME_BASE_PATH = "/tenxcloud/shared_volume/"

exports.getVolumeMapping = function* (projectId) {
  const method = 'getVolumeMapping'
  // For now, we only support one-one mapping of project -> one output dir
  let sourceProjectLink = yield ProjectLink.findProjectLinkBySourceProjectId(projectId)
  var volumeMapping = []
  if (sourceProjectLink && sourceProjectLink.enabled == 1) {
    logger.info(method, "Checking the project link...")
    if(sourceProjectLink.source_dir && sourceProjectLink.target_dir) {
      volumeMapping.push(
        SHARED_VOLUME_BASE_PATH + sourceProjectLink.target_project_id + sourceProjectLink.source_dir
        + ":" + sourceProjectLink.source_dir
      )
    }

    // We can support multiple input dir of one project
    let targetProjectLinks = yield ProjectLink.findProjectLinkByTargetProjectId(projectId)

    if (targetProjectLinks && targetProjectLinks.length > 0) {
      targetProjectLinks.forEach(function(targetLink){
         // Check if the project link is enabled
         if(!targetLink.source_dir || !targetLink.target_dir) return 
         if (targetLink.enabled) {
           volumeMapping.push(
             SHARED_VOLUME_BASE_PATH + projectId + targetLink.source_dir + ":" + targetLink.target_dir
          )
         }
      })
    }
  }
  return volumeMapping
}

