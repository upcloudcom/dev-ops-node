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

const replicatorModel = require('../models').Replicator
const _ = require('lodash')
const cdRuleService =require('../services/cd_rule')
const kuberneteService = require('../services/kubernete_service')
const logger = require('../utils/logger').getLogger('service/cd')
const notification = require('./notification')
const deploymentLogService = require('./cd_deployment_logs')
const moment = require('moment')
const clusterModel = require('../models').Clusters
const cdRuleModel = require('../models').CDRule
const utils = require('../utils')

moment.locale('zh-cn')

/*
v2 to handle event from docker registry
*/
exports.invokeContinuousDeployment = function* (imageInfo, auditInfo) {
  let self = this
  let method = 'invokeContinuousDeployment'
  let matchedRules = yield cdRuleModel.findEnabledRuleByImage(imageInfo.fullname)
  if (matchedRules.length <= 0) {
    let msg = `There is no CD rule that matched this image: ${imageInfo.fullname}`
    logger.warn(method, msg)    
    return { status: 200, message: msg }
  }

  // TODO: Remove duplicate rules if found

  // Find the binding deployment in the specified cluster
  let ruleArrayGenerator = []
  let newDeploymentArray = []
  var result = ''
  matchedRules.forEach(function (rule) {
    ruleArrayGenerator.push(function* () {
      // If the tag matched the deployment
      logger.debug(method, "New image tag: " + imageInfo.tag)
      var start_time = new Date()
      try {
        let k8sService = yield kuberneteService.getKuberneteService(rule.binding_cluster_id)
        let deployment = yield k8sService.getDeploymentByName(rule.namespace, rule.binding_deployment_name)
        if (deployment && deployment.metadata && deployment.metadata.uid == rule.binding_deployment_id) {
          logger.info(method, `Found matched deployment, add it to the upgrade queue: ${rule.namespace} - ${rule.binding_deployment_name}`)
          newDeploymentArray.push({
            cluster_id: rule.binding_cluster_id,
            oldDeploymentObj: deployment,
            newTag: imageInfo.tag,
            strategy: rule.upgrade_strategy,
            flow_id: rule.flow_id,
            rule_id: rule.rule_id,
            namespace: rule.namespace,
            match_tag: rule.match_tag,
            start_time: start_time
          })
        }
      } catch (error) {
        let msg = 'Exception occurs when validate each CD rule: ' + JSON.stringify(error)
        result += msg + '\n'
        logger.error(method, msg)
        // Record if it failed
        var log = {
          cd_rule_id: rule.rule_id,
          target_version: imageInfo.tag,
          result: {
            status: 2, // Failure
            duration: (new Date() - start_time) / 1000 + ' s',
            error: JSON.stringify(error)
          }
        }
        yield deploymentLogService.createDeploymentLog(log)
        notification.sendEmailUsingFlowConfig(rule.namespace, rule.flow_id, {
          type: 'cd',
          result: 'failed',
          subject: '镜像' + imageInfo.fullname + '的持续集成执行失败',
          body: '校验持续集成规则时发生异常'
        })
      }
    })
  })
  // Execute the matching steps
  yield ruleArrayGenerator
  if (newDeploymentArray.length <= 0) {
    let msg = 'No rule matched to invoke the service deployment.'
    logger.warn(method, msg)
    return { status: 200, message: msg }
  }
  if (auditInfo) {
    auditInfo.namespace = matchedRules[0].namespace
    auditInfo.resourceName = imageInfo.fullname
    auditInfo.skip = false
  }
  if (result != '') {
    return { status: 500, message: result }
  }

  // Construct the action steps
  let deployActionArray = []
  newDeploymentArray.forEach(function (deployAction) {
    deployActionArray.push(function* () {
      // Execute the actions
      try {
        let k8sService = yield kuberneteService.getKuberneteService(deployAction.cluster_id)
        let result = yield k8sService.upgrade(deployAction.oldDeploymentObj, imageInfo.fullname, deployAction.newTag, deployAction.strategy, deployAction.match_tag)
        if (result != '') {
          var log = {
            cd_rule_id: deployAction.rule_id,
            target_version: imageInfo.tag,
            result: {
              status: 1, // Success
              duration: (new Date() - deployAction.start_time)  / 1000 + ' s',
            }
          }
          yield deploymentLogService.createDeploymentLog(log)
          logger.info('Save deployment log successfully')
          // Send email
          notification.sendEmailUsingFlowConfig(deployAction.namespace, deployAction.flow_id, {
            type: 'cd',
            result: 'success',
            subject: '持续集成执行成功，镜像' + imageInfo.fullname + '已更新',
            body: `已将服务${deployAction.oldDeploymentObj.metadata.name}使用的镜像更新为${imageInfo.fullname}:${imageInfo.tag}的最新版本`
          }) 
        }
      } catch (error) {
        let msg = 'Exception occurs while trying to upgrade the service: ' + JSON.stringify(error)
        result += msg + '\n'
        logger.error(method, msg)
        var log = {
          cd_rule_id: deployAction.rule_id,
          target_version: imageInfo.tag,
          result: {
            status: 2, // Failure
            duration: (new Date() - deployAction.start_time) / 1000+ ' s',
            error: JSON.stringify(error)
          }
        }
        yield deploymentLogService.createDeploymentLog(log)
        notification.sendEmailUsingFlowConfig(deployAction.namespace, deployAction.flow_id, {
          type: 'cd',
          result: 'failed',
          subject: '镜像' + imageInfo.fullname + '的持续集成执行失败',
          body:  '更新服务时发生异常'
        })
      }
    })
  })
  // Execute the actions
  yield deployActionArray
  if (result != '') {
    return { status: 500, message: result }
  }
  logger.info(method, `** Enable continuous deployment successfully: ${JSON.stringify(newDeploymentArray)}`)
  return { status:200, message: "Continuous deployment completed successfully"}
}

