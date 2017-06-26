# TenxCloud DevOps service 2.0

### 全局变量说明
变量名 | 说明 | 举例
---|---|---
`__dirname` | 当前文件所在目录的路径名称 | `D:\\cloudDream\\projects\\private_cloud\\enterprise-2.0\\user-portal\\services`
`__root__dirname` | 项目的根目录名称 | `D:\\cloudDream\\projects\\private_cloud\\enterprise-2.0\\user-portal`
**注：`__root__dirname` 在一个项目中是固定的，推荐大家在做读取文件操作时使用 `__root__dirname` 而不是 `__dirname`，后端代码会使用 webpack 打包成一个文件，如果使用 `__dirname` 可能会导致打包后运行出错**

### 环境变量说明

变量名 | 默认值 | 说明 | 可选值
---|---|---|---
NODE_ENV | `'development'` | Node 运行模式 | `'development'`, `'staging'`, `'production'`
LOG_LEVEL | `'INFO'` | 日志级别 |`'INFO'`, `'WARN'`, `'ERROR'`

```
Service to support CI/CD related features
```

## build files
```
npm run build
```

## pull image
```
docker pull 192.168.1.86:5000/tenxcloud/tenx_ci_cd_service
```

## run server

```
docker run -d --restart=always -p 8090:8090 --name tenx-cicd-service -v "$PWD":/opt/nodejs/configs 192.168.1.86:5000/tenxcloud/tenx_ci_cd_service
```