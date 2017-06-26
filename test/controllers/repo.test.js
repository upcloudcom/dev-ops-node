'use strict'

const request = require('supertest')
const app = require('../../app')

describe('POST /api/v1/ci/repos/:username/:depot', function() {
  it('auth user repo', function(done) {
    const body = {
      "url": "http://git.tenxcloud.com",
      "private_token": "Xj2zk6HSsWbdpvo2sw64"
    }
    request(app)
      .post('/api/v1/ci/repos/tenxcloud/gitlab')
      .set('Accept', 'application/json')
      .set('username', 'tenxcloud')
      .set('Authorization', 'token \'a61df4cc4d490fabf609c0f7616cafbe4eac62eefcfca1c')
      .send(body)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)
        // console.log(JSON.stringify(res.body))
        done()
      })
  })
})

describe('POST /api/v1/ci/repos/:username/:depot/sync', function() {
  it('sync user repo', function(done) {
    const body = {
      "url": "http://git.tenxcloud.com",
      "private_token": "Xj2zk6HSsWbdpvo2sw64"
    }
    request(app)
      .post('/api/v1/ci/repos/tenxcloud/gitlab/sync')
      .set('Accept', 'application/json')
      .set('username', 'tenxcloud')
      .set('Authorization', 'token \'a61df4cc4d490fabf609c0f7616cafbe4eac62eefcfca1c')
      .send(body)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)
        // console.log(JSON.stringify(res.body))
        done()
      })
  })
})

describe('GET /api/v1/ci/repos/:username/:depot', function() {
  it('respond user repos', function(done) {
    request(app)
      .get('/api/v1/ci/repos/tenxcloud/gitlab')
      .set('Accept', 'application/json')
      .set('username', 'tenxcloud')
      .set('Authorization', 'token \'a61df4cc4d490fabf609c0f7616cafbe4eac62eefcfca1c')
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)
        // console.log(JSON.stringify(res.body))
        done()
      })
  })
})

describe('DELETE /api/v1/ci/repos/:username/:depot', function() {
  it('deltete user repo', function(done) {
    request(app)
      .delete('/api/v1/ci/repos/tenxcloud/gitlab')
      .set('Accept', 'application/json')
      .set('username', 'tenxcloud')
      .set('Authorization', 'token \'a61df4cc4d490fabf609c0f7616cafbe4eac62eefcfca1c')
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)
        // console.log(JSON.stringify(res.body))
        done()
      })
  })
})