const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const plugins = [
    new webpack.DefinePlugin({
        'process.env': {
            NODE_ENV: JSON.stringify(nodeEnv)
        }
    }),
    new HtmlWebpackPlugin({
        title: 'Typescript Webpack Starter',
        template: '!!ejs-loader!demo/index.html'
    }),
    new webpack.LoaderOptionsPlugin({
        options: {
            tslint: {
                emitErrors: true,
                failOnHint: true
            }
        }
    })
];
const libraryName = 'HJPlayer';
const config = {
    devtool: isProd ? 'hidden-source-map' : 'source-map',
    context: path.resolve('./src'),
    entry: {
        hjplayer: './index.ts'
    },
    output: {
        path: path.resolve('./dist'),
        filename: '[name].js',
        chunkFilename: '[name].min.js',
        library: libraryName,
        libraryTarget: 'umd',
        umdNamedDefine: true,
        globalObject: 'this',
        libraryExport: 'default',
    },
    module: {
        rules: [
            {
                enforce: 'pre',
                test: /\.tsx?$/,
                exclude: [/\/node_modules\//],
                use: ['awesome-typescript-loader', 'source-map-loader']
            },
            {
                test: /\.ts|.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                        plugins: [require('@babel/plugin-transform-object-assign')]
                    }
                }
            },
            { test: /\.html$/, loader: 'html-loader' },
            { test: /\.css$/, loaders: ['style-loader', 'css-loader'] }
        ].filter(Boolean)
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    plugins,
    devServer: {
        contentBase: path.join(__dirname, 'demo/'),
        compress: true,
        port: 3000,
        hot: true
    }
};

module.exports = config;
