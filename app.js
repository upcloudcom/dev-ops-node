/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 *
 * Tenxcloud CI/CD services
 *
 */

'use strict';
// For webpack build backend files runtime
require('babel-polyfill')
// Set root dir to global, must be at the top !
global.__root__dirname = __dirname
// Repalce native Promise by bluebird
global.Promise = require('bluebird')
// Disabled reject unauthorized
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const koa = require('koa')
const co = require('co')
const config = require('./configs')
const utility = require('./utils/utilities')
const logger = require('./utils/logger').getLogger('app')
const configsSercvice = require('./services/configs')
const auditServices = require('./services/audit')
const app = koa()
const audit = require('./services/audit')

/*
 * Middlewares
 */
// for log
const koaLogger = require('koa-logger')
app.use(koaLogger())

// cookie & session
const session = require('koa-session')
app.keys = [config.session_secret]
app.use(session(app))

// serve files from ./public
const serve = require('koa-static')
app.use(serve(__dirname + '/static'))

// for website favicon
const favicon = require('koa-favicon')
app.use(favicon(__dirname + '/static/favicon.ico'))

app.use(function* (next) {
  if (global.REGISTRY_CONFIG) {
    return yield next
  }
  global.REGISTRY_CONFIG = yield configsSercvice.getRegistryConfig()
  global.CICDCONFIG = yield configsSercvice.getCICDConfig()
  global.K8SCONFIGS = yield configsSercvice.getK8SConfigs()
  /////////////////////////////////////////////////////////
  // For testing
  //global.CICDCONFIG.url = "localhost:8091"
  // global.K8SCONFIGS = {
  //   protocol: "https",
  //   host: "192.168.1.52:6443",
  //   token: '1zymD9wnWLs0wRbAjbmu8jQn8req5L46',
  //   version: "v1"
  // }
  /////////////////////////////////////////////////////////
  logger.info("CICD config: " + JSON.stringify(global.CICDCONFIG))
  logger.info("Build Cluster config: " + global.K8SCONFIGS.host)
  logger.info("Registry config: " + global.REGISTRY_CONFIG.protocol + "://" + global.REGISTRY_CONFIG.host)
  yield next
})

// parser content-Type applicationnd.docker.distribution.events.v1+json
app.use(function* (next) {
  let contentType = this.headers["content-type"]
  if (contentType) {
    if (contentType.indexOf('docker') >= 0) {
      this.headers['content-type'] = 'application/json'
    }
  }
  yield next
})

// for body parser
const koaBody = require('koa-body')({
  multipart: true,
  formidable: {
    keepExtensions: true,
    maxFieldsSize: 1024 * 1024 * 1024,
    // uploadDir: TEMP_DIR
  }
})
app.use(koaBody)

// for error handling
app.use(function *(next) {
  try {
    this.session.auditInfo = {
      startTime: new Date()
    }
    yield next
  } catch (err) {
    if (err.status < 100) {
      err.status = 500
    }
    this.status = err.status || 500
    this.body = err
    if ('SequelizeDatabaseError' === err.name) {
      this.body = {message: 'Query database error'}
    }
    this.app.emit('error', err, this)
  } finally {
    if (this.method.toLowerCase() == "get" || (this.status < 300 && this.session.auditInfo.skip)) {
      //get请求不记录
      //正常响应且skip为true时不记录，目前用于过滤无用的cd通知
      return
    }
    const self = this
    self.session.auditInfo.endTime = new Date()
    co(function* () {
      try {
        let result = auditServices.match(self.method.toLowerCase(), self.path)
        if (!result) {
          logger.debug(`No audit rule for (${self.method})${self.path}`)
          return
        }
        //ci cd通知需要从auditInfo中获取namespace
        result.namespace = self.session.loginUser ? self.session.loginUser.namespace : self.session.auditInfo.namespace
        if (!result.namespace) {
          return
        }
        result.duration = self.session.auditInfo.endTime - self.session.auditInfo.startTime
        result.status = self.status
        result.path = self.path
        result.resource_name = self.session.auditInfo.resourceName
        result.resource_id = self.session.auditInfo.resourceId
        result.resource_config = self.session.auditInfo.resourceConfig
        result.cluster_id = self.session.auditInfo.clusterId
        if (!result.resource_id && result.resourceIdParam) {
          result.resource_id = self.params[result.resourceIdParam]
        }
        if (!result.resource_name && result.resourceNameParam) {
          result.resource_name = self.params[result.resourceNameParam]
        }
        if (!result.resource_config && self.request.body && Object.keys(self.request.body).length > 0) {
          result.resource_config = JSON.stringify(self.request.body)
        }
        yield auditServices.insertToDB(result)
      } catch (e) {
        logger.error('Failed to record audit information', e)
      }
    })
  }
})

const Router = require('koa-router')
// Default route
const indexRouter = new Router()
indexRouter.get('/', function* (next ) {
  this.body = "TenxCloud DevOps service is running."
})
app.use(indexRouter.routes())

//ci cd not required auth
const notificationRouter = require('./routes/notification_handler')
app.use(notificationRouter(Router))

const noAuthRouter = require('./routes/no_auth')
app.use(noAuthRouter(Router))

// check api token
const auth = require('./utils/auth')
app.use(auth.authByToken)

// route middleware
const ciRoutes = require('./routes/ci')
const cdRoutes = require('./routes/cd')
app.use(ciRoutes(Router))
app.use(cdRoutes(Router))
app.use(function* (next) {
  if(this.method.toLowerCase() == "get") {
    return
  }
  const self = this
  self.session.auditInfo.endTime = new Date()
  co(function* () {
    let result = auditServices.match(self.method, self.path)
    if(!result) {
      return
    }
    result.namespace = self.session.loginUser.namespace
    result.duration = self.session.auditInfo.startTime - self.session.auditInfo.endTime
    result.status = self.status
    result.path = self.path
    const router = result.router
    result.path = self.path
    yield auditServices.insertToDB(result)
  })
  yield next
})
// for 404
// app.use(function* pageNotFound(next){
//   yield next
//   if (404 != this.status) return

//   // we need to explicitly set 404 here
//   // so that koa doesn't assign 200 on body=
//   this.status = 404
//   switch (this.accepts('html', 'json')) {
//     case 'html':
//       this.type = 'html'
//       this.body = '<h3>Page Not Found</h3>'
//       break
//     case 'json':
//       this.body = {
//         statusCode: 404,
//         message: 'Page Not Found'
//       }
//       break
//     default:
//       this.type = 'text'
//       this.body = 'Page Not Found'
//   }
// })

// create http server
const http = require('http')
const server = http.createServer(app.callback()).listen(config.port, config.host, function() {
  setTimeout(function() {
    logger.info('TenxCloud DevOps service is listening on port ' + config.port)
    logger.info('Open up http://' + config.host + ':' + config.port +'/ in your browser.')
  }, 1500)
})

// for socket
const io = require('socket.io')(server)
const socketController = require('./controllers/socket')
io.of('/stagebuild/log').on('connection', function (socket) {
  // socket.emit('tenxcloud', { hello: 'world' });
  socketController(socket)
})

const jobWatcher = require('./controllers/job_watcher_socket')
const jobWatcherService = require('./services/job_watcher')
jobWatcherService.start()
io.of('/stagebuild/status').on('connection', function (socket) {
  jobWatcher(socket)
})

// create https server
/*const https = require('https')
const fs = require('fs')
const prikeyfile = './sslkey/private.key'
const certfile = './sslkey/certs.crt'
const httpsoptions = {
  key: fs.readFileSync(prikeyfile),
  cert: fs.readFileSync(certfile)
}
const server = https.createServer(httpsoptions, app.callback()).listen(config.port, config.host, function() {
  setTimeout(function() {
    logger.info('TenxCloud CI & CD Service is listening on port ' + config.port)
    logger.info('Open up ' + config.protocol + '://' + config.host + ':' + config.port +'/ in your browser.')
  }, 1500)
})*/

// set server timeout to 5 mins
const serverTimeOut = 1000 * 60 * 5
logger.info('Set server timeout to ' + serverTimeOut + ' ms')
server.setTimeout(serverTimeOut, function (socket) {
  logger.warn('Server timeout occurs')
})

module.exports = server
