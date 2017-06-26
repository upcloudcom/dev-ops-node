'use strict'

const request = require('supertest')
const app = require('../../app.js')

describe("POST /api/v1/deploy/notification", function () {
  it("response with json", function (done) {
    request(app)
      .post("/api/v1/deploy/notification")
      .set("username", "zhangpc")
      .set("authorization", "Basic c3lzdGVtOjMxZTEyMGIzLTUxMmEtNGUzYi05MTBjLTg1Yzc0N2ZiMWVjMg==")
      .set("Content-Type", "application/json")
      .send({
        "events": [{
          "id": "ed941c61-c35a-4fce-8aa5-306ddd9237f0",
          "timestamp": "2016-04-05T07:38:06.29368877Z",
          "action": "push",
          "target": {
            "mediaType": "applicationnd.docker.distribution.manifest.v1+json",
            "size": 37012,
            "digest": "sha256:e528b780fe23ec32bd6e46acaa8477b0248577b970ab379f04590e79ad027063",
            "length": 37012,
            "repository": "zhangpc/test-build",
            "tag": "latest",
            "url": "http://192.168.1.113/v2/zhangpc/test-build/manifests/sha256:e528b780fe23ec32bd6e46acaa8477b0248577b970ab379f04590e79ad027063"
          },
          "request": {
            "id": "fd3b8693-179f-42b8-8aff-7bcf5f417980",
            "addr": "192.168.1.86:60004",
            "host": "192.168.1.86:5000",
            "method": "PUT",
            "useragent": "docker/1.9.1 go/go1.4.2 git-commit/a34a1d5 kernel/4.2.0-34-generic osnux archd64"
          },
          "actor": {
            "name": "zhangpc"
          },
          "source": {
            "addr": "016ee4244c93:5000",
            "instanceID": "87268267-1e1a-4bae-b3de-b5f18ad1fafc"
          }
        }]
      })
      .expect("Content-Type", /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        console.log(JSON.stringify(res.body))
        done();
      })
  })
})