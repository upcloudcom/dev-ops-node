/**
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2017 TenxCloud. All Rights Reserved.
 */
/* App webpack backend config
 *
 * v0.1 - 2017-01-13
 * @author Zhangpc
 */
var webpack = require('webpack')
var path = require('path')
var fs = require('fs')
var nodeModules = {}
var env = process.env

fs.readdirSync('node_modules').filter(function (x) {
  return ['.bin'].indexOf(x) === -1
}).forEach(function (mod) {
  nodeModules[mod] = 'commonjs ' + mod
})
module.exports = {
  // devtool: 'source-map',
  entry: [
    './app.js'
  ],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'app.js'
  },
  target: 'node',
  externals: nodeModules,
  context: __dirname,
  node: {
    __filename: false,
    __dirname: false
  },
  module: {
    loaders: [{
      test: /\.js$/,
      loader: 'babel-loader',
      exclude: [
        path.resolve(__dirname, 'node_modules'),
      ],
      query: {
        plugins: ['transform-runtime'],
        presets: ['es2015', 'stage-0'],
      },
    }, {
      test: /\.json$/,
      loader: 'json-loader'
    }]
  },
  resolve: {
    extensions: ['', '.js', '.json']
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV),
      'process.env.RUNNING_MODE': JSON.stringify(env.RUNNING_MODE),
    }),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    }),
  ]
}