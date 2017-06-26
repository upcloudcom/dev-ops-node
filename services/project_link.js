/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-06-25
 * @author Zhang_Shouhong
 *
 */

/**
 * service for project link
 */
'use strict'

const Project = require('../models').Project
const ProjectLink = require('../models').ProjectLink
const uuid = require('node-uuid')
const utils = require('../utils')

exports.addOrUpdateProjectLink = function* (data) {
  const resData = {
    status: 200,
    results: {}
  }
  // if (!data || !data.sourceProjectId) {
  //   resData.status = 400
  //   resData.message ='sourceProjectId is required.'
  //   return resData
  // }
  // if (data.enabled == '1' && (!data.targetProjectId || !data.sourceDir || !data.targetDir)) {
  //   resData.status = 400
  //   resData.message ='targetProjectId, sourceDir, targetDir, enabled are required.'
  //   return resData
  // }
  //
   let checkResult = yield* checkProjectLink(data)
   if(checkResult.status != 200) {
     resData.status = checkResult.status
     resData.message = checkResult.message
     return resData
   }
   if(data.source_dir && data.target_dir) {
     let existTargetDir = yield ProjectLink.findProjectLinkByTargetDir(data.sourceProjectId, data.targetProjectId, data.targetDir)
     if (existTargetDir) {
       resData.status = 405
       resData.message = `target dirctory ${data.targetDir} is already used, please change another one`
       return resData
     }
   }
  let newProjectLink = {
    link_id: uuid.v4(),
    source_project_id: data.sourceProjectId,
    target_project_id: data.targetProjectId,
    source_dir: data.sourceDir,
    target_dir: data.targetDir,
    enabled: data.enabled,
    create_time: utils.DateNow(),
    update_time: utils.DateNow()
  }
  let existProjectLink = yield ProjectLink.findProjectLinkBySourceProjectId(data.sourceProjectId)
  if (existProjectLink) {
    //Update the project link
    newProjectLink.link_id = existProjectLink.link_id
    newProjectLink.create_time = existProjectLink.create_time
    const result = yield ProjectLink.updateProjectLink(existProjectLink.link_id, newProjectLink)
    if (result[0] < 1) {
      logger.error(method, result[1])
      resData.status = 500
      resData.message = result[1]
    } else {
      resData.message = `project link was updated successfully`
    }
  } else {
    //Create the project link
    const projectLink = yield ProjectLink.createOneProjectLink(newProjectLink)
    resData.results = projectLink
  }

  return resData
}

exports.getProjectLink = function* (namespace, projectName) {
  const resData = {
    status: 200,
    results: {}
  }

  let project = yield Project.findProjectByName(namespace, projectName)
  if (!project) {
    resData.status = 403
    resData.message = `there is no project named ${projectName}`
    return resData
  }

  const projectLink = yield ProjectLink.findProjectLinkBySourceProjectId(project.project_id)

  if (projectLink) {
    resData.results = projectLink
  }

  return resData
}

exports.getProjectLinkByProjectId = function* (projectId) {
  const projectLink = yield ProjectLink.findProjectLinkBySourceProjectId(projectId)
  return projectLink
}

/*
  A项目作为其他项目的目标目录, 此目录为/A, 如果A项目进行关联构建，A项目的源目录也为/A,
  如果先构建A, 则会出现错误信息, 原因是将不同的宿主机目录映射到了相同的容器内同一目录
*/
function* checkProjectLink(data) {
  const reqData = {
    status: 200,
    message: ''
  }
  if(!data.sourceDir || !data.targetDir) return reqData
  const targetProject = yield ProjectLink.findProjectLinkByTargetProjectId(data.sourceProjectId)
  if(targetProject && targetProject.length > 0) {
    let length = targetProject.length
    for (var index = 0; index < length; index++) {
      if (targetProject[index].target_dir === data.sourceDir) {
        reqData.status = 409
        reqData.message = `该项目的源目录, 已做为其他项目的目标目录, 请更换目录`
        return reqData
      }
    }
  }

  const sourceProject = yield ProjectLink.findProjectLinkBySourceProjectId(data.targetProjectId)
  if(sourceProject && sourceProject.source_dir === data.targetDir) {
    reqData.status = 409
    reqData.message = `关联项目的目标目录, 已做为源目录使用, 请更换目录`
    return reqData
  }
  return reqData
}
exports.checkProjectLink = checkProjectLink

exports.disableProjectLink = function* (projectId) {
  const reqData = {
    status: 200,
    message: ''
  }
  const result = yield ProjectLink.updateProjectLinkByProjectId({
    enabled: '0'
  }, projectId)
  return reqData
}