/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-18
 * @author Zhangpc
 *
 */

/**
 * API for gitlab
 */
'use strict'

const _request = require('./_request')('Gitlab')
const logger = require('../../../utils/logger').getLogger('coderepo/gitlab')
const utils = require('../../../utils')
const config = require('../../../configs')
const DEFAULT_PAGE_SIZE = 50
const uuid = require('node-uuid')
const KEY_TITLE = 'devops@tenxcloud.com'
const Promise = require('bluebird') // For webpack build backend files

class Gitlab {
  constructor(repoInfo) {
    if (!repoInfo || !repoInfo.gitlab_url || !repoInfo.access_token) {
      const error = new Error('Parameter error')
      error.message = 'url and access_token are required.'
      error.status = 400
      throw error
    }
    if (repoInfo.gitlab_url.indexOf('/api/v3') < 0) {
      repoInfo.gitlab_url += '/api/v3'
    }
    this.url = repoInfo.gitlab_url
    this.access_token = repoInfo.access_token
  }

  getUserAndOrgs() {
    return this.getUserInfo().then((result) => [result])
  }

  // Gets currently authenticated user.
  getUserInfo() {
    const self = this
    let url = this._getUrl('/user')
    return _request(url).then((result) => self._formatUser(result.data))
  }

  // Get a list of users.
  getAllUsers() {
    const self = this
    let url = this._getUrl('/users')
    return _request('/users').then((results) => {
      return results.data.map((user) => self._formatUser(user))
    })
  }

  getAllUsersRepos(usersInfo) {
    const self = this
    let promiseArray = []
    usersInfo.forEach((user) => {
      //TODO: support admin user
      /*if (user.isadmin) {
        promiseArray.push(self.getUserAllrepos())
      } else {*/
      promiseArray.push(self.getUserRepos())
      //}
    })
    //TODO: support admin user account and organization
    return Promise.all(promiseArray).then((results) => {
      let reposObj = {}
      /*results.map((repos, index) => {
        let userName = usersInfo[index].login
        reposObj[userName] = repos
      })*/
      // TODO: Show user/org repositories
      return results[0]//repos
    })
  }

  // Get a list of projects accessible by the authenticated user.
  getUserRepos(page, pageSize) {
    const self = this
    return this._createAllRequestForRepo('/projects')
  }

  // Get a list of all GitLab projects (admin only).
  getUserAllrepos(page, pageSize) {
    const self = this
    return this._createAllRequestForRepo('/projects/all')
  }

  // Get a list of projects which are owned by the authenticated user.
  getUserOwnRepo() {
    const self = this
    let url = this._getUrl('/projects/owned')
    return _request(url).then((results) => {
      return results.data.map((repo) => self._formatRepo(repo))
    })
  }

  getRepoAllBranches(repoFullName, repoId) {
    const self = this
    const endpoint = `/projects/${repoId}/repository/branches`
    let url = this._getUrl(endpoint)
    return _request(url).then(function (results) {
      return results.data.map((branch) => self._formatBranch(branch))
    })
  }

  getRepoAllTags(repoFullName, repoId) {
    const endpoint = `/projects/${repoId}/repository/tags`
    let url = this._getUrl(endpoint)
    return _request(url).then(results => {
      return results.data.map((tag) => this._formatTag(tag))
    })
  }

  // Get a specific hook for a project.
  getOneWebhook(projectInfo) {
    const self = this
    const endpoint = `/projects/${projectInfo.gitlab_project_id}/hooks/${projectInfo.webhook_id}`
    let url = this._getUrl(endpoint)
    return _request(url).then(function(result) {
      return self._fomateWebhook(result.data)
    }).catch(function(err) {
      return { hook_url: '', hook_id: '' }
    })
  }

  getProjectWebhooks(projectInfo) {
    const self = this
    const endpoint = `/projects/${projectInfo.gitlab_project_id}/hooks`
    let url = this._getUrl(endpoint)
    return _request(url).then(function(result) {
      return result.data.map((hook) => self._fomateWebhook(hook))
    })
  }

  addDeployKey(gitlab_project_id, key) {
    const endpoint = `/projects/${gitlab_project_id}/keys`
    let url = this._getUrl(endpoint)
    return _request(url, {
      method: 'POST',
      data: {
        title: KEY_TITLE,
        key: key
      }
    }).then(function(result) {
       if(result.status >= 400) {
         return { status : result.status, message: result.data}
       }
       return { status:200, id: result.data.id, message: 'success'}
    }).catch(function(error) {
      return { status:500, message: error }
    })
  }

  removeDeployKey(gitlab_project_id, key_id) {
    const endpoint = `/projects/${gitlab_project_id}/keys/${key_id}`
    let url = this._getUrl(endpoint)
    return _request(url, {
      method: 'DELETE'
    }).then(function(result) {
       if(result.status >= 400) {
         return { status : result.status, message: result.data}
       }
       return { status:200, id: result.data.id, message: 'success'}
    }).catch(function(error) {
      return { status:500, message: error }
    })
  }

