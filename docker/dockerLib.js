/*
 * Util package for docker operation, see the detail docker API in link below
 * https://github.com/apocas/dockerode
 *
 * v0.1 - 2014-10-18
 *
 * @author Wang Lei
*/

var Docker = require('dockerode');
var fs     = require('fs');
var util   = require('util');

/*
   Docker : docker object that can deal with different config
   Container   : Container object
*/
var dockerif = module.exports.Docker = function(curconfig){
  if(!curconfig)
    throw 'Miss docker config';
  this.docker = new Docker(curconfig);
}

//it can only accept container object
//for containerid we must call dockerif.getContainer(id) to get the container object;
var reDefContainer = module.exports.Container = function(val){

  if(typeof val === 'string') {
    throw 'invalid container object';
  }else if(typeof val == 'object' ){
    this.container = val;
    this.id = val.id;
  }else{
    this.container = null;
    console.log("this's no container obtained");
  }

}

//defination for container object
reDefContainer.prototype.start = function(opts, callback) { //callback(err, data)
    this.container.start(opts,callback);
}
reDefContainer.prototype.stop = function(opts, callback) { //callback(err, data)
    this.container.stop(opts,callback);
}
reDefContainer.prototype.inspect = function(callback) { //callback(err, data)
    this.container.inspect(callback);
}
reDefContainer.prototype.remove = function(callback) {  //  callback(err, data)
    this.container.remove(function (err, data) {
    if(callback)
      callback(err,data);
    console.log(data);
  });
}
reDefContainer.prototype.attach = function(opts, callback) { //callback(err, stream)
  this.container.attach(opts, callback);
}

reDefContainer.prototype.commit = function(opts, callback) { //callback(err, data)
  this.container.commit(opts,callback);
}

reDefContainer.prototype.pause = function(opts, callback) { //callback(err, data)
  this.container.pause(opts,callback);
}
reDefContainer.prototype.unpause = function(opts, callback) { //callback(err, data)
  this.container.unpause(opts,callback);
}

reDefContainer.prototype.exec = function(opts, callback) { //callback(err, new Exec(self.modem, data.Id))
  this.container.exec(opts,callback);
}
reDefContainer.prototype.wait = function(callback) { //callback(err, data)
  this.container.wait(callback);
}
reDefContainer.prototype.resize = function(opts, callback) { //callback(err, data)
  this.container.resize(opts, callback);
}


//defination for docker interface
/**
* Buils an image
* @param {String}   file     File
* @param {Object}   opts     Options (optional)
* @param {Function} callback Callback
*/


dockerif.prototype.buildImage = function(file, opts, callback) { //callback(err, data)
  this.docker.buildImage(file,opts,callback);
};

dockerif.prototype.getImage = function(name) { //callback(err, data)
   return this.docker.getImage(name);
};
dockerif.prototype.isImageEixsting = function(name, callback){

  this.getImage(name).inspect(function(err, data){
    if(callback)
      callback(err,data);
  });
}


dockerif.prototype.listContainers = function(isAll, callback) {
  var self = this;
  this.docker.listContainers({all: isAll}, function (err, containers) {
    if (err) {
      console.log("Error occurs when list container");
      throw err;
    }
    console.log('Number of containers:' +containers.length);
    containers.forEach(function (containerInfo){
      var reContainer = new reDefContainer(self.docker.getContainer(containerInfo.Id));
      callback(reContainer);
    });
  });
};

dockerif.prototype.createContainer = function(createOptions, callback) {
  console.log("Creating container...");
  this.docker.createContainer(createOptions, function (err,container) {
    if (err) {
      console.log("Error occurs when creating the container: " + err);
      throw err;
    }
    console.log("Id of created container: " + container.id);
    var reContainer = new reDefContainer(container);
    console.log('type of refContainer.attach = ' + typeof reContainer.attach);
    callback(reContainer);
  });
};

/*
* Get info of docker
*/
dockerif.prototype.info = function(callback) { //callback(err, data);
  this.docker.info(callback);
}

/*
* Create Image or pull from hub
*/
dockerif.prototype.pull = function(repoTag, opts, callback) {
  this.docker.pull(repoTag, opts, callback);
}


/*
* Create container using 'run' command
*/
dockerif.prototype.run = function(image, cmd, createOptions, callback){
  console.log("Creating container using 'docker run' ...");
  this.docker.run(image, cmd, process.stdout, createOptions, function(err, data, container){
    if (err) {
      throw err;
    }
    console.log("Return code:" + data.StatusCode);
    console.log("Id of created container: " + container.id);
    var reContainer = new reDefContainer(container);
    callback(reContainer);
  });
};
dockerif.prototype.isContainerExisting= function(containerid, callback){
  var container = this.docker.getContainer(containerid);
  if(container){
    container.inspect(function(err,data) {
      if(err){

        callback(false, err);
      }else{
        callback(true, data);
      }

    });

  }else{
    callback(false, 'not existing');
  }
}
dockerif.prototype.getContainer = function(containerId, callback) {
  console.log("Getting container..." + containerId);
  var containerobj = null;
  var container = this.docker.getContainer(containerId);
    if (container) {
      container.inspect(function(err,data) {
        if (err) {
          throw err;
        }
        if (data) {
          console.log("Image name: " + data.Config.Image);
        }
      });
      containerobj = new reDefContainer(container)
      if(callback) {

          callback(containerobj);
      }

    } else {
      console.log("No container found with id " + containerId);
      callback();
    }
    return containerobj;
}

dockerif.prototype.removeContainer = function(containerId) {
    // TODO: Should check if the container is already stopped before remove
    // it!!!
    console.log("Removing container..." + containerId);
    var container = new refDefContainer(containerId);
    container.remove(function (err, data) {
      if (err) {
        throw err;
      }
      console.log("Output from container removal : " + data);
    });
}

dockerif.prototype.execContainer = function(container, cmd) {
    // TODO: Should check if the container is already stopped before remove it
    console.log("Exec in container..." + container.id);

    var options = {
      "AttachStdout" : true,
      "AttachStderr" : true,
      "Tty" : false,
      Cmd : [ cmd ]
    };
    container.exec(options, function(err, exec) {
      if (err) {
        throw err;
        return;
      }
    });

    /*
    * exec.start(function(err, stream) { if (err) { throw err; return; }
    *
    * stream.setEncoding('utf8'); stream.pipe(process.stdout); });
    */
}
