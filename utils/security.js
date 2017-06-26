/*
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 * v0.1 - 2016-04-12
 * @author Zhangpc
 *
 */

/**
 * Security tools
 */
'use strict'

const logger = require('../utils/logger').getLogger('security')
const pem = require('pem')
const keygen = require('ssh-keygen')
const location = __dirname + '/temp_foo_rsa'
const COMMENT = 'builder@tenxcloud.com'
const PASSWORD = false // false and undefined will convert to an empty pw
const crypto = require('crypto')
const SECRET_KEY = 'dazyunsecretkeysforuserstenx20141019generatedKey'
const ENCODING = 'hex'
const Promise = require('bluebird') // For webpack build backend files

exports.generateKeys = function () {
  const method = 'generateKeys'
  const createPrivateKey = Promise.promisify(pem.createPrivateKey)
  const getPublicKey = Promise.promisify(pem.getPublicKey)
  const keyPairs = {}
  return createPrivateKey().then(function(priKey) {
    keyPairs.privateKey = priKey.key
    return getPublicKey(priKey.key)
  }).then(function (pubKey) {
    keyPairs.publicKey = pubKey.publicKey
    return keyPairs
  }).catch(function (error) {
    logger.error(error)
    const err = new Error('pem generate private/public key pairs failed.')
    err.status = 500
    throw err
  })
}

exports.generateRsaKeys = function(option, callback) {
  const method = 'generateRsaKeys'
  if (!option){
    option = {
      comment: COMMENT,
      password: PASSWORD
    }
  }
  const keygenPromise = Promise.promisify(keygen)
  return keygenPromise({
    location: location,
    comment: option.comment,
    password: option.password,
    read: true
  }).then(function (keyPairs) {
    return {
      privateKey: keyPairs.key,
      publicKey: keyPairs.pubKey
    }
  }).catch(function (error) {
    logger.error(error)
    const err = new Error('keygen generate ssh-rsa private/public key pairs failed.')
    err.status = 500
    throw err
  })
}

// Asymmetric Encryption£ºEncrypt the content beofore transfer or persist
// But we can still decrypt the content if we have the secret key, so that's two way encryption
exports.encryptContent = function (content) {
  if (content !=='' && !content) {
    return content
  }
  const cipher = crypto.createCipher('des-ede3-cbc', SECRET_KEY)
  let cryptedContent = cipher.update(content, 'utf8', ENCODING)
  cryptedContent += cipher.final(ENCODING)

  return cryptedContent
}

exports.decryptContent = function (cryptedContent) {
  if (!cryptedContent) {
    return cryptedContent
  }
  const decipher = crypto.createDecipher('des-ede3-cbc', SECRET_KEY)
  let decryptedContent = decipher.update(cryptedContent, ENCODING, 'utf8')
  decryptedContent += decipher.final('utf8')

  return decryptedContent
}

// One-way encryption: used to encrypt user password that should not be decrypted
// MD5 algorithm
exports.encryptPassword = function (password) {
  password = password.toLowerCase().trim()
  const hash = crypto.createHash("md5")
  hash.update(password)
  return hash.digest("hex")
}

exports.decRegistryPassword = function (cryptedContent, privateKey) {
  const method = 'decryptContent'
  let algorithm = 'aes-256-ctr'
  if (!privateKey) {
    privateKey = SECRET_KEY
  }
  try {
    const decipher = crypto.createDecipher(algorithm, privateKey)
    let decryptedContent = decipher.update(cryptedContent, 'hex', 'utf8')
    decryptedContent += decipher.final('utf8')
    return decryptedContent
  } catch(err) {
    logger.error(method, JSON.stringify(err))
    return null
  }
}