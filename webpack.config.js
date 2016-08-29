// Webpack config file
var webpack = require('webpack');

module.exports = {
  entry: {
    app: './assets/app/js/index.jsx'
  },
  output: {
    path: __dirname + '/assets',
    filename: '[name]-bundle.js'
  },
  module: {
    loaders: [{
      test: /\.jsx?$/,
      loader: 'babel-loader',
      exclude: /node_modules/,
      query: {
        presets: ['react', 'es2015']
      }
    }, {
      test: /\.css$/,
      loader: 'style-loader!css-loader'
    }]
  },
  plugins: [new webpack.OldWatchingPlugin()]
};
