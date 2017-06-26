/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-06-22
 * @author YangYuBiao
 *
 */

/**
 * API for github
 */

'use strict'

const _request = require('./_request')('Github')
const gitHubConfig = require('../../../configs/coderepo/github.js')
const config = require('../../../configs')
const crypto = require('crypto')
const logger = require('../../../utils/logger').getLogger('coderepo/github')
const utils = require('../../../utils')
const Promise = require('bluebird') // For webpack build backend files
class GitHubAPIs {
  constructor(repoInfo) {
    // No github config available
    if (!gitHubConfig.clientId || gitHubConfig.clientId == "") {
      const error = new Error('No available github config found, should do the configuration first.')
      error.status = 404
      throw error
    }
    this.url = gitHubConfig.gitHubApiUrl
    if (repoInfo && repoInfo.access_token) {
      this.access_token = repoInfo.access_token
    }
  }

  _getExchangeTokenUrl(code) {
    return `${gitHubConfig.gitHubLoginUrl}/access_token?client_id=${gitHubConfig.clientId}&client_secret=${gitHubConfig.clientSecret}&code=${code}`
  }

  _getEndPoint(endpoint, page) {
    return `${this.url}${endpoint}${page ? '?per_page=50&page=' + page : ''}`
  }

  exchangeToken(code) {
    let self = this
    let reqUrl = this._getExchangeTokenUrl(code)
    return _request(reqUrl).then(function (result){
      self.access_token = result.data.access_token
      return { access_token: self.access_token }
    })
  }

  getUserInfo() {
    let self = this
    return _request(this._getEndPoint('/user'), {
      headers: {
        'Authorization': 'token ' + self.access_token
      },
      dataType: 'json'
    }).then(function (result) {
      result = result.data
      let userInfo = {
        login: result.login,
        type: 'user',
        id: result.id,
        url: result.html_url,
        avatar: result.avatar_url,
        email: result.email,
        isadmin: result.site_admin
      }
      return userInfo
    })
  }

  getUserOrgs() {
    var self = this
    return _request(this._getEndPoint('/user/orgs'), {
      headers: {
        'Authorization': 'token ' + self.access_token
      },
      dataType: 'json'
    }).then(function (result) {
      let orgs = []
      result = result.data
      result.forEach(function (item) {
        orgs.push({
          login: item.login,
          type: 'orgs',
          id: item.id,
          url: item.url,
          avatar: item.avatar_url,
          email: item.email,
          isadmin: false
        })
      })
      return orgs
    })
  }

  getUserAndOrgs() {
    let self = this
    let userAndOrgs =[]
    return self.getUserInfo().then(function (user) {
      userAndOrgs.push(user)
      return self.getUserOrgs().then(function (orgs) {
        return userAndOrgs.concat(orgs)
      })
    })
  }

  getAllUsersRepos(allUser) {
    let self = this
    let promiseObj = {}
    allUser.forEach(function (item) {
      let reqUrl = `/user/repos`
      if (item.type === 'orgs') {
        reqUrl = `/orgs/${item.login}/repos`
      }
      promiseObj[item.login] = _request(self._getEndPoint(reqUrl, 1), {
        headers: {
          'Authorization': 'token ' + self.access_token
        },
        dataType: 'json'
      }).then(function (result) {
        let repos = []
        let totalPage = result.headers.link
        result = result.data
        result.forEach(function (item) {
          repos.push(self._formateRepo(item))
        })
        if (!totalPage) {
          return repos
        }
        totalPage = self._getTotalPage(totalPage)
        let currentPage = 1
        let tempPromiseArray = []
        while (currentPage < totalPage) {
          ++currentPage
          tempPromiseArray.push(_request(self._getEndPoint(reqUrl, currentPage), {
            headers: {
              'Authorization': 'token ' + self.access_token
            },
            dataType: 'json'
          }).then(function (result) {
            result.data.forEach(function (item) {
              repos.push(self._formateRepo(item))
            })
          })
          )
        }
        if (!tempPromiseArray.length) return repos
        return Promise.all(tempPromiseArray).then(function () {
          return repos
        })
      })
    })
    return promiseObj
  }

  getRepoAllBranches(repoName, repoId) {
    let branches = []
    let self = this
    let reqUrl = `/repos/${repoName}/branches`
    return _request(self._getEndPoint(reqUrl, 1), {
      contentType: 'json',
      headers: {
        'Authorization': 'token ' + self.access_token
      },
      dataType: 'json'
    }).then(function (result) {
      result = result.data
      let branches = []
      result.forEach(function (item) {
        let branch = {
          branch: item.name
        }
        if (item.commit) {
          branch.commit_id = item.commit.sha
        }
        branches.push(branch)
      })
      return branches
    })
  }

  getRepoAllTags(repoName, repoId) {
    let tags = []
    let self = this
    let reqUrl = `/repos/${repoName}/tags`
    return _request(self._getEndPoint(reqUrl, 1), {
      contentType: 'json',
      headers: {
        'Authorization': 'token ' + self.access_token
      },
      dataType: 'json'
    }).then(function (result) {
      result = result.data
      let tags = []
      result.forEach(function(item) {
        let tag = {
          tag: item.name,
        }
        if (item.commit) {
          tag.commit_id = item.commit.sha
        }
        tags.push(tag)
      })
      return tags
    })
  }

