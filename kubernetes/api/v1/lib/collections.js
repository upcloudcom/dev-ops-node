/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 */

var errors = require('./errors');
var logger = require('../../../../utils/logger').getLogger("collection");
require('sugar');

module.exports = function (request) {
    var getPath = function () {
        return [].slice.call(arguments).filter(function (each) {
            return each !== null && typeof each !== 'undefined';
        }).join('/');
    };

    var Collection = function (collection) {

        this.get = function (query) {
            var endpoint = collection;
            if (typeof query !== 'function') {
                endpoint += '/' + query;
            }
            return request({
                endpoint: endpoint,
                method: 'GET'
            });
        };

        this.getBy = function (paths, query) {
            var endpoint = collection;
            var params = ''
            if (paths) {
                endpoint += '/' + paths.join('/');
            }
            if (query) {
                Object.keys(query).forEach(function (key) {
                    params += '&' + key + '=' + query[key];
                });
                endpoint += '?' + params.substring(1);
            }
            return request({
                endpoint: endpoint,
                method: 'GET'
            });
        };

        this.create = function (body) {
            var endpoint = getPath(collection);
            return request({
                endpoint: endpoint,
                method: 'POST',
                json: body
            });
        };

        this.createBy = function (paths, query, body) {
            var endpoint = collection;
            var params = ''
            if (paths) {
                endpoint += '/' + paths.join('/');
            }
            if (query) {
                Object.keys(query).forEach(function (key) {
                    params += '&' + key + '=' + query[key];
                });
                endpoint += '?' + params.substring(1);
            }
            return request({
                endpoint: endpoint,
                method: 'POST',
                json: body
            });
        };

        this.update = function (id, body) {
            var endpoint = getPath(collection, id);
            return request({
                endpoint: endpoint,
                method: 'PUT',
                json: body
            });
        };

        this.updateBy = function (paths, query, body) {
            var endpoint = collection;
            var params = ''
            if (paths) {
                endpoint += '/' + paths.join('/');
            }
            if (query) {
                Object.keys(query).forEach(function (key) {
                    params += '&' + key + '=' + query[key];
                });
                endpoint += '?' + params.substring(1);
            }
            return request({
                endpoint: endpoint,
                method: 'PUT',
                json: body
            });
        };

        this.delete = function (id) {
            var object = {
                endpoint: getPath(collection, id),
                method: 'DELETE',
            };
            return request(object);
        };

        this.deleteBy = function (paths, query) {
            var endpoint = collection;
            var params = ''
            if (paths) {
                endpoint += '/' + paths.join('/');
            }
            if (query) {
                Object.keys(query).forEach(function (key) {
                    params += '&' + key + '=' + query[key];
                });
                endpoint += '?' + params.substring(1);
            }
            return request({
                endpoint: endpoint,
                method: 'DELETE'
            });
        };

        this.raw = function (options) {
            return request(options)
        }
    };

    this.create = function (collection) {
        return new Collection(collection);
    }
}
