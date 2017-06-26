/*
* Licensed Materials - Property of tenxcloud.com
* (C) Copyright 2016 TenxCloud. All Rights Reserved.
*/

/*
Configuration that should not expose to everyone, and we can change them using
environment variables.

Specially for production environment.

*/

var ENVIRONMENT_VARIABLES = {
  "is_production": process.env.IS_PRODUCTION, // 1 to enable productioin environment
  "mysql": {
    host: process.env.MYSQL_HOST,             // IP or host name
    user: process.env.MYSQL_USER,             // User to access mysql database
    password: process.env.MYSQL_PASSWORD,     // Password for the user
    database: process.env.MYSQL_DBNAME        // Database that used for TenxCloud engine
  },
  "server": {
    "port": 8000
  }
};

module.exports = ENVIRONMENT_VARIABLES;
