/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2017 TenxCloud. All Rights Reserved.
 * v0.1 - 2017-06-29
 * @author lizhen
 */

/**
 * Service for ci scripts
 */

'use strict'

const CIScripts = require('../models').CIScripts
const idGenerator = require('../utils/id_generator')

exports.getScriptByID = function*(id) {
  const script = yield CIScripts.getScriptByID(id)
  script.content = script.content.toString()
  return {status: 200, script}
}

exports.addScript = function*(content) {
  const script = {
    id: idGenerator.newScriptID(),
    content
  }
  yield CIScripts.addScript(script)
  return {status: 200, id: script.id}
}

exports.updateScriptByID = function*(id, content) {
  yield CIScripts.updateScriptByID(id, {id, content})
  return {status: 200}
}

exports.deleteScriptByID = function*(id) {
  yield CIScripts.deleteScriptByID(id)
  return {status: 200}
}
