/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-21
 * @author YangYuBiao
 *
 */

/**
 * imageBuilder
 */
'use strict'

const co = require('co')
const logger = require('../../utils/logger').getLogger('imageBuilder')
const DockerUtil = require('../../docker/dockerUtil')
const assert = require('assert')
const buildAgentService = require('../../services/build_agent')
const indexConfig = require('../../configs')
const DEFAULT_IMAGE_BUILDER = indexConfig.default_image_builder
const DEFAULT_IMAGE_BUILD_EMAIL = indexConfig.default_image_build_email



class ImageBuilder {
  constructor (builder) {
    this.builder = builder
    if (!builder) {
      this.builder = buildAgentService.getFitBuilder()
      // For now, only have one image builder configured
      // TODO: add more image builder and understand the workload of each builder and distribute the work to each builder
    }
    this.dockerUtil = new DockerUtil(this.builder.config);
  }
  /*static setAgent (agent,builderBuildAndWaitCount) {
    buildMgr.setAgent(agent,builderBuildAndWaitCount)
  }*/

  /*
   Return the builder address if needed
  */
  getBuilderName() {
    return this.builder.name;
  }

  /*
   Return the user of this host
  */
  getUser() {
    return this.builder.config.user;
  }

  /*
   Return the host name
  */
  getBuilderHost() {
    return this.builder.config.host;
  }

  /*
   Return the password of this host
  */
  getPassword () {
    return this.builder.config.password;
  }

