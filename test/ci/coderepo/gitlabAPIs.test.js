'use strict'

const should = require('should')
const assert = require('assert')
const GitlabAPIs = require('../../../ci/coderepo/gitlabAPIs')
const co = require('co')

describe('gitlab api', function () {
  this.timeout(1 * 1000)
  let gitlab
  beforeEach(function() {
    gitlab = new GitlabAPIs('http://git.tenxcloud.com', 'Xj2zk6HSsWbdpvo2sw64')
  })
  it('should return user info', function (done) {
    co(function* () {
      var result = yield* gitlab.getUserInfo()
      return result
    }).then(function (result) {
      // console.info(result.data.toString())
      done()
    }, function (err) {
      console.error(err)
      assert(false)
    })
  })
  it('should return user orgs', function (done) {
    co(function* () {
      var result = yield* gitlab.getUserOrgs()
      return result
    }).then(function (result) {
      // console.info(result.data.toString())
      done()
    }, function (err) {
      console.error(err)
      assert(false)
    })
  })
  it('should return user all repos', function (done) {
    co(function* () {
      var result = yield* gitlab.getUserAllRepos()
      return result
    }).then(function (result) {
      // console.info(result.data.toString())
      done()
    }, function (err) {
      console.error(err)
      assert(false)
    })
  })
  it('should return user own repos', function (done) {
    co(function* () {
      var result = yield* gitlab.getUserOwnRepo()
      return result
    }).then(function (result) {
      // console.info(result.data.toString())
      done()
    }, function (err) {
      console.error(err)
      assert(false)
    })
  })
  it('should return user all branches of one repo', function (done) {
    co(function* () {
      var result = yield* gitlab.getRepoAllBranches(3)
      return result
    }).then(function (result) {
      // console.info(result.data.toString())
      done()
    }, function (err) {
      console.error(err)
      assert(false)
    })
  })
})