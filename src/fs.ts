import * as fs from 'fs';
import { gracefulify } from 'graceful-fs';
import { promisify } from 'util';

(() => {
	try {
		gracefulify(fs);
	} catch (error) {
		console.error(`Error enabling graceful-fs: ${error}`);
	}
})();

export const realfs = new class {
	get access() { return promisify(fs.access); }

	get stat() { return promisify(fs.stat); }
	get lstat() { return promisify(fs.lstat); }
	get utimes() { return promisify(fs.utimes); }

	get read() { return promisify(fs.read); }
	get readdir() { return promisify(fs.readdir) };
	get readFile() { return promisify(fs.readFile); }

	get write() { return promisify(fs.write); }
	get writeFile() { return promisify(fs.writeFile) };
	get appendFile() { return promisify(fs.appendFile); }

	get fdatasync() { return promisify(fs.fdatasync); }
	get truncate() { return promisify(fs.truncate); }

	get rename() { return promisify(fs.rename); }
	get copyFile() { return promisify(fs.copyFile); }

	get open() { return promisify(fs.open); }
	get close() { return promisify(fs.close); }

	get rm() { return promisify(fs.rm) };
	get symlink() { return promisify(fs.symlink); }
	get readlink() { return promisify(fs.readlink); }

	get chmod() { return promisify(fs.chmod); }

	get mkdir() { return promisify(fs.mkdir); }

	get unlink() { return promisify(fs.unlink); }
	get rmdir() { return promisify(fs.rmdir); }

	get realpath() { return promisify(fs.realpath); }
}