/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 */

// add header strictSSL: false
// modified by huangqg

var errors  = require('./errors');
var request = require('request');

require('sugar');

var url = require('url');
var util = require('util');

module.exports = function (protocol, host, apigroup, version, token, timeout) {
    var getUrl = function (object) {
        /**
        return url.format({
            protocol: protocol,
            hostname: host,
            pathname: 'api/v1beta2/' + object.endpoint
        });
        **/
        return protocol + '://' + host + '/' + [apigroup, version, object.endpoint].filter(part => part).join('/');
    };
    var getAuthUrl = function () {
      return new Promise(function(resolve,reject){
          request({
              url: getUrl({ endpoint: 'info' }),
              json: true,
              strictSSL: false
          }, function (err, resp, body) {
              if (err) {
                  return reject(err);
              }
              if (resp.statusCode !== 200) {
                  return resolve(resp.statusCode, body);
              }
              resolve(null, body.authorization_endpoint + '/oauth/token');
          });
      })
      
    };
    var isSuccess = function (code) {
        return (code - (code % 200)) === 200;
    };

    var makeRequest = function (object) {
        object = Object.clone(object);
        object.url = getUrl(object);
        delete object.endpoint;
        object.json = object.json || true;
        object.timeout = timeout;
        if (object.json) {
            if ([ 'object', 'boolean' ].none(typeof object.json)) {
                object.body = object.json;
                object.json = undefined;
            }
        }
        if (object.page) {
            if (! object.qs) {
                object.qs = {};
            }

            object.qs.page = object.page;
            delete object.page;
        }
        //@important! add by huangqg
        //skip-ssl
        object.strictSSL = false;

        return new Promise(function(resolve,reject){
            request(object, function (err, resp, body) {
              if (err) {
                  return reject(err);
              }

              if (isSuccess(resp.statusCode)) {
                  return resolve(body);
              }

              return resolve(errors.get(resp));
          });
        })
    };

    return function (object) {
        if (token) {
            object.headers = {
                Authorization: 'bearer ' + token
            };
        }
        return makeRequest(object);
    };
};