  /*
   Build the docker image and push to docker registry server
   Required information:
   1) buildInfo.repoUrl   -> Repository url from GitHub or BitBucket
   2) buildInfo.imageName -> Name of the image

   TODO: add GIT_TAG and DOCKERFILE_PATH, we just need to add these values to buildOptions.Env to enable them

  */
  buildImage(buildInfo, volumeMapping) {
    const method = 'buildImage'
    const registryConfig = global.REGISTRY_CONFIG
    assert(buildInfo.repoUrl != null);
    assert(buildInfo.imageName != null);
    // var internalRegistryAddress = registryConfig.internalip + ":" + registryConfig.internalport;

    let createOptions = {
      'Hostname': '',
      'User': '',
      'AttachStdin': false,
      'AttachStdout': true,
      'AttachStderr': true,
      'Tty': true,
      'OpenStdin': false,
      'StdinOnce': false,
      'Env': '',
      // For new version Docker, this must be []string for create API to work
      'Cmd': [],
      'Image': buildInfo.build_image ? buildInfo.build_image: DEFAULT_IMAGE_BUILDER,
      'Volumes': {},
      // For new version Docker, this must be []string for create API to work
      'VolumesFrom': []
    };
    let bBuildImage = (DEFAULT_IMAGE_BUILDER === createOptions.Image || buildInfo.isNeedPrivilege === 'on');

    createOptions.HostConfig = {};
    // Set the timezone to sync with host
    createOptions.HostConfig.Binds = ["/etc/localtime:/etc/localtime"];
    // Add some extra DNS server
    //createOptions.HostConfig.Dns = [];
    //createOptions.HostConfig.Dns.push('8.8.8.8');

    // Change the mirror based on the builder type
    // 10.66.211.91

    //提交前记得更改
    // let dockerDeamonConfig = "DOCKER_DAEMON_ARGS=--insecure-registry=192.168.1.86:5000";
    let dockerDeamonConfig = "DOCKER_DAEMON_ARGS=--insecure-registry=" + registryConfig.host;

    // Should not have double quotes inside each value
    // Move some configuration to config file later
    // createOptions.Entrypoint = [];
    createOptions.Env = [
      "REPO_TYPE=" + buildInfo.repoType,
      "GIT_REPO=" + buildInfo.repoUrl,
      // 0 indicate tce, other indicate 3rd party code repo
      "CODE_REPO=" + buildInfo.isCodeRepo,
      // The 4 env variables below maybe overwrtten by remote agent, but still requred for the first run
      "IMAGE_NAME=" + buildInfo.imageName,
      "DOCKERFILE_PATH=" + buildInfo.dockerfileLocation,
      // "PRIVATE_REGISTRY=" + internalRegistryAddress,
      "PUB_KEY=" + buildInfo.publicKey,
      "PRI_KEY=" + buildInfo.privateKey,
      "GIT_REPO_URL=" + buildInfo.git_repo_url,
      "SVN_USERNAME=" + buildInfo.svn_username,
      "SVN_PASSWORD=" + buildInfo.svn_password
    ];
    // Don't need to add git tag if it's master branch
    if (buildInfo.branch != null && buildInfo.branch != "" && buildInfo.branch != 'master') {
      createOptions.Env.push("GIT_TAG=" + buildInfo.branch);
    }
    // Volume to pass in environment variables
    if (buildInfo.envVolume) {
      createOptions.HostConfig.Binds.push(buildInfo.envVolume);
    }
    // support user apply image builder.
    if (bBuildImage) {
      createOptions.HostConfig.Privileged = true;
      createOptions.Env.push("REGISTRY=" + registryConfig.host);
      createOptions.Env.push("EMAIL=" + DEFAULT_IMAGE_BUILD_EMAIL);
      createOptions.Env.push(dockerDeamonConfig);
      // Volume to persist user code repository
      if (buildInfo.appVolume) {
        createOptions.HostConfig.Binds.push(buildInfo.appVolume);
      }
    }
    // Incase the DNS server does not work normally - to speed up DNS lookup
    // Enable this if the builder is behind GFW
    /*createOptions.HostConfig.ExtraHosts = [
      "host_name:IP"
    ];*/
    // TODO: Limit the resource of image builder
    //createOptions.HostConfig.Memory = 1024*1024*100;
    //createOptions.HostConfig.cpusetcpus = "0,1";

    logger.debug(method, "Build info: " + JSON.stringify(buildInfo));
    logger.debug(method, "Create option: " + JSON.stringify(createOptions));
    // Handle project link
    let useNewContainer = buildInfo.clearCache;
    if (volumeMapping && volumeMapping.length > 0) {
      volumeMapping.forEach(function(volume) {
        createOptions.HostConfig.Binds.push(volume);
      })
    }
    // Use project container for cache purpose if specified
    if (!buildInfo.project_container_id || useNewContainer === '1') {
      logger.info(method, "=> Will create a new container for build.");
      return this.dockerUtil.createContainer(createOptions).then(function (container) {
        // No startOptions for now, just start to build it
        /*return Promise.promisify(container.start)().then(function (data) {
          return container
        })*/
        return new Promise(function (resovel, reject) {
          container.start(function (err, data) {
            if (err) {
              reject(err)
              return
            }
            resovel(container)
          })
        })
      })
    }
    const self = this
    // Check if this conatainer exist first
    return this.dockerUtil.getContainer(buildInfo.project_container_id).then(function (container) {
      if (!container || !container[0]) {
        logger.info(method, "=> No container found, will create a new one.");
        return self.dockerUtil.createContainer(createOptions).then(function (container) {
          // No startOptions for now, just start to build it
          return new Promise(function (resovel, reject) {
            container.start(function (err, data) {
              if (err) {
                reject(err)
                return
              }
              resovel(container)
            })
          })
        });
      }
      // Start this container to build using cache
      logger.info(method, `=> Reusing exiting builder<${buildInfo.project_container_id.substring(0, 12)}> for cache.`);
      const targetContainer = container[0]
      return new Promise(function (resovel, reject) {
        targetContainer.start(function (err, data) {
          if (err) {
            reject(err)
            return
          }
          logger.debug(method, "Target container: " + JSON.stringify(targetContainer))
          resovel(targetContainer)
        })
      })
    })
  }

  pullImage(image, opts) {
    const registryConfig = global.REGISTRY_CONFIG
    if (!opts) {
      opts = {}
    }
    if (!opts.authconfig) {
      opts.authconfig = {
        username: registryConfig.user,
        password: registryConfig.password,
        email: DEFAULT_IMAGE_BUILD_EMAIL
      }
    }
    image = image ? image: DEFAULT_IMAGE_BUILDER
    return this.dockerUtil.pullImage(image, opts)
  }
}

module.exports = ImageBuilder