/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-05-07
 * @author Zhangpc
 * 
 */

/**
 * Service for docker registry API
 */
'use strict'
const should = require('should')
const assert = require('assert')
const registryService = require('../../services/registry')

const events = 
  {
    "events": [
      {
        "id": "f064d2dd-b5db-4330-8bd3-9b8cad94fd5f",
        "timestamp": "2016-05-07T01:36:21.499177761Z",
        "action": "pull",
        "target": {
          "mediaType": "application/vnd.docker.distribution.manifest.v1+json",
          "size": 36890,
          "digest": "sha256:68acdac38276945ce428236dcdfd5a8e6817e41a837400b5e9e2b376809fe6c7",
          "length": 36890,
          "repository": "tenxcloud/wanglei_cicd",
          "url": "http://192.168.1.86:5000/v2/tenxcloud/wanglei_cicd/manifests/sha256:88954ebbd12b73add0eebe25517acefff54a0e219d001835624fef4ab5749d40"
        },
        "request": {
          "id": "f79f822b-7365-4b5f-a69d-979c723e5b04",
          "addr": "192.168.1.82:60346",
          "host": "192.168.1.86:5000",
          "method": "GET",
          "useragent": "docker/1.9.1 go/go1.4.2 git-commit/a34a1d5 kernel/4.2.0-34-generic os/linux arch/amd64"
        },
        "actor": {
          "name": "admin"
        },
        "source": {
          "addr": "8e14c2a190f2:5000",
          "instanceID": "c9e4328c-933f-4e76-a0ba-a23cfcc14680"
        }
      }
    ]
  }

describe('gitlab api', function () {
  it('should return image tags', function (done) {
    let imageName = events.events[0].target.repository
    let userName = 'admin'
    let url = events.events[0].target.url
    registryService.getTagFromEventsUrl(userName, imageName, url).then(function (result) {
      console.log(JSON.stringify(result.tag))
      return done()
    }).catch(function (err) {
      console.error(JSON.stringify(err))
      return assert(false)
    })
  })
})