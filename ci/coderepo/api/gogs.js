/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2017 TenxCloud. All Rights Reserved.
 * v0.1 - 2017-03-31
 * @author Lei
 *
 */

/**
 * API for gogs
 * Reference API doc: https://github.com/gogits/go-gogs-client/wiki
 */

'use strict'

const _request = require('./_request')('Gogs')
const logger = require('../../../utils/logger').getLogger('coderepo/gogs')
const utils = require('../../../utils')
const DEFAULT_PAGE_SIZE = 50
const uuid = require('node-uuid')
const KEY_TITLE = 'devops@tenxcloud.com'
const Promise = require('bluebird') // For webpack build backend files
const crypto = require('crypto')
const getRandomString = require('../../../utils/utilities').getRandomString

const algorithm = 'sha256'
const HOOK_SECRET = 'TenxCloud_GOGS_SECRET_KEY'

class Gogs {
  constructor(repoInfo) {
    if (!repoInfo || !repoInfo.gitlab_url || !repoInfo.access_token) {
      logger.warn('No gogs url or access_token')
    } else {
      if (repoInfo.gitlab_url.indexOf('/api/v1') < 0) {
        repoInfo.gitlab_url += '/api/v1'
      }
      this.url = repoInfo.gitlab_url
      this.access_token = repoInfo.access_token
    }
  }

  _getEndPoint(endpoint, page) {
    return `${this.url}${endpoint}${page ? '?per_page=50&page=' + page : ''}`
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
        avatar: result.avatar_url,
        email: result.email
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
          login: item.username,
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
        // Don't list repositories under orgs separately for now
        reqUrl = `/orgs/${item.login}/repos`
        return
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
      result.forEach(function (item) {
        let branch = {
          branch: item.name,
        }
        const commit = item.commit
        if (commit) {
          branch.commit_id = commit.id
          branch.committer_name = commit.committer.name
          branch.message = commit.message
          branch.committed_date = commit.committed_date
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
    return tags
    // api not support yet
    return _request(self._getEndPoint(reqUrl, 1), {
      contentType: 'json',
      headers: {
        'Authorization': 'token ' + self.access_token
      },
      dataType: 'json'
    }).then(function (result) {
      result = result.data
      result.forEach(function (item) {
        let tag = {
          tag: item.name,
        }
        const commit = item.commit
        if (commit) {
          tag.commit_id = commit.id
          tag.committer_name = commit.committer.name
          tag.message = commit.message
          tag.committed_date = commit.committed_date
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
      type: 'gogs', // Required The type of webhook, either gogs or slack
      active: true,
      events: self._formateEvent(options),
      config: {
        url: hookUrl,
        content_type: 'json',
        secret: HOOK_SECRET // Don't support for now
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
    let hookUrl = `${utils.getWebHookUrl()}/${projectInfo.id}`
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
        title: 'devops@tenxcloud.com' + '-' + getRandomString(5),
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

  checkSignature(headers, body) {
    const method = 'checkSignature'
    let signatureHeader = headers['x-gogs-signature']
    return new Promise(function (resolve, reject) {
      if (!signatureHeader) {
        logger.error(method, '(1)Invalid signature in request header!')
        return resolve(false)
      }
      var buf = new Buffer('abcd')
      let hmac = crypto.createHmac(algorithm, buf)
      hmac.setEncoding('hex')
      hmac.end(JSON.stringify(body), 'utf8', function () {
        let hash = hmac.read()
        // Disable the check for now
        // TODO: make it consistent
        /*if (hash != signatureHeader) {
          logger.error(method, '(2)Invalid signature in request header!')
          return resolve(false)
        }*/
        return resolve(true)
      })
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
    if (options.release_events) {
      event.push('release')
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

module.exports = Gogs