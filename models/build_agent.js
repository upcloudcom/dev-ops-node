/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-20
 * @author YangYuBiao
 * 
 */

/**
 * The model of tenx_kuber_replicator
 */

'use strict'

module.exports=function(sequelize,DataTypes){
  return sequelize.define("buildAgent",{
    Id:{
      type:DataTypes.UUID,
      primaryKey:true,
      allowNull:false,
      defaultValue:DataTypes.UUIDV4
    },
    name:{
      type:DataTypes.STRING(100),
      allowNull:false,
      unique:true
    },
    config:{
      type:DataTypes.STRING(300),
      allowNull:false,
    },
    agent:{
      type:DataTypes.STRING(300),
      allowNull:false
    },
    createTime:{
      type:DataTypes.DATE,
      field:"create_time",
      defaultValue:DataTypes.NOW,
      allowNull:false
    }
  },{
    tableName:"tenx_build_agents",
    timestamps: false,
    freezeTableName: true,
    classMethods:{
      getAllAgent : function () {
        return this.findAll()
      },
      getBuildAgentByName:function(name){
        return this.findOne({
          where:{
            name:name
          }
        }).then(function(result){
          if (result) {
            result.dataValues.config = JSON.parse(result.config)
            result.dataValues.agent = JSON.parse(result.agent)
          }
          return result
        })
      },
      addBuildAgent: function(buildAgent){
        return this.create(buildAgent)
      },
      deleteBuildAgentByName: function(name){
        return this.destroy({
          where:{
            name:name
          }
        })
      },
      updateBulidAgentByName: function (name, value) {
        return this.update(value,
          {
            where: {
              name: name
            }
          }
        )
      }
    }
  })
}