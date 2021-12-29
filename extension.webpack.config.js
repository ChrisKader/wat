//@ts-check

'use strict';

//const withDefaults = require('./shared.webpack.config');
//const CopyWebpackPlugin = require("copy-webpack-plugin");

'use strict';

const withDefaults = require('./shared.webpack.config');
const copyPlugin = require("copy-webpack-plugin");
const path = require('path');
module.exports = withDefaults({
	mode: 'development',
	target: 'node',
	entry: './src/main.ts',

	node: {
		__dirname: true // leave the __dirname-behaviour intact
	},
	context: __dirname,
	resolve: {
		mainFields: ['module', 'main'],
		extensions: ['.ts', '.js'] // support ts-files and js-files
	},
	output: {
		// the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
		path: path.resolve(__dirname, 'dist'),
		filename: 'main.js',
		libraryTarget: 'commonjs2',
		devtoolModuleFilenameTemplate: "../[resource-path]",
	},
	module: {
		rules: [{
			test: /\.ts$/,
			exclude: /node_modules/,
			use: [{
				// configure TypeScript loader:
				// * enable sources maps for end-to-end source maps
				loader: 'ts-loader',
				options: {
					compilerOptions: {
						'sourceMap': true,
						//"module": "es6" // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
					}
				}
			}]
		}]
	},
	// yes, really source maps
	devtool: 'source-map',
	plugins: [
		new copyPlugin({
			patterns: [
				{ from: "resources", to: "resources" },
			],
		}),
	],
});
