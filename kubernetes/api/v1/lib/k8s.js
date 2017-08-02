/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 */

var FormData     = require('form-data');

require('sugar');

var url = require('url');
var util = require('util');

 /**
  * kubernetes client.
  *
  * Parameters
  * @protocol http or https
  * @host k8s API server host
  * @version k8s API server version
  * @token k8s API server token
  */

var VcapClient = module.exports = function (info) {

    // ~~~~~ PRIVATE
    var self = this;

    if (! info.host) {
        return new TypeError('host must be provided');
    }

    if (! info.version) {
        return new TypeError('version must be provided');
    }

    if (info.protocol == 'https' && !info.token) {
        return new TypeError('token must be provided as the protocol is https');
    }
    
    if (! info.timeout) {
      info.timeout = 10000;  // default is 10 sec
    }

    var request = require('./request')(info.protocol || 'https:', info.host, 'api', info.version, info.token, info.timeout);
    var requestBatch = require('./request')(info.protocol || 'https:', info.host, 'apis/batch', info.version, info.token, info.timeout);
    // Deployment is v1beta1 for now
    var extension = require('./request')(info.protocol || 'https:', info.host, 'apis/extensions', 'v1beta1', info.token, info.timeout);
    var raw = require('./request')(info.protocol || 'https:', info.host, null, null, info.token, info.timeout);

    // ~~~~~ PUBLIC

    var Collections = require('./collections.js');
    var collections = new Collections(request);
    var batchCollections = new Collections(requestBatch);
    var extensionCollections = new Collections(extension)
    var rawCollections = new Collections(raw)

    // ~ events
    this.events = collections.create('events');

    // ~ namespaces
    this.namespaces = collections.create('namespaces');

    // ~ nodes
    this.nodes = collections.create('nodes');

    // ~ redirect
    this.redirect = collections.create('redirect');

    // ~ pods
    this.pods = collections.create('pods');

    // ~ services
    this.services = collections.create('services');

    // ~ limitranges
    this.limitranges = collections.create('limitranges');

    // ~ endpoints
    this.endpoints = collections.create('endpoints');

    // ~ persistentvolumes
    this.persistentvolumes = collections.create('persistentvolumes');

    // ~ resourcequotas
    this.resourcequotas = collections.create('resourcequotas');

    // ~ replicationcontrollers
    this.replicationcontrollers = collections.create('replicationcontrollers');

    // ~ namespaces of apis/batch
    this.batchNamespaces = batchCollections.create('namespaces');

    // ~ namespaces of extensions/v1beta1
    this.extensionNamespaces = extensionCollections.create('namespaces');

    this.raw = rawCollections.create(null);
};
