/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-21
 * @author Zhangpc
 *
 */

/**
 * service for projects props
 */
'use strict'

const ProjectProps = require('../models').ProjectProps
const security = require('../utils/security')
const Project = require('../models').Project
const repoService = require('./repo')
const utils = require('../utils')
const Repo = require('../models').Repo
const logger = require('../utils/logger').getLogger('service/project_props')

function* getOrAddProjectProps(user, depot, fullName, projectInfo) {
  const method = 'getOrAddProjectProps'
  const projectProps = yield ProjectProps.findOneProjectProps(user.namespace, repoService.depotToRepoType(depot), fullName)
  if (projectProps) {
    projectProps.type = 'old'
    projectProps.private_key = projectProps.private_key.toString()
    projectProps.public_key = projectProps.public_key.toString()
    if( !projectProps.is_add_deploy_key || projectProps.is_add_deploy_key == '0') {
      if (depot === '6' && projectInfo && projectInfo.is_repo_private == 'true') {
        let repoConfig = yield Repo.findOneRepoToken(user.namespace, repoService.depotToRepoType(depot))
      }
    }
    return projectProps
    /*return {
      type: 'old',
      privateKey: projecProps.private_key.toString(),
      publicKey: projecProps.public_key.toString()
    }*/
  }
  const keyPairs = yield security.generateRsaKeys()
  let newProjectProps = {
    repo_type: repoService.depotToRepoType(depot),
    source_full_name: fullName,
    user_id: user.id,
    private_key: security.encryptContent(keyPairs.privateKey),
    public_key: keyPairs.publicKey,
    create_time: utils.DateNow(),
    update_time: utils.DateNow(),
    namespace: user.namespace
  }
  if(newProjectProps.repo_type === '6' && projectInfo && projectInfo.is_repo_private == 'true') {
    let repoConfig = yield Repo.findOneRepoToken(user.namespace, newProjectProps.repo_type)
  }
  newProjectProps = yield ProjectProps.createOneProjectProps(newProjectProps)
  newProjectProps.type = 'new'
  newProjectProps.private_key = newProjectProps.private_key.toString()
  newProjectProps.public_key = newProjectProps.public_key.toString()
  return newProjectProps
  /*return {
    type: 'new',
    privateKey: keyPairs.privateKey,
    publicKey: keyPairs.publicKey
  }*/
}
exports.getOrAddProjectProps = getOrAddProjectProps

exports.updateProjectProps = function* (namespace, depot, fullName, projectProps) {
  return yield ProjectProps.updateProjectProps(namespace, repoService.depotToRepoType(depot), fullName, projectProps)
}

exports.getProjectProps = function* (user, projectName) {
  const resData = {
    status: 200
  }
  const project = yield Project.findProjectByName(user.namespace, projectName)
  if (!project) {
    resData.status = 403
    resData.message = `there is no project for depot: ${depot} and fullName: ${fullName}`
    return resData
  }
  const projectProps = yield getOrAddProjectProps(user, project.repo_type, project.source_full_name)
  resData.results = projectProps
  return resData
}