exports.getDeployDetail = function* (projectInfo, pageIndex, pageSize) {
  let method = 'getDeployDetail'
  let deployDetail = yield deployDetailModel.findDeployDetailByProjectId(projectInfo.id, pageIndex, pageSize)
  let reqData = {
    status: 200,
    message: {}
  }
  if(!deployDetail || deployDetail.length === 0) {
    reqData.message = { message: '没有部署记录'}
    return reqData
  }
  deployDetail = JSON.parse(JSON.stringify(deployDetail))
  deployDetail.forEach(function(item) {
    item.create_time = moment(utils.toUTCString(new Date(item.create_time))).fromNow()
  })
  reqData.message = deployDetail
  return reqData
}

exports.getDeployDetailRc = function* (deployDetailId) {
    const method = 'getDeployDetailRcByDeployDetailId'
    const reqData = {
      status: 200
    }
    let deployDetail = yield deployDetailModel.findById(deployDetailId)
    if(!deployDetail) {
      reqData.status = 404
      reqData.message = '没有发现部署记录'
      return reqData
    }
  //  let rc_uid = deployDetail.rc_uid ? JSON.parse(deployDetail.rc_uid) : null
    let cd_rule_id = deployDetail.cd_rule_id ? JSON.parse(deployDetail.cd_rule_id) : null
        
    let targetRcGenerator = []
    let targetRc = []
    // if(rc_uid) {
    //   rc_uid.forEach(function(item) {
    //     targetRcGenerator.push(function*() {
    //       let result = yield replicatorModel.findById(item)
    //       let cd_rule = yield cdRuleModel.findById(cd_rule_id[0])
    //       result.update_strategy = cd_rule.update_strategy == 1 ? '普通升级' : '灰度升级'
    //       let cluster = yield clusterModel.findById(result.hosting_cluster)
    //       if (!cluster) {
    //         result.hosting_cluster_name = result.hosting_cluster
    //       } else {
    //         result.hosting_cluster_name = cluster.cluster_display_name
    //       }
    //       result.is_deleted = exchangeDeleteStatus(result.is_deleted)
    //       targetRc.push(_formateClusterInfo(result))
    //     })
    //   })
    // }
    if(cd_rule_id && cd_rule_id.length > 0) {
      _(cd_rule_id).forEach(function(cd_item) {
        targetRcGenerator.push(function* () {
          let cd_rule = yield cdRuleModel.findById(cd_item)
          if(cd_rule) {
            let result = yield replicatorModel.findById(cd_rule.replicatorId)
            if (result) {
              result.update_strategy = cd_rule.update_strategy == 1 ? '普通升级' : '灰度升级'
              let cluster = yield clusterModel.findById(result.hosting_cluster)
              if (!cluster) {
                result.hosting_cluster_name = result.hosting_cluster
              } else {
                result.hosting_cluster_name = cluster.cluster_display_name
              }
              result.is_deleted = exchangeDeleteStatus(result.is_deleted)
              targetRc.push(_formateClusterInfo(result))
            } 
          }
        })
      })
    }
    if(targetRcGenerator.length > 0) {
      try {
        yield targetRcGenerator
        logger.info(method, '获取部署信息成功')
        if (targetRc.length === 0) {
          reqData.status = 404
          reqData.message = '没有找到部署记录'
          return reqData
        }
        reqData.message = targetRc
        return reqData
      } catch (e) {
        logger.error(method, e)
        reqData.status = 500,
          reqData.message = '获取部署信息失败'
        return reqData
      }
    }
    reqData.status = 404
    reqData.message = '没有发现部署记录'
    return reqData
}

function _formateClusterInfo(cluster) {
  return {
    rc_name: cluster.rc_name,
    update_strategy: cluster.update_strategy,
    hosting_cluster_name: cluster.hosting_cluster_name,
    is_deleted: cluster.is_deleted
  }
}

function exchangeDeleteStatus (deleted) {
   switch (deleted) {
     case '0':
       return '运行中';
     case '1':
       return '回收站';
     case '2':
       return '已停止';
     case '-1':
       return '已删除';
     default: 
       return '未知'
   }
}


