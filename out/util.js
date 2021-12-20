"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Versions = exports.PromiseSource = exports.Limiter = exports.splitInChunks = exports.pathEquals = exports.isDescendant = exports.detectUnicodeEncoding = exports.readBytes = exports.find = exports.uniqueFilter = exports.mkdirp = exports.groupBy = exports.uniqBy = exports.assign = exports.once = exports.eventToPromise = exports.debounceEvent = exports.onceEvent = exports.done = exports.anyEvent = exports.filterEvent = exports.mapEvent = exports.fireEvent = exports.EmptyDisposable = exports.combinedDisposable = exports.toDisposable = exports.dispose = exports.logTimestamp = exports.log = void 0;
const vscode_1 = require("vscode");
const path_1 = require("path");
const fs_1 = require("fs");
function log(...args) {
    console.log.apply(console, ['git:', ...args]);
}
exports.log = log;
function logTimestamp() {
    return `[${new Date().toISOString()}]`;
}
exports.logTimestamp = logTimestamp;
function dispose(disposables) {
    disposables.forEach(d => d.dispose());
    return [];
}
exports.dispose = dispose;
function toDisposable(dispose) {
    return { dispose };
}
exports.toDisposable = toDisposable;
function combinedDisposable(disposables) {
    return toDisposable(() => dispose(disposables));
}
exports.combinedDisposable = combinedDisposable;
exports.EmptyDisposable = toDisposable(() => null);
function fireEvent(event) {
    return (listener, thisArgs, disposables) => event(_ => listener.call(thisArgs), null, disposables);
}
exports.fireEvent = fireEvent;
function mapEvent(event, map) {
    return (listener, thisArgs, disposables) => event(i => listener.call(thisArgs, map(i)), null, disposables);
}
exports.mapEvent = mapEvent;
function filterEvent(event, filter) {
    return (listener, thisArgs, disposables) => event(e => filter(e) && listener.call(thisArgs, e), null, disposables);
}
exports.filterEvent = filterEvent;
function anyEvent(...events) {
    return (listener, thisArgs, disposables) => {
        const result = combinedDisposable(events.map(event => event(i => listener.call(thisArgs, i))));
        if (disposables) {
            disposables.push(result);
        }
        return result;
    };
}
exports.anyEvent = anyEvent;
function done(promise) {
    return promise.then(() => undefined);
}
exports.done = done;
function onceEvent(event) {
    return (listener, thisArgs, disposables) => {
        const result = event(e => {
            result.dispose();
            return listener.call(thisArgs, e);
        }, null, disposables);
        return result;
    };
}
exports.onceEvent = onceEvent;
function debounceEvent(event, delay) {
    return (listener, thisArgs, disposables) => {
        let timer;
        return event(e => {
            clearTimeout(timer);
            timer = setTimeout(() => listener.call(thisArgs, e), delay);
        }, null, disposables);
    };
}
exports.debounceEvent = debounceEvent;
function eventToPromise(event) {
    return new Promise(c => onceEvent(event)(c));
}
exports.eventToPromise = eventToPromise;
function once(fn) {
    let didRun = false;
    return (...args) => {
        if (didRun) {
            return;
        }
        return fn(...args);
    };
}
exports.once = once;
function assign(destination, ...sources) {
    for (const source of sources) {
        Object.keys(source).forEach(key => destination[key] = source[key]);
    }
    return destination;
}
exports.assign = assign;
function uniqBy(arr, fn) {
    const seen = Object.create(null);
    return arr.filter(el => {
        const key = fn(el);
        if (seen[key]) {
            return false;
        }
        seen[key] = true;
        return true;
    });
}
exports.uniqBy = uniqBy;
function groupBy(arr, fn) {
    return arr.reduce((result, el) => {
        const key = fn(el);
        result[key] = [...(result[key] || []), el];
        return result;
    }, Object.create(null));
}
exports.groupBy = groupBy;
async function mkdirp(path, mode) {
    const mkdir = async () => {
        try {
            await fs_1.promises.mkdir(path, mode);
        }
        catch (err) {
            if (err.code === 'EEXIST') {
                const stat = await fs_1.promises.stat(path);
                if (stat.isDirectory()) {
                    return;
                }
                throw new Error(`'${path}' exists and is not a directory.`);
            }
            throw err;
        }
    };
    // is root?
    if (path === (0, path_1.dirname)(path)) {
        return true;
    }
    try {
        await mkdir();
    }
    catch (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
        await mkdirp((0, path_1.dirname)(path), mode);
        await mkdir();
    }
    return true;
}
exports.mkdirp = mkdirp;
function uniqueFilter(keyFn) {
    const seen = Object.create(null);
    return element => {
        const key = keyFn(element);
        if (seen[key]) {
            return false;
        }
        seen[key] = true;
        return true;
    };
}
exports.uniqueFilter = uniqueFilter;
function find(array, fn) {
    let result = undefined;
    array.some(e => {
        if (fn(e)) {
            result = e;
            return true;
        }
        return false;
    });
    return result;
}
exports.find = find;
function readBytes(stream, bytes) {
    return new Promise((complete, error) => {
        let done = false;
        let buffer = Buffer.allocUnsafe(bytes);
        let bytesRead = 0;
        stream.on('data', (data) => {
            let bytesToRead = Math.min(bytes - bytesRead, data.length);
            data.copy(buffer, bytesRead, 0, bytesToRead);
            bytesRead += bytesToRead;
            if (bytesRead === bytes) {
                stream.destroy(); // Will trigger the close event eventually
            }
        });
        stream.on('error', (e) => {
            if (!done) {
                done = true;
                error(e);
            }
        });
        stream.on('close', () => {
            if (!done) {
                done = true;
                complete(buffer.slice(0, bytesRead));
            }
        });
    });
}
exports.readBytes = readBytes;
function detectUnicodeEncoding(buffer) {
    if (buffer.length < 2) {
        return null;
    }
    const b0 = buffer.readUInt8(0);
    const b1 = buffer.readUInt8(1);
    if (b0 === 0xFE && b1 === 0xFF) {
        return "utf16be" /* UTF16be */;
    }
    if (b0 === 0xFF && b1 === 0xFE) {
        return "utf16le" /* UTF16le */;
    }
    if (buffer.length < 3) {
        return null;
    }
    const b2 = buffer.readUInt8(2);
    if (b0 === 0xEF && b1 === 0xBB && b2 === 0xBF) {
        return "utf8" /* UTF8 */;
    }
    return null;
}
exports.detectUnicodeEncoding = detectUnicodeEncoding;
function isWindowsPath(path) {
    return /^[a-zA-Z]:\\/.test(path);
}
function isDescendant(parent, descendant) {
    if (parent === descendant) {
        return true;
    }
    if (parent.charAt(parent.length - 1) !== path_1.sep) {
        parent += path_1.sep;
    }
    // Windows is case insensitive
    if (isWindowsPath(parent)) {
        parent = parent.toLowerCase();
        descendant = descendant.toLowerCase();
    }
    return descendant.startsWith(parent);
}
exports.isDescendant = isDescendant;
function pathEquals(a, b) {
    // Windows is case insensitive
    if (isWindowsPath(a)) {
        a = a.toLowerCase();
        b = b.toLowerCase();
    }
    return a === b;
}
exports.pathEquals = pathEquals;
function* splitInChunks(array, maxChunkLength) {
    let current = [];
    let length = 0;
    for (const value of array) {
        let newLength = length + value.length;
        if (newLength > maxChunkLength && current.length > 0) {
            yield current;
            current = [];
            newLength = value.length;
        }
        current.push(value);
        length = newLength;
    }
    if (current.length > 0) {
        yield current;
    }
}
exports.splitInChunks = splitInChunks;
class Limiter {
    constructor(maxDegreeOfParalellism) {
        this.maxDegreeOfParalellism = maxDegreeOfParalellism;
        this.outstandingPromises = [];
        this.runningPromises = 0;
    }
    queue(factory) {
        return new Promise((c, e) => {
            this.outstandingPromises.push({ factory, c, e });
            this.consume();
        });
    }
    consume() {
        while (this.outstandingPromises.length && this.runningPromises < this.maxDegreeOfParalellism) {
            const iLimitedTask = this.outstandingPromises.shift();
            this.runningPromises++;
            const promise = iLimitedTask.factory();
            promise.then(iLimitedTask.c, iLimitedTask.e);
            promise.then(() => this.consumed(), () => this.consumed());
        }
    }
    consumed() {
        this.runningPromises--;
        if (this.outstandingPromises.length > 0) {
            this.consume();
        }
    }
}
exports.Limiter = Limiter;
class PromiseSource {
    constructor() {
        this._onDidComplete = new vscode_1.EventEmitter();
    }
    get promise() {
        if (this._promise) {
            return this._promise;
        }
        return eventToPromise(this._onDidComplete.event).then(completion => {
            if (completion.success) {
                return completion.value;
            }
            else {
                throw completion.err;
            }
        });
    }
    resolve(value) {
        if (!this._promise) {
            this._promise = Promise.resolve(value);
            this._onDidComplete.fire({ success: true, value });
        }
    }
    reject(err) {
        if (!this._promise) {
            this._promise = Promise.reject(err);
            this._onDidComplete.fire({ success: false, err });
        }
    }
}
exports.PromiseSource = PromiseSource;
var Versions;
(function (Versions) {
    function compare(v1, v2) {
        if (typeof v1 === 'string') {
            v1 = fromString(v1);
        }
        if (typeof v2 === 'string') {
            v2 = fromString(v2);
        }
        if (v1.major > v2.major) {
            return 1;
        }
        if (v1.major < v2.major) {
            return -1;
        }
        if (v1.minor > v2.minor) {
            return 1;
        }
        if (v1.minor < v2.minor) {
            return -1;
        }
        if (v1.patch > v2.patch) {
            return 1;
        }
        if (v1.patch < v2.patch) {
            return -1;
        }
        if (v1.pre === undefined && v2.pre !== undefined) {
            return 1;
        }
        if (v1.pre !== undefined && v2.pre === undefined) {
            return -1;
        }
        if (v1.pre !== undefined && v2.pre !== undefined) {
            return v1.pre.localeCompare(v2.pre);
        }
        return 0;
    }
    Versions.compare = compare;
    function from(major, minor, patch, pre) {
        return {
            major: typeof major === 'string' ? parseInt(major, 10) : major,
            minor: typeof minor === 'string' ? parseInt(minor, 10) : minor,
            patch: patch === undefined || patch === null ? 0 : typeof patch === 'string' ? parseInt(patch, 10) : patch,
            pre: pre,
        };
    }
    Versions.from = from;
    function fromString(version) {
        const [ver, pre] = version.split('-');
        const [major, minor, patch] = ver.split('.');
        return from(major, minor, patch, pre);
    }
    Versions.fromString = fromString;
})(Versions = exports.Versions || (exports.Versions = {}));

//# sourceMappingURL=../out/util.js.map