  // Adds a hook to a specified project
  // projectInfo contains gitlab_project_id and id of this managed project
  createWebhook(projectInfo, options) {
    const self = this
    let endpoint = `/projects/${projectInfo.gitlab_project_id}/hooks`
    if (!options) {
      options = {
        push_events: true,
        tag_push_events: true
      }
    }
    let hookUrl = `${utils.getWebHookUrl()}/${projectInfo.id}`
    // let hookUrl = `http://192.168.0.37:8090/api/v2/devops/managed-projects/webhooks/${projectInfo.id}`
    if (options.only_gen_webhook) {
      return { status:200, hookData:{url:hookUrl}}
    }
    const reqOptions = {
      method: 'POST',
      data: {
        "id": projectInfo.gitlab_project_id,
        "url": hookUrl,
        "push_events": options.push_events || true,
        "tag_push_events": options.tag_push_events || true,
        "issues_events": false,
        "merge_requests_events": true,
        "note_events": false,
        "enable_ssl_verification": true,
        "created_at": new Date()
      }
    }
    let url = this._getUrl(endpoint)
    return _request(url, reqOptions).then(function(results) {
       if (results.status > 300) {
         return { status : result.status, message: result, hookData: {url: hookUrl}}
       }
       return { status: 200, hookData: reqOptions.data, hook_id: results.data.id }
    }).catch(function(err) {
      logger.error("createwebhook", JSON.stringify(err))
      return { status : 500, message: err, hookData: {url: hookUrl}}
    })
  }

  removeWebhook(gitlab_project_id, hook_id) {
    const endpoint = `/projects/${gitlab_project_id}/hooks/${hook_id}`
    let url = this._getUrl(endpoint)
    return _request(url, {
      method: 'DELETE'
    }).then(function(result) {
       if(result.status >= 400) {
         return { status : result.status, message: result.data}
       }
       return { status: 200, id: result.data.id, message: 'success'}
    }).catch(function(error) {
      return { status:500, message: error }
    })
  }

  _createAllRequestForRepo(endpoint) {
    const self = this
    const querys = {
      page: 1,
      page_size: DEFAULT_PAGE_SIZE
    }
    let url = this._getUrl(endpoint, querys)
    return _request(url).then((results) => {
      let totalPages = results.headers['x-total-pages']
      if (totalPages < 2) {
        return results.data.map((repo) => self._formatRepo(repo))
      }
      let promiseArray = []
      for (; totalPages > 1; totalPages --) {
        querys.page ++
        url = this._getUrl(endpoint, querys)
        promiseArray.push(_request(url))
      }
      return Promise.all(promiseArray).then((allResults) => {
        let repoList = []
        allResults.map((result) => {
          repoList = repoList.concat(result.data)
        })
        repoList = results.data.concat(repoList)
        return repoList.map((repo) => self._formatRepo(repo))
      })
    })
  }

  _getUrl(endpoint, querys) {
    let querysString = ''
    if (querys) {
      for (let q in querys) {
        if (querys.hasOwnProperty(q)) {
          querysString += `&${q}=${querys[q]}`
        }
      }
    }
    const reqUrl = `${this.url}${endpoint}?private_token=${this.access_token}${querysString}`
    return reqUrl
  }

  _formatUser(user) {
    return {
      login: user.username,
      type: 'user',
      id: user.id,
      url: this.url + '/' + user.username,
      avatar: user.avatar_url,
      email: user.email,
      isadmin: user.is_admin
    }
  }

  _formatRepo(repo) {
    let fomatRepo = {
      name: (repo.name_with_namespace).replace(/\s/g, ''),
      private: !repo.public,
      url: repo.web_url,
      ssh_url: repo.ssh_url_to_repo,
      clone_url: repo.http_url_to_repo,
      description: repo.description,
      owner: repo.owner,
      projectId: repo.id
    }
    if (!fomatRepo.owner) {
      if (repo.namespace) {
        fomatRepo.owner = {
          name: repo.namespace.name,
          id: repo.namespace.id,
          username: repo.namespace.name
        }
      } else {
        let ownerName = fomatRepo.name.split('/')[0]
        fomatRepo.owner = {
          name: ownerName,
          username: ownerName
        }
      }
    }
    // just for tenxcloud
    if (fomatRepo.clone_url.indexOf("tenxcloud") > -1) {
      fomatRepo.clone_url = fomatRepo.clone_url.replace(":8080", "");
    }
    return fomatRepo
  }

  _formatBranch(branch) {
    let formatBranch = {
      branch: branch.name
    }
    const commit = branch.commit
    if (commit) {
      formatBranch.commit_id = commit.id
      formatBranch.committer_name = commit.committer_name
      formatBranch.message = commit.message
      formatBranch.committed_date = commit.committed_date
    }
    return formatBranch
  }

  _formatTag(tag) {
    let formatBranch = {
      tag: tag.name,
      description: tag.message,
    }
    const commit = tag.commit
    if (commit) {
      formatBranch.commit_id = commit.id
      formatBranch.committer_name = commit.committer_name
      formatBranch.message = commit.message
      formatBranch.committed_date = commit.committed_date
    }
    return formatBranch
  }

  _fomateWebhook(hook) {
    let fomatHook = {
      "hook_id": hook.id,
      "hook_url": hook.url,
      "gitlab_project_id": hook.project_id,
      "push_events": hook.push_events,
      "tag_push_events": hook.push_events,
      "created_at": hook.created_at
    }
    return fomatHook
  }
}

module.exports = Gitlab