/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-28
 * @author Zhangpc
 * @Modify YangYuBiao
 *
 */

/**
 * Tools for format log
 */
'use strict'

process.on('message', (data, isHtml) => {
  const logFormat = new LogFormatter()
  logFormat.formatLog(data, isHtml)
})

const moment   = require('moment')
const async    = require('async')
const logger = require('../../utils/logger').getLogger("logFormatter")

const LogFormatter = function() {
  this.remainingMessage = ''
  //Return formatted log
  this.buildLogs = ''
  this.lastEscapeLine = ''

  // Filter out the messages below for now
  // TODO: make it better as it may filter out user message
  this.regexFilter = [];
  this.regexFilter.push(/\w+: Pulling image .*/);
  this.regexFilter.push(/\w+: Pushing .*/);
  this.regexFilter.push(/\w+: Downloading .*/);
  this.regexFilter.push(/\w+: Buffering to disk */);
  this.regexFilter.push(/\w+: Extracting */);
  this.regexFilter.push(/.*Sending build context to Docker daemon .*/);
};

/*
Format the docker build log
*/
LogFormatter.prototype.formatLog = function (data, isHtml) {
  var method = 'formatLog';
  // Disable format for high performance
  if (process.env.DISABLE_LOG_FORMAT) {
    return data.toString()
  }
  this.buildLogs = '';
  if (data != null && data.length > 0) {
    // Do some customization for the logger
    var message = this.remainingMessage + data.toString();
    while (message.indexOf('\r') != - 1)  message = message.replace('\r', '\n');
    var lines = message.split('\n');
    var endsWith = message.match('\\n$') == '\n';

    if (!endsWith) {
      // Leave the remaining message for the next write
      this.remainingMessage = lines[lines.length - 1];
      lines.splice(lines.length - 1, 1);
    } else {
      this.remainingMessage = '';
    }
    var self = this;
    lines.forEach(function(line) {
      var bMatched = false;
      // Filter out console progress messages
      bMatched = (line.indexOf('\\033') >= 0 || line.indexOf('\\034') == 0 || line.indexOf('[') == 0);
      // Check if it's the last line to print the progress
      if (bMatched) {
        self.lastEscapeLine = line;
      } else {
        var log = self.lastEscapeLine.trim();
        if (log != '') {
           log = log.replace(/\033/g, '');
           log = log.replace(/\034/g, '');
           log = log.replace(/\[[0-9]{1,2}[A-Z]{1}/g, '');
           log = log.trim();
           if (log != '') {
             _formatDate(log, isHtml, function(err, logFormat){
               if(logFormat){
                 self.buildLogs += logFormat;
               }
             });
             // self.buildLogs += log;
           }
           self.lastEscapeLine = '';
        }
      }
      if (!bMatched && line.trim() != '') {
        // Add data time here for each line
        /*var result = false;
        self.regexFilter.forEach(function(regex) {
         result = result | regex.test(line);
        });
        if (!result && line.trim() != '') {*/
          // Any encoding here?
        _formatDate(line, isHtml, function(err, logFormat){
          if(logFormat){
            self.buildLogs += logFormat;
          }
        });
          // self.buildLogs += log;
        /*} else {
          //console.log("Skipping1: " + line);
        }*/
      } else {
        //console.log("Skipping2: " + line);
      }
    });
    process.send(self.buildLogs)
    process.exit(0)
  }
  // Don't show internal IP to the end user
}

var lastDate;
function _formatDate(logOrigin, isHtml, callback){
  if(!callback) {
    callback = function(){}
  }
  // format datetime
  var log = logOrigin;
  var datesReg = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}(Z|(\+\d{2}:\d{2}))\b/g;
  var dateReg = '';
  var matchDates = log.match(datesReg);
  // console.log('log:' + log);
  if (!matchDates || !matchDates.length || matchDates.length < 1) {
    if (!lastDate) {
      callback(null, log);
      return;
    }
    if(isHtml){
      log = '<font color="#ffc20e">[' + lastDate + ']</font> ' + log + '\n';
    } else {
      log = '[' + lastDate + '] ' + log + '\n';
    }
    callback(null, log);
    return;
  }
  async.each(matchDates, function (matchDate, callback) {
    var date = moment(matchDate).format("YYYY-MM-DD HH:mm:ss");
    lastDate = date;
    dateReg = new RegExp(matchDate.replace(/\+/g, '\\+'), 'g');
    log = log.replace(dateReg, '').trim();
    if(log === ''){
      callback();
    } else {
      if(isHtml){
        log = '<font color="#ffc20e">[' + date + ']</font> ' + log + '\n';
      } else {
        log = '[' + date + '] ' + log + '\n';
      }
      callback();
    }
  }, function (err) {
    if (err) {
      logOrigin  += '\n';
      callback(err, logOrigin);
      return;
    }
    callback(null, log);
  });
}

