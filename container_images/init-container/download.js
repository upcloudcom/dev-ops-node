/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2017 TenX Cloud. All Rights Reserved.
 * v0.1 - 2017-06-30
 * @author Zhangpc
 *
 */

/**
 * download ci scripts
 */

'use strict'

const crypto = require('crypto')
const fs = require('fs')
const urllib = require('urllib')
const SECRET_KEY = 'dazyunsecretkeysforuserstenx20141019generatedKey'
const ENV = process.env
const SCRIPT_ENTRY_INFO = ENV.SCRIPT_ENTRY_INFO
const SCRIPT_URL = ENV.SCRIPT_URL
// const SCRIPT_ENTRY_INFO = '3ayx45n7sE7hN+FdGdyuLh4omY0aCYBI22rGT57zc+6vgrWD7iCAuiEFmIFrecsRBVYWYZceZ5yga3byv7HyC+IwCMbK0PDZjGC8ZpM45zUbMzPKZ6zT/aeasym/KXlyZ4uiCACTV40m2W+8nVaxIUE5xR2qztHTdIeAUD9nm/PGhB/26ez5U11Fh1eyl+D8UlS11P2NGUV+JD/m2FwF0MM3vg=='
// const SCRIPT_URL = 'http://192.168.0.97:8090/api/v2/devops/ci-scripts'

// Disabled rejecting self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

if (!SCRIPT_ENTRY_INFO) {
  process.exit(0)
  return
}

const scriptEntryInfo = aeadDecrypt(SCRIPT_ENTRY_INFO).split(':')
const scriptId = scriptEntryInfo[0]
const username = scriptEntryInfo[1]
const token = scriptEntryInfo[2]
const scriptPath = `/app/${scriptId}`

const scriptUrl = `${SCRIPT_URL}/${scriptId}`
const reqOptions = {
  dataType: 'json',
  contentType: 'json',
  timeout: 1000 * 60,
  headers: {
    username,
    authorization: `token ${token}`,
  }
}
urllib.request(scriptUrl, reqOptions).then(res => {
  if (res.status !== 200) {
    throw new Error(JSON.stringify(res))
  }
  const script = res.data.script
  fs.writeFileSync(scriptPath, script.content, { mode: 0o755 })
  process.exit(0)
}).catch(err => {
  console.log(err.stack)
  process.exit(-1)
})


function aeadDecrypt(encrypted) {
  const buffer = new Buffer(encrypted, 'base64')
  const salt = buffer.slice(0, 64)
  const iv = buffer.slice(64, 76)
  const tag = buffer.slice(76, 92)
  const content = buffer.slice(92)
  const secret = new Buffer(SECRET_KEY)
  const key = crypto.pbkdf2Sync(secret, salt, 2145, 32, 'sha512')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(content, 'binary', 'utf8') + decipher.final('utf8')
}