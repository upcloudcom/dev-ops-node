/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author YangYuBiao
 * 
 */

/**
 * The model of tenx_kuber_replicator
 */
'use strict'

const utils = require('../utils')
const indexConfig = require('../configs')
const sql = require('../database/spliceSQL')(indexConfig.db_type)

module.exports = function(sequelize, DataTypes) {
  return sequelize.define("replicator", {
    rc_uid: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue:DataTypes.UUIDV4
    },
    rc_name: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    hosting_cluster: {
      type: DataTypes.STRING(45),
      allowNull: false,
      defaultValue: 'default'
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    displayname: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    image: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    image_type: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    namespace: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    container_size: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    replicaSelector: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    labels: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    primary_container_port: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    cpu: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    memory: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    disksize: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    external_domain: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    external_domain_proxy: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    sub_domain: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    user_defined_domain: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    create_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: utils.DateNow
    },
    is_deleted: {
      type: DataTypes.STRING(45),
      allowNull: false,
      defaultValue: '0'
    },
    delete_deadline: {
      type: DataTypes.DATE,
      allowNull: true
    },
    remark_for_storage: {
      type: DataTypes.STRING(200),
      allowNull: true
    }
  },{
    timestamps: false,
    freezeTableName: true,
    tableName: 'tenx_kuber_replicator',  
    classMethods:{
      getRcByUsername : function(username){
        return this.modelSelect(sql.SQL_SELECT_REPLICATOR_BY_USER_NAME,[username])
      },
      isRcExist       : function(rcName, namespace, master){
        //rc_name = ? and user_id = ? and namespace = ? and hosting_cluster = ? and is_deleted != -1"
        return this.count({
           rc_name:rcName,
           namespace:namespace,
           hosting_cluster:master,
           is_deleted:'-1'
        })
      },
      //image = ? where rc_name = ? and user_id = ? and namespace = ? and hosting_cluster = ? and is_deleted != -1";
      updateRcImage   : function(image, rcName, namespace, master){
         return this.update({
            image:image,
         },
         {
           where:{
             rc_name:rcName,
             namespace:namespace,
             hosting_cluster:master,
             is_deleted:'-1'
           }
         })
      },
      // "select * from tenx_kuber_replicator where user_id = ? and rc_name = ?  and hosting_cluster = ? and is_deleted != -1";
      findInstById    : function(rcName, namespace, master){
        return this.findAll({
           where:{
             namespace:namespace,
             rc_name:rcName,
             hosting_cluster:master,
             is_deleted:{
               $ne :'-1'
             }
           }
        })
      },
      modelSelect     : function(sql,array){
        return sequelize.query(sql,{replacements:array,type:sequelize.QueryTypes.SELECT});
      },
    }
  })
}