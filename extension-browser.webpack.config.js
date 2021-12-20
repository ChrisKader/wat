'use strict';

const path = require('path');
const withBrowserDefaults = require('./shared.webpack.config').browser;

module.exports = withBrowserDefaults({
	context: __dirname,
	node: false,
	entry: './src/extension.ts',
	resolve: {
		alias: {
			'node-fetch': path.resolve(__dirname, 'node_modules/node-fetch/browser.js'),
		}
	}
});