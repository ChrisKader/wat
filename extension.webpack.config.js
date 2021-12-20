//@ts-check

'use strict';

const withDefaults = require('./shared.webpack.config');

module.exports = withDefaults({
	context: __dirname,
	entry: './src/extension.ts',
});