"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatFileSystemProvider = void 0;
const vscode_1 = require("vscode");
const util_1 = require("./util");
const THREE_MINUTES = 1000 * 60 * 3;
const FIVE_MINUTES = 1000 * 60 * 5;
class WatFileSystemProvider {
    constructor(model) {
        this.model = model;
        this._onDidChangeFile = new vscode_1.EventEmitter();
        this.onDidChangeFile = this._onDidChangeFile.event;
        this.changedTocRoots = new Set();
        this.cache = new Map();
        this.mtime = new Date().getTime();
        this.disposables = [];
        this.disposables.push(
        //model.onDidOpenTocFile(this.onDidOpenTocFile, this),
        //model.onDidChangeOriginalResource(this.onDidChangeOriginalResource, this),
        vscode_1.workspace.registerFileSystemProvider('wat', this, { isReadonly: true, isCaseSensitive: true }));
        setInterval(() => this.cleanup(), FIVE_MINUTES);
    }
    /*     private onDidOpenTocFile({ toc }: TocChangeEvent): void {
            this.changedTocRoots.add(toc.tocFile.addonFolder.fsPath);
            this.eventuallyFireChangeEvents();
        }
     */
    /* 	private eventuallyFireChangeEvents(): void {
            this.fireChangeEvents();
        } */
    /* 	private async fireChangeEvents(): Promise<void> {
            if (!window.state.focused) {
                const onDidFocusWindow = filterEvent(window.onDidChangeWindowState, e => e.focused);
                await eventToPromise(onDidFocusWindow);
            }
    
            const events: FileChangeEvent[] = [];
    
            for (const { uri } of this.cache.values()) {
                const fsPath = uri.fsPath;
    
                for (const root of this.changedTocRoots) {
                    if (isDescendant(root, fsPath)) {
                        events.push({ type: FileChangeType.Changed, uri });
                        break;
                    }
                }
            }
    
            if (events.length > 0) {
                this.mtime = new Date().getTime();
                this._onDidChangeFile.fire(events);
            }
    
            this.changedTocRoots.clear();
        } */
    cleanup() {
        const now = new Date().getTime();
        const cache = new Map();
        for (const row of this.cache.values()) {
            const path = row.uri.fsPath;
            const isOpen = vscode_1.workspace.textDocuments
                .filter(d => d.uri.scheme === 'file')
                .some(d => (0, util_1.pathEquals)(d.uri.fsPath, path));
            if (isOpen || now - row.timestamp < THREE_MINUTES) {
                cache.set(row.uri.toString(), row);
            }
            else {
                // TODO: should fire delete events?
            }
        }
        this.cache = cache;
    }
    watch() {
        return util_1.EmptyDisposable;
    }
    async stat(uri) {
        await this.model.isInitialized;
        return Promise.resolve(vscode_1.workspace.fs.stat(uri));
        /* if (!repository) {
            throw FileSystemError.FileNotFound();
        }

        let size = 0;
        try {
            const details = await repository.getObjectDetails(sanitizeRef(ref, path, repository), path);
            size = details.size;
        } catch {
            // noop
        }
        return { type: FileType.File, size: size, mtime: this.mtime, ctime: 0 }; */
    }
    readDirectory() {
        throw new Error('Method not implemented.');
    }
    createDirectory() {
        throw new Error('Method not implemented.');
    }
    async readFile(uri) {
        await this.model.isInitialized;
        const timestamp = new Date().getTime();
        const cacheValue = { uri, timestamp };
        this.cache.set(uri.toString(), cacheValue);
        try {
            return await vscode_1.workspace.fs.readFile(uri);
        }
        catch (err) {
            return new Uint8Array(0);
        }
    }
    writeFile() {
        throw new Error('Method not implemented.');
    }
    delete() {
        throw new Error('Method not implemented.');
    }
    rename() {
        throw new Error('Method not implemented.');
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
exports.WatFileSystemProvider = WatFileSystemProvider;

//# sourceMappingURL=../out/fileSystemProvider.js.map
