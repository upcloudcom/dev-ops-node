'use strict'

var request = require("supertest")
var app = require("../../app")

describe("GET /api/v1/buildagents/:name",function() {
  it("response with json",function(done) {
    request(app)
    .get("/api/v1/buildagents/builder1")
    .set("username", "tenxcloud")
    .set("authorization", "token 'a61df4cc4d490fabf609c0f7616cafbe4eac62eefcfca1c")
    .set("Content-Type", "application/json")
    .expect("Content-Type", /json/)
    .expect(200)
    .end(function(err,res) {
      if(err) throw err
     // console.log(res)
      done()
    })
  })
})

describe("POST /api/vi/buildagents",function() {
  it("response with json",function(done) {
    request(app)
    .post("/api/v1/buildagents")
    .set("username", "tenxcloud")
    .set("authorization", "token 'a61df4cc4d490fabf609c0f7616cafbe4eac62eefcfca1c")
    .set("Content-Type", "application/json")
    .send({
        "name": "builder2",
        "config": {
          "protocol": "https",
          "host": "builder1.tenxcloud.com",
          "port": 4243,
          "ca": 1,
          "cert": 2,
          "key": 3
        },
        "agent": {
          "user": "tenx_builder",
          "password": "5650aef5-ebd0-49b2-b33e-253dbae09207",
          "agentPort": "5001"
        }
     })
     .expect("Content-Type",/json/)
     .expect(200)
     .end(function(err,res) {
       if(err)throw err
      // console.log(res)
       done()
     })
  })
})

describe("PUT /api/v1/buildagents",function() {
  it("response with json",function(done) {
    request(app)
    .put("/api/v1/buildagents")
    .set("username", "tenxcloud")
    .set("authorization", "token 'a61df4cc4d490fabf609c0f7616cafbe4eac62eefcfca1c")
    .set("Content-Type", "application/json")
    .send({
        "name": "builder2",
        "config": {
          "protocol": "http",
          "host": "builder1.tenxcloud.com",
          "port": 4243,
          "ca": 1,
          "cert": 2,
          "key": 3
        },
        "agent": {
          "user": "yangyubiao",
          "password": "5650aef5-ebd0-49b2-b33e-253dbae09207",
          "agentPort": "5001"
        }
     })
    .expect("Content-Type", /json/)
    .expect(200)
    .end(function(err,res) {
      if(err)throw err
     // console.log(err)
      done()
    })
  })
})

describe("DEL /api/v1/buildagents/:name",function() {
  it("response with json",function(done) {
    request(app)
    .del("/api/v1/buildagents/builder2")
    .set("username", "tenxcloud")
    .set("authorization", "token 'a61df4cc4d490fabf609c0f7616cafbe4eac62eefcfca1c")
    .set("Content-Type", "application/json")
    .expect("Content-Type", /json/)
    .expect(200)
    .end(function(err,res) {
      if(err) throw err
    //  console.log(res)
      done()
    })
  })
})





