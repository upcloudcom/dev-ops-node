/*
 * Util package for docker operation, see the detail docker API in link below
 * https://github.com/apocas/dockerode
 *
 * v0.1 - 2014-10-18
 *
 * @author Wang Lei
*/
'use strict'

var Docker = require('dockerode');
var fs = require('fs');
var util = require('util');
const Promise = require('bluebird') // For webpack build backend files

// var socket = process.env.DOCKER_SOCKET||'/var/run/docker.sock';
/*
 * var stats = fs.statSync(socket);
 *
 * if (!stats.isSocket()) { throw new Error("Are you sure the docker is
 * running?"); }
 */
// http://211.155.86.216 is the test environment for docker
//var config = require('../config/docker.js');
// specially for mobile
//var docker = new Docker(config.mobile);

var logger = require('../utils/logger').getLogger("dockerUtil");

/*
 * Docker APIs for container
 */
class DockerUtil {
  constructor (dockerConfig) {
    if (!dockerConfig) {
      dockerConfig = {}
    }
    this.docker = new Docker(dockerConfig)
  }

  // listContainers (isAll, callback) {
  //   var method = "listContainers";


  //   /**
  //    *
  //    *
  //    *
  //    *
  //    *
  //    *
  //    *
  //    *
  //    *
  //    *
  //    */
  //   Promise.promisify(this.docker.listContainers)({ all: isAll }).then(function(containers){
  //      containers.forEach(function (containerInfo) {
  //       callback(this.docker.getContainer(containerInfo.Id), containers.length);
  //     });
  //   })
  // };

  /*
   * Create container based on the image and command
   */
  createContainer (createOptions) {
    const method = "createContainer"
    const self = this
    logger.debug(method, "Creating container...")
    /*return Promise.promisify(self.docker.createContainer)(createOptions).then(function (docker) {
      return docker
    })*/
    return new Promise(function (resolve, reject) {
      self.docker.createContainer(createOptions, function(err, docker) {
        if (err) {
          console.error(err.stack)
          reject(err)
          return
        }
        resolve(docker)
      })
    })
  };

  /*
   * Create container using 'run' command
   * Docker.prototype.run = function(image, cmd, streamo, createOptions, startOptions, callback) {
   */
  run(image, cmd, streamo, createOptions, startOptions, callback) {
    var method = "run";
    logger.debug(method, "Creating container using 'docker run' ...");
    return new Promise(function(resolve,reject){
      this.docker.run(image, cmd, streamo, createOptions, startOptions, function (err, data, container) {
        logger.debug(method, "Return data:" + data);
        if(err) throw new Error(err.messge)
        resolve([data, container])
      });
    })
  };

  /*
   * Can be used to check if the specified container exists
   */
  getContainer(containerId) {
    const method = "getContainer";
    logger.debug(method, "Getting container..." + containerId);
    const container = this.docker.getContainer(containerId);

    logger.debug(method, container);
    return new Promise(function(resolve, reject){
      if (!container) {
        let message = `No container found with id ${containerId}`
        logger.warn(method, message)
        return resolve(null)
      }
      container.inspect(function (err, data) {
        if (err) {
          if (err && err.statusCode === 404) {
            return resolve(null)
          }
          return reject(err)
        }
        if (data) {
          logger.info(method, `Image name: ${data.Config.Image}`)
        }
        resolve([container, data])
      })
    })
  }

  /*
   * Can be used to check if the specified container exists
   */
  getSimpleContainer (containerId) {
    var method = "getSimpleContainer";
    logger.debug(method, "Getting container..." + containerId);
    var container = this.docker.getContainer(containerId);
    return container
  }

  /**
   * Start a container
   *
   * Status Codes:
   *   204 – no error
   *   304 – container already started
   *   404 – no such container
   *   500 – server error
   */
  startContainer (startOptions, containerId) {
    let method = "startContainer";
    if (!containerId) {
      containerId = startOptions;
      startOptions = undefined;
    }
    logger.debug("Startting container..." + containerId);
    let container = this.docker.getContainer(containerId);
    let start = Promise.promisify(container.start)
    start(startOptions).then(function (data) {
      return data
    });
  };

  restartContainer (restartOptions, containerId, callback) {
    let method = "restartContainer";
    if (!containerId) {
      containerId = startOptions;
      startOptions = undefined;
    }
    logger.debug("Restartting container..." + containerId);
    let container = this.docker.getContainer(containerId);
    let restart = Promise.promisify(container.restart)
    restart(restartOptions).then(function (data) {
      logger.info(method, "Container restarted: " + containerId);
      logger.debug(method, "Output from container startup : " + data);
      return data
    });
  };

  removeContainer (containerId, callback) {
    // TODO: Should check if the container is already stopped before remove
    // it!!!
    let method = "removeContainer";
    logger.debug(method, "Removing container..." + containerId);
    let container = this.docker.getContainer(containerId);
    let remove = Promise.promisify(container.remove)
    remove().then(function (data) {
      logger.info(method, "Container stopped: " + containerId);
      logger.debug(method, "Output from container removal : " + data);
      return data
    });
  };

  /**
   * Stop a container
   *
   * Status Codes:
   *   204 – no error
   *   304 – container already stopped
   *   404 – no such container
   *   500 – server error
   */
  stopContainer (containerId, callback) {
    let method = "stopContainer";
    logger.debug(method, "Stopping container..." + containerId);
    let container = this.docker.getContainer(containerId);
    return new Promise(function(resolve, reject){
      container.stop(function (err, data) {
        if (err) {
          reject(err)
          return
        }
        resolve(data)
      })
    })
  }

  execContainer (container, cmd) {
    // TODO: Should check if the container is already stopped before remove it
    var method = "execContainer";
    logger.debug(method, "Exec in container..." + container.id);

    var options = {
      "AttachStdout": true,
      "AttachStderr": true,
      "Tty": false,
      Cmd: cmd
    };
    let containerExec = Promise.promisify(container.exec)

    containerExec(options).then(function (exec) {
      let execStart = Promise.promisify(exec.start)
      return execStart().then(function (stream) {
        var data;
        stream.setEncoding('utf8');
        stream.pipe(process.stdout);
        /**
        var Writable = require('stream').Writable;
        var ws = Writable();
        var data = "";
        ws._write = function (chunk, encoding, next) {
          var buffer = (Buffer.isBuffer(chunk)) ? chunk : new Buffer(chunk, encoding);
          data += buffer;
          console.log('data00: ' + data);
          callback(err, data);
        }
        stream.pipe(ws);
        **/
      });
    });

    /*
     * exec.start(function(err, stream) { if (err) { throw err; return; }
     *
     * stream.setEncoding('utf8'); stream.pipe(process.stdout); });
     */
  }

  pullImage(repoTag, options) {
    const method = 'pull'
    const docker = this.docker
    logger.info(method, `image -> ${repoTag}`)
    if (!options) {
      options = {}
    }
    return new Promise(function (resolve, reject) {
      docker.pull(repoTag, options, function (err, stream) {
        if (err) {
          logger.error(method, err.stack)
          return reject(err)
        }
        resolve(stream)
      })
    })
  }
}

module.exports = DockerUtil;
