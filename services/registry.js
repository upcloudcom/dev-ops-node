/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-05-07
 * @author Zhangpc
 * 
 */

/**
 * Service for harbor/registry API
 */
'use strict'

const logger = require('../utils/logger').getLogger('service/registry')

// TODO: If we need this, we should get the tag from harbor API later
exports.getTagFromEventsUrl = function (userName, imageName, eventUrl) {
  const method = 'getTagFromEventsUrl'
  return []
}