  createWebhook(projectInfo, options, repoName) {
    let self = this
    let hookUrl = `${utils.getWebHookUrl()}/${projectInfo.id}`
    if (options && options.only_gen_webhook) {
      return { status:200, hookData:{url:hookUrl}}
    }
    let data = {
      name: 'web', // Use 'web' for a webhook or use the name of a valid service
      active: true,
      events: self._formateEvent(options),
      config: {
        url: hookUrl,
        content_type: 'json',
        secret: gitHubConfig.webhook_secret
      }
    }
    return _request(self._getEndPoint(`/repos/${repoName}/hooks`), {
      method: 'POST',
      contentType: 'json',
      headers: {
        'Authorization': 'token ' + self.access_token
      },
      data
    }).then(function (result) {
      var data = {}
      data.status = 200
      data.hook_id = result.data.id
      data.hookData = {
        url: result.data.config.url
      }
      return data
    }).catch(function(err) {
      logger.error("createwebhook", JSON.stringify(err))
      return { status : 500, message: err, hookData: {url: hookUrl}}
    })
  }

  getOneWebhook(projectInfo) {
    let imageName = projectInfo.repo_full_name
    let self = this
    return _request(this._getEndPoint(`/repos/${imageName}/hooks/${projectInfo.webhook_id}`), {
      headers: {
        'Authorization': 'token ' + self.access_token
      }
    }).then(function(result) {
      return { hook_url: result.data.config.url, hook_id: result.data.id }
    }).catch(function() {
      return { hook_url: '', hook_id: '' }
    })
  }

  _updateWebHook(projectInfo, options) {
    let self = this
    let imageName = projectInfo.repo_full_name
    let hookUrl = `${config.url}${config.webhook_endpoint}/${projectInfo.id}`
    return _request(this._getEndPoint(`/repos/${imageName}/hooks/${projectInfo.webhook_id}`), {
      method: 'PATCH',
      headers: {
        'Authorization': 'token ' + self.access_token
      },
      data: {
        active: true,
        events: self._formateEvent(options)
      }
    }).then(function (result) {
      return { hook_url: hookUrl, hook_id: projectInfo.webhook_id }
    })
  }

  removeWebhook(projectId, hook_id, repoName) {
    var self = this
    return _request(this._getEndPoint(`/repos/${repoName}/hooks/${hook_id}`),{
      method: 'DELETE',
      contentType: 'json',
      headers: {
        'Authorization': 'token ' + self.access_token
      }
    }).then(function (result) {
      return { message: result.data }
    }).catch(function (error) {
      return { status: 500, message: JSON.stringify(error) }
    })
  }

  getAuthRedirectUrl(state) {
    return {
      url: `${gitHubConfig.gitHubLoginUrl}/authorize?client_id=${gitHubConfig.clientId}&redirect_uri=${gitHubConfig.redirectUrl}&state=${state}&scope=repo, user:email`,
      state
    }
  }

  checkSignature(headers, body) {
    const method = 'checkSignature'
    let signatureHeader = headers['x-hub-signature']
    let signature
    if (signatureHeader) {
      let keys = signatureHeader.split('=')
      if (keys[0] == gitHubConfig.algorithm) {
        signature = keys[1]
      }
    }
    return new Promise(function (resovel, reject) {
      if (!signature) {
        logger.error(method, '(1)Invalid signature in request header!')
        return resovel(false)
      }
      let hmac = crypto.createHmac(gitHubConfig.algorithm, gitHubConfig.webhook_secret)
      hmac.setEncoding('hex')
      hmac.end(JSON.stringify(body), 'utf8', function () {
        let hash = hmac.read()
        if (hash != signature) {
          logger.error(method, '(2)Invalid signature in request header!')
          return resovel(false)
        }
        return resovel(true)
      })
    })
  }

  addDeployKey(projectId, publicKey, repoName) {
    const endPoint = `/repos/${repoName}/keys`
    let self = this
    return _request(this._getEndPoint(endPoint), {
      method: 'POST',
      contentType: 'json',
      headers: {
        'Authorization': 'token ' + self.access_token
      },
      data: {
        title: 'devops@tenxcloud.com',
        key: publicKey,
        read_only: true
      }
    }).then(function (result) {
      if (result.status >= 400) {
        return { status: result.status, error: JSON.stringify(result) }
      }
      return { status: 200, id: result.data.id}
    }).catch(function (error) {
      return { status: 500, message: JSON.stringify(error) }
    })
  }

  removeDeployKey(project_id, key_id, repoName) {
    var self = this
    return _request(this._getEndPoint(`/repos/${repoName}/keys/${key_id}`), {
      method: 'DELETE',
      contentType: 'json',
      headers: {
        'Authorization': 'token ' + self.access_token
      }
    }).then(function (result) {
      return { message: result.data }
    }).catch(function (error) {
      return { status: 500, message: JSON.stringify(error) }
    })
  }

  _formateRepo(repo) {
    let self = this
    return {
      name: repo.full_name,
      private: repo.private,
      url: repo.html_url,
      ssh_url: repo.ssh_url,
      clone_url: repo.clone_url,
      description: repo.description,
      owner: self._formateOwner(repo.owner),
      projectId: repo.id
    }
  }

  _formateOwner(owner) {
    if(owner) {
      return {
        name: owner.login,
        username: owner.login,
        id: owner.id,
        state: 'active',
        avatar_url: owner.avatar_url,
        web_url: owner.html_url
      }
    }
    return ''
  }

  _formateEvent(options) {
    let event = []
    if (options.push_events) {
      event.push('push')
    }
    if (options.tag_push_events) {
      event.push('create')
    }
    if (options.tag_push_events) {
      event.push('pull_request')
    }
    return event
  }

  _getTotalPage(link) {
    let match = link.match(/per_page=\d+&page=\d+>; rel="last"/)
    if(match) {
      let totalPage = match[0].match(/\d+>/)
      if(totalPage) {
        return parseInt(totalPage)
      }
      return 0
    }
    return 0
  }
}

module.exports = GitHubAPIs
