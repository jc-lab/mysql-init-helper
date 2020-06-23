const webpack = require('webpack');
const path = require('path');

module.exports = {
  target: 'node',
  entry: {
    main: './src/index.js'
  },
  output: {
    filename: 'bundle.js',
    path: process.env.BUNDLE_JS_DIR ? path.resolve(process.env.BUNDLE_JS_DIR) : path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2'
  },
  devtool: 'source-map',
  optimization: {
    minimize: false
  }
};
