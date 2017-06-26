const should = require('should')
const assert = require('assert')
const co = require('co')
const security = require('../../utils/security')
global.Promise = require('bluebird')

describe('utils security', function () {
  it('should return private/public keys', function (done) {
    co(function* () {
      const keyPairs = yield security.generateKeys()
      return keyPairs
    }).then(function (keyPairs) {
      console.log(keyPairs)
      done()
    }, function (err) {
      console.error(err)
      assert(false)
    })
  })
  it('should return ssh-rsa private/public keys', function (done) {
    co(function* () {
      const keyPairs = yield security.generateRsaKeys()
      return keyPairs
    }).then(function (keyPairs) {
      console.log(keyPairs)
      done()
    }, function (err) {
      console.error(err)
      assert(false)
    })
  })
})