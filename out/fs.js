"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realfs = void 0;
const fs = require("fs");
const graceful_fs_1 = require("graceful-fs");
const util_1 = require("util");
(() => {
    try {
        (0, graceful_fs_1.gracefulify)(fs);
    }
    catch (error) {
        console.error(`Error enabling graceful-fs: ${error}`);
    }
})();
exports.realfs = new class {
    get access() { return (0, util_1.promisify)(fs.access); }
    get stat() { return (0, util_1.promisify)(fs.stat); }
    get lstat() { return (0, util_1.promisify)(fs.lstat); }
    get utimes() { return (0, util_1.promisify)(fs.utimes); }
    get read() { return (0, util_1.promisify)(fs.read); }
    get readdir() { return (0, util_1.promisify)(fs.readdir); }
    ;
    get readFile() { return (0, util_1.promisify)(fs.readFile); }
    get write() { return (0, util_1.promisify)(fs.write); }
    get writeFile() { return (0, util_1.promisify)(fs.writeFile); }
    ;
    get appendFile() { return (0, util_1.promisify)(fs.appendFile); }
    get fdatasync() { return (0, util_1.promisify)(fs.fdatasync); }
    get truncate() { return (0, util_1.promisify)(fs.truncate); }
    get rename() { return (0, util_1.promisify)(fs.rename); }
    get copyFile() { return (0, util_1.promisify)(fs.copyFile); }
    get open() { return (0, util_1.promisify)(fs.open); }
    get close() { return (0, util_1.promisify)(fs.close); }
    get rm() { return (0, util_1.promisify)(fs.rm); }
    ;
    get symlink() { return (0, util_1.promisify)(fs.symlink); }
    get readlink() { return (0, util_1.promisify)(fs.readlink); }
    get chmod() { return (0, util_1.promisify)(fs.chmod); }
    get mkdir() { return (0, util_1.promisify)(fs.mkdir); }
    get unlink() { return (0, util_1.promisify)(fs.unlink); }
    get rmdir() { return (0, util_1.promisify)(fs.rmdir); }
    get realpath() { return (0, util_1.promisify)(fs.realpath); }
};

//# sourceMappingURL=../out/fs.js.map
