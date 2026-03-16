const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/index.tsx',
  target: 'web',
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: 'bundle.js',
    publicPath: './',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
    alias: {
      'react-native$': 'react-native-web',
      'react-native-web$': 'react-native-web',
      // Add aliases for React Native modules
      '@react-native-async-storage/async-storage': '@react-native-async-storage/async-storage',
      '@react-native-community/netinfo': '@react-native-community/netinfo',
      'react-native-vector-icons': 'react-native-vector-icons/dist',
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(js|jsx)$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/,
        type: 'asset/resource',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    }),
  ],
  externals: {
    // Exclude native modules that don't work in web
    'react-native-device-crypto': 'commonjs react-native-device-crypto',
    'react-native-fast-tflite': 'commonjs react-native-fast-tflite',
    'react-native-mlkit-ocr': 'commonjs react-native-mlkit-ocr',
    'react-native-photos-framework': 'commonjs react-native-photos-framework',
    'react-native-voice': 'commonjs react-native-voice',
    'react-native-video': 'commonjs react-native-video',
    'react-native-zip-archive': 'commonjs react-native-zip-archive',
  },
};
