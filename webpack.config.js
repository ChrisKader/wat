//@ts-check

'use strict';

const path = require('path');
const copyPlugin = require("copy-webpack-plugin");
//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
	target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
	mode: 'development', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
	context: __dirname,
	entry: './src/main.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
	output: {
		// the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
		path: path.resolve(__dirname, 'dist'),
		filename: 'main.js',
		libraryTarget: 'commonjs2',
		devtoolModuleFilenameTemplate: "../[resource-path]",
	},
	externals: {
		vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
		// modules added here also need to be added in the .vscodeignore file
	},
	resolve: {
		// support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
		extensions: ['.ts', '.js']
	},
	plugins: [
		new copyPlugin({
			patterns: [
				{ from: "resources", to: "resources" },
			],
		}),
	],
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
						options: {
							compilerOptions: {
								"module": "es6" // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
							}
						}
					}
				]
			}
		]
	},
	devtool: 'source-map',
	infrastructureLogging: {
		level: "log", // enables logging required for problem matchers
	},
};
module.exports = [extensionConfig];