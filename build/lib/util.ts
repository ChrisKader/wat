/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as _filter from 'gulp-filter';
import * as _ from 'underscore';
import * as path from 'path';
import * as fs from 'fs';
import * as _rimraf from 'rimraf';

const root = path.dirname(path.dirname(__dirname));

export function rimraf(dir: string): () => Promise<void> {
	const result = () => new Promise<void>((c, e) => {
		let retries = 0;

		const retry = () => {
			_rimraf(dir, { maxBusyTries: 1 }, (err: any) => {
				if (!err) {
					return c();
				}

				if (err.code === 'ENOTEMPTY' && ++retries < 5) {
					return setTimeout(() => retry(), 10);
				}

				return e(err);
			});
		};

		retry();
	});

	result.taskName = `clean-${path.basename(dir).toLowerCase()}`;
	return result;
}

function _rreaddir(dirPath: string, prepend: string, result: string[]): void {
	const entries = fs.readdirSync(dirPath, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) {
			_rreaddir(path.join(dirPath, entry.name), `${prepend}/${entry.name}`, result);
		} else {
			result.push(`${prepend}/${entry.name}`);
		}
	}
}

export function rreddir(dirPath: string): string[] {
	let result: string[] = [];
	_rreaddir(dirPath, '', result);
	return result;
}

export function ensureDir(dirPath: string): void {
	if (fs.existsSync(dirPath)) {
		return;
	}
	ensureDir(path.dirname(dirPath));
	fs.mkdirSync(dirPath);
}
