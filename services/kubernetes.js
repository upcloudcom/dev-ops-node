/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-23
 * @author Yangyubiao
 *
 */

/**
 * Service for k8s
 */
'use strict'
const logger  = require('../utils/logger').getLogger('services');
const userOpRecordsService =require('./user_op_records_service');
const indexConfig = require('../configs')

const replicatorModal = require('../models').Replicator;

var moment  = require('moment');

module.exports =kubernetesService

function kubernetesService(config){
   // Must pass in k8s config info
  this.k8sConfig = config;
  this.id = this.k8sConfig.id;
  this.master = this.k8sConfig.name;
  this.safeCluster = false; // master in user side
  if (this.master == null) {
    this.safeCluster = true;
    this.master = '' + this.id;
  }
  let K8sApiClient;
  K8sApiClient = require(`../kubernetes/api/${config.version}/index.js`);
  this.client = new K8sApiClient(this.k8sConfig);

}
/**
 * Modify image tag
 *
 * @param {String} rcName rc名
 * @param {String} imageUrl 无tag的镜像url eg. index.tenxcloud.com/dubuqingfeng/centos7-shadowsocks
 * @param {String} tag 镜像版本
 * @param {String} namespace 命名空间
 * ...
 * @return {Object}
 */
kubernetesService.prototype.modifyContainerImageTag = function* (rcName, imageUrl, tag, namespace, userId, memoryLimits, callback) {
  const self = this
  const method = 'modifyContainerImageTag'
  let result = yield replicatorModal.isRcExist(rcName, namespace, self.master)
  if (result < 1) {
    let error = new Error('rc not exist in db.')
    error.status = 404
    throw error
  }
  let replicator = yield self.client.namespaces.getBy([namespace, 'replicationcontrollers', rcName], null)
  if (!replicator || !replicator.spec) {
    return null
  }
  // Find targe container from rc containers by imageUrl
  let targetRcContainer
  replicator.spec.template.spec.containers.every(function (container, index) {
    let imageIndexOf = container.image.indexOf(imageUrl)
    // Skip dockerhub image
    if (container.image.indexOf(imageUrl) === 0) {
      targetRcContainer = replicator.spec.template.spec.containers[index]
      return false
    }
    return true
  })
  if (!targetRcContainer) {
    let error = new Error('can not find target container.')
    error.status = 404
    throw error
  }
  let oldTag = targetRcContainer.image.substr(targetRcContainer.image.lastIndexOf(':') + 1)
  if (tag !== oldTag) {
    targetRcContainer.image = `${imageUrl}:${tag}`
    logger.info(method, 'Modify image:' + targetRcContainer.image)
    //if have some error,the following command will not perform,because co module will execute error middleware
    yield self.client.namespaces.updateBy([namespace, 'replicationcontrollers', rcName], null, replicator)
    yield replicatorModal.updateRcImage(targetRcContainer.image, rcName, namespace, self.master)
  }
  //TODO change tag
  let pods = yield self.client.namespaces.getBy([namespace, 'pods'], { labelSelector: 'name=' + rcName })
  if (!pods.items || pods.items.length < 1) {
    let newOp = yield self.startCluster(userId, rcName, namespace, memoryLimits)
  } else {
    let generatorArray = []
    pods.items.forEach(function (item) {
      generatorArray.push(function* () {
        yield self.deletePod(namespace, item.metadata.name)
      })
    })
    yield generatorArray
  }
  return { status: 200, message: `Succsssfully modfiy ${rcName} '\'s image tag to ${tag}` }
}



/**
 * Start containers
 * @param namespace
 * @return
 */
kubernetesService.prototype.startCluster = function* (user_id, rc_name, namespace, memoryLimits, callback){
  var self = this;
  var method = 'startCluster';
  var results = yield replicatorModal.findInstById(rc_name, namespace, self.master);
  if (results && results.length > 0) {
    logger.debug(method, 'find cluser inst by id: ' + JSON.stringify(results));
    var cluster = results[0];
    yield self.client.namespaces.getBy([namespace, 'replicationcontrollers', rc_name], null).then(function (rc) {
      logger.debug(method, 'rc is ' + JSON.stringify(rc));
      rc.spec.replicas = cluster.container_size;
      rc.status.replicas = cluster.container_size;
      return self.client.namespaces.updateBy([namespace, 'replicationcontrollers', rc.metadata.name], null, rc).then(function (updateData) {
        logger.debug(method, 'start rc successfully: ' + JSON.stringify(updateData));

        // Record operation
        //return promise，the new one will replace the old promise
        return userOpRecordsService.recContainerOp(cluster, self.master, null, namespace, '1', '1').then(function(result){
           logger.info(method, '[start container]Insert table user_operation_records successfully: ' + JSON.stringify(result));
        },function(){
           logger.error(method, JSON.stringify(result));
        })
      }, function () {
        throw new Error('启动失败，code_service：003');
      })
       //return promise，the new one will replace the old promise
    }, function () {
      throw new Error('启动失败，code_service：002');
    }).then(function (newOp) {
      return newOp;
    })
  } else {
    throw new Error('启动失败，code_service：001');
  }
}


/**
 * Delete single pod
 * @param namespace
 * @return
 */
kubernetesService.prototype.deletePod = function* (namespace, podName){
  var self   = this;
  var pod = yield self.client.namespaces.deleteBy([namespace, 'pods', podName], null).then(function(pod){
    return pod;
  },function(err){
    throw new Error(err.message);
  })
  return pod;
}

kubernetesService.prototype.createPV = function* (pvModelArray) {
  const self = this
  const method = 'createPV'
  if(!Array.isArray[pvModelArray]) {
    pvModelArray = [pvModelArray]
  }
  let pvGeneratorArray = []
  pvModelArray.forEach(function(item) {
    pvGeneratorArray.push(function*() {
      let pv = yield self.client.persistentvolumes.create(item)
    })
  })
  try {
    yield pvGeneratorArray
    logger.info(`${method}, create pv success -> ${JSON.stringify(pvModelArray)}`)
    return true
  } catch (error) {
    logger.error(method, error)
    throw new Error(error.message)
  }
}

kubernetesService.prototype.createPVC = function*(namespace, pvcModelArray) {
  const self = this
  const method = 'createPVC'
  if(!Array.isArray(pvcModelArray)) {
    pvcModelArray = [pvcModelArray]
  }
  let pvcGeneratorArray = []
  pvcModelArray.forEach(function(item) {
    pvcGeneratorArray.push(function*() {
      let pvc = yield self.client.namespaces.createBy([namespace, 'persistentvolumeclaims'], null, item)
    })
  })
  try {
    yield pvcGeneratorArray
    logger.info(`${method}, create pvc success -> ${pvcModelArray}`)
    return true
  } catch (error) {
    logger.error(method, error)
    throw new Error(error.message)
  }
}

kubernetesService.prototype.createService = function*(namespace, serviceModel) {
  const self =this
  const method = 'createService'
  try {
    let result = yield self.client.namespaces.createBy([namespace, 'services'], null, serviceModel)
    logger.info(`${method}, create service success -> ${serviceModel}`)
    return true
  } catch (error) {
    if(error) {
      logger.error(method, error)
      throw new Error(error.message)
    }
  }
}

/*
Deployment related actions
*/
kubernetesService.prototype.getDeploymentByName = function*(namespace, name) {
  const self =this
  const method = 'getDeploymentByName'
  try {
    let result = yield self.client.extensionNamespaces.getBy([namespace, 'deployments', name], null)
    logger.debug(method, "Get deployment: " + JSON.stringify(result))
    return result
  } catch (error) {
    if(error) {
      logger.error(method, error)
      throw new Error(error.message)
    }
  }
}

kubernetesService.prototype.upgrade = function*(deployment, imageName, newTag, strategy, isMatchTag) {
  const self = this
  const method = 'upgrade'
  try {
    if (!deployment || deployment.kind != 'Deployment') {
      logger.error(method, "Invalid deployment object: " + JSON.stringify(deployment))
      return "Invalid deployment object format"
    }

    let matched = false
    let result = ''
    let now = new Date()
    if (deployment.spec.template.metadata.labels['tenxcloud.com/cdTimestamp']) {
      let lastCdTs = parseInt(deployment.spec.template.metadata.labels['tenxcloud.com/cdTimestamp'])
      let cooldownSec = 30
      if (indexConfig.cd_config && indexConfig.cd_config.cooldown_seconds) {
        cooldownSec = indexConfig.cd_config.cooldown_seconds
      }
      if (lastCdTs && now - lastCdTs < cooldownSec * 1000) {
        //当前时间与上一次相差不足冷却间隔时，不进行更新
        logger.warn(method, "Upgrade is rejected because the deployment was updated too frequently")
        return result
      }
    }
    deployment.spec.template.spec.containers.forEach(function(container) {
      var oldImage = _parseImageName(container.image)
      // Check the image name
      if (oldImage.image == imageName) {
        // Check the tag matching rule
        if (isMatchTag == 2 || (isMatchTag == 1 && newTag == oldImage.tag)) {
          matched = true
          var newImage = ''
          // Keep host
          if (oldImage.host && oldImage.host != '') {
            newImage = oldImage.host + '/'
          }
          // Keep image
          if (oldImage.image && oldImage.image != '') {
            newImage += oldImage.image
          }
          // Update the tag
          newImage += ':' + newTag
          logger.info(method, "Will update to new image: " + newImage)
          container.image = newImage
          container.imagePullPolicy = 'Always'
          logger.debug(method, "Update deployment to: " + JSON.stringify(deployment))
        }
      }
    })

    if (deployment.spec.template.spec.volumes && deployment.spec.template.spec.volumes.length > 0 && strategy != 1) {
      for (var i in deployment.spec.template.spec.volumes) {
        if (deployment.spec.template.spec.volumes[i].rbd) {
          //如果挂载了存储卷，则强制使用重启策略
          strategy = 1
          break
        }
      }
    }

    // README:
    //   目前设置spec.strategy时存在缺陷，修改之后自动更新会失效。
    //   当前采用策略为：灰度升级时重置spec.strategy为rollingupdate，否则删除对应pods
    //   通过时间戳设置tenxcloud.com/cdTime label从而触发更新
    if (strategy === 2 &&
        ('RollingUpdate' != deployment.spec.strategy.type ||
         0 != deployment.spec.strategy.rollingUpdate.maxUnavailable)) { //Rollingupgrade
      // reset strategy to rollingupdate which is default value
      delete deployment.spec.strategy
      deployment.spec.strategy = {
        type: 'RollingUpdate',
        rollingUpdate: {
          maxUnavailable: 0
        }
      }
    } else {
      delete deployment.spec.strategy
      deployment.spec.strategy = {
        type: 'Recreate'
      }
    }
    if (matched) {
      // Update the deployment
      // set template.metadata.labels so that update can be triggered
      deployment.spec.template.metadata.labels['tenxcloud.com/cdTimestamp'] = (now - 0).toString() //Date转int再转string
      result = yield self.client.extensionNamespaces.updateBy([deployment.metadata.namespace, 'deployments', deployment.metadata.name], null, deployment)
      // Remove this, otherwise new pod will be created first, so the user will see more pods
      /*if (strategy === 1) {
        //restart strategy
        // remove pods
        result = yield self.client.namespaces.deleteBy([deployment.metadata.namespace, 'pods'], {labelSelector:`name=${deployment.metadata.name}`})
      }*/
    } else {
      logger.warn(method, "No matched container to upgrade for " + imageName + "(" + newTag + ").")
    }
    return result
  } catch (error) {
    if(error) {
      logger.error(method, error)
      throw new Error(error.message)
    }
  }
}

// Parse image name
function _parseImageName(imageFullName) {
  var host = '', image = '', tag = ''
  var separatorNumber = 0
  var letter = ""
  for (var i = 0; i< imageFullName.length; i++) {
    let ch = imageFullName[i]
    letter += ch
    if (ch === '/') {
      if (separatorNumber == 0) {
        // Find the first one
        host = letter
        letter = ''
      } else if (separatorNumber == 1) {
        // Find the second one, at most 2
        image += letter
        letter = ''
      }
      separatorNumber++
    } else if (ch === ':') {
      image += letter
      letter = ''
      // Tag found
      tag = '*'
    }
  }
  // left is the tag or image
  if (tag == '*') {
    tag = letter
  } else {
    image += letter
  }
  // Maybe from docker hub with no host
  if (host.indexOf('.') < 0) {
    image = host + image
    host = ''
  } else {
    // Trim the host/image
    host = host.replace('/', '')
  }
  image = image.replace(':', '')
  return {
    host: host,
    image: image,
    tag: tag
  }
}