/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-13
 * @author YangYuBiao
 * 
 * Tenxcloud CI/CD services
 * 
 */
'use strict';

const url = require('url')
const projectService = require('../services/project')
const kuberneteService = require('../services/kubernete_service')
const replicatorService = require('../services/replicator')
const cdRuleService = require('../services/cd_rule')
const cdService = require('../services/continuous_deployment')
const registryService = require('../services/registry')
const logger = require('../utils/logger').getLogger('cd')

exports.invokeContinuousDeployment = function* (next) {
  const method = 'invokeContinuousDeployment'
  let body = this.request.body
  if (!body || !body.events || body.events.length < 1) {
    this.status = 400
    this.body = { message: "Invalid request body."}
    return
  }
  var cdEvent = body.events[0]
  this.session.auditInfo.skip = true
  if (cdEvent.action !== 'push' || cdEvent.target.mediaType.indexOf('docker.distribution.manifest') < 0 || cdEvent.request.useragent.indexOf('docker') < 0) {
    this.status = 200
    this.body = { message: "Skipped due to: 1) Not a push. 2) Not manifest update. 3. Not from docker client" }
    return
  }
  let imageInfo = {
    fullname: body.events[0].target.repository,
    projectname: body.events[0].target.repository.split('/')[0],
    tag: body.events[0].target.tag
  }
  // For old version docker, tag maybe missing in event body, so we have to get it from the eventurl again from registry server
  /*let eventUrl = body.events[0].target.url
  let tagResult = yield registryService.getTagFromEventsUrl('admin', imageInfo.fullname, eventUrl)
  if (typeof tagResult.tag === 'object') {
    imageInfo.tag = tagResult.tag.tag
  } else if (tagResult.tag) {
    imageInfo.tag = tagResult.tag
  }
  let eventUrlObj = url.parse(eventUrl)
  imageInfo.imageUrl = `${eventUrlObj.host}${eventUrlObj.port ? `:${eventUrlObj.port}` : ''}/${imageInfo.fullname}`*/

  logger.info(method, `** handle docker registry manifest push event: ${JSON.stringify(imageInfo)}`)
  let result = yield cdService.invokeContinuousDeployment(imageInfo, this.session.auditInfo)
  this.status = result.status
  if (result.status >= 300) {
    logger.error(method, result)
    logger.error(method, result.message.stack)
  }
  this.body = { message: result.message }
}

exports.getProjectDeployDetail = function* () {
  let projectName = decodeURIComponent(this.params.projectName)
  let pageSize = this.query.pageSize || 10 
  let pageIndex = this.query.pageIndex || 1
  let user = this.session.loginUser
  let projectInfo = yield projectService.getProject(user, projectName)
  if(projectInfo.status !== 200) {
    this.status = projectInfo.status
    this.message = projectInfo.message
  }
  let projectDeployDetail = yield cdService.getDeployDetail(projectInfo.results, pageIndex, pageSize)
  this.status = projectDeployDetail.status
  this.body = projectDeployDetail
}

exports.getProjectDeployDetailRc = function* () {
  let deployDetailId = this.params.deployDetailId
  let result = yield cdService.getDeployDetailRc(deployDetailId)
  this.status = result.status
  this.body = result
}