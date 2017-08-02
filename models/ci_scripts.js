/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2017 TenxCloud. All Rights Reserved.
 * v0.1 - 2017-06-29
 * @author lizhen
 */

/**
 * The model of tenx_ci_scripts
 */

'use strict'

function ciScripts(types) {
  return {
    id: {
      type: types.STRING(24),
      allowNull: false,
      primaryKey: true
    },
    content: {
      type: types.BLOB,
      allowNull: false
    }
  }
}

const meta = {
  timestamps: false,
  freezeTableName: true,
  tableName: 'tenx_ci_scripts',
  classMethods: {
    addScript: function (script) {
      return this.create(script)
    },
    getScriptByID: function (id) {
      return this.findOne({where: {id}})
    },
    deleteScriptByID: function (id) {
      return this.destroy({where: {id}})
    },
    updateScriptByID: function (id, script) {
      return this.update(script, {where: {id}})
    }
  }
}

module.exports = (orm, types) => orm.define('ci_scripts', ciScripts(types), meta)
