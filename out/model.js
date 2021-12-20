"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Model = void 0;
const vscode_1 = require("vscode");
const tocOutline_1 = require("./tocOutline");
const util_1 = require("./util");
class Model {
    constructor(context, outputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
        this._onDidOpenTocFile = new vscode_1.EventEmitter();
        this.onDidOpenTocFile = this._onDidOpenTocFile.event;
        this._onDidCloseTocFile = new vscode_1.EventEmitter();
        this.onDidCloseTocFile = this._onDidCloseTocFile.event;
        this._onDidChangeRepository = new vscode_1.EventEmitter();
        this.onDidChangeRepository = this._onDidChangeRepository.event;
        this.parsedTocs = [];
        this._onDidChangeState = new vscode_1.EventEmitter();
        this.onDidChangeState = this._onDidChangeState.event;
        this._state = 'uninitialized';
        this.disposables = [];
        vscode_1.workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspaceFolders, this, this.disposables);
        vscode_1.window.onDidChangeVisibleTextEditors(this.onDidChangeVisibleTextEditors, this, this.disposables);
        const fsWatcher = vscode_1.workspace.createFileSystemWatcher('**');
        this.disposables.push(fsWatcher);
        const onWorkspaceChange = (0, util_1.anyEvent)(fsWatcher.onDidChange, fsWatcher.onDidCreate, fsWatcher.onDidDelete);
        this.tocOutlineProvider = new tocOutline_1.TocOutlineProvider();
        this.onDidOpenTocFile(e => this.tocOutlineProvider.addTocOutline(e));
        //const onPossibleGitRepositoryChange = filterEvent(onGitRepositoryChange, uri => !this.getRepository(uri));
        //onPossibleGitRepositoryChange(this.onPossibleGitRepositoryChange, this, this.disposables);
        this.setState('uninitialized');
        this.doInitialScan().finally(() => {
            this.setState('initialized');
            console.log('model.ts > constructor > init done!');
            if (this.tocOutlineProvider) {
                const view = vscode_1.window.createTreeView('watTree', { treeDataProvider: this.tocOutlineProvider });
                vscode_1.commands.registerCommand('watTree.refresh', () => this.tocOutlineProvider.refresh());
                vscode_1.commands.registerCommand('watTree.openFile', (s) => this.tocOutlineProvider.openFile(s));
                vscode_1.commands.registerCommand('watTree.refreshNode', offset => this.tocOutlineProvider.refresh(offset));
                vscode_1.commands.registerCommand('watTree.renameNode', offset => this.tocOutlineProvider.rename(offset));
                context.subscriptions.push(view);
                this.tocOutlineProvider.refresh();
            }
            //this.disposables.push(tocOutlineProvider);
        }).catch(r => {
            this.tocOutlineProvider = new tocOutline_1.TocOutlineProvider();
        });
    }
    get tocs() { return this.parsedTocs.map(r => r.tocOutline); }
    get state() { return this._state; }
    setState(state) {
        this._state = state;
        this._onDidChangeState.fire(state);
        vscode_1.commands.executeCommand('setContext', 'wat.state', state);
    }
    get isInitialized() {
        if (this._state === 'initialized') {
            return Promise.resolve();
        }
        return (0, util_1.eventToPromise)((0, util_1.filterEvent)(this.onDidChangeState, s => s === 'initialized'));
    }
    addTocFile(tocOutline) {
        this.tocOutlineProvider.addTocOutline(tocOutline);
    }
    async doInitialScan() {
        await Promise.all([
            this.onDidChangeWorkspaceFolders({ added: vscode_1.workspace.workspaceFolders || [], removed: [] }),
            this.onDidChangeVisibleTextEditors(vscode_1.window.visibleTextEditors),
            this.scanWorkspaceFolders()
        ]);
    }
    async scanWorkspaceFolders() {
        //const config = workspace.getConfiguration('git');
        //const autoRepositoryDetection = config.get<boolean | 'subFolders' | 'openEditors'>('autoRepositoryDetection');
        //if (autoRepositoryDetection !== true && autoRepositoryDetection !== 'subFolders') {
        //return;
        //}
        await Promise.all((vscode_1.workspace.workspaceFolders || []).map(async (folder) => {
            const root = folder.uri.fsPath;
            //workspace.findFiles('**/*.toc')
            //const children = (await fs.promises.readdir(root, { withFileTypes: true })).filter(dirent => dirent.isFile()).map(dirent => dirent.name);
            const subfolders = await vscode_1.workspace.findFiles('**/*.toc');
            /* const scanPaths: never[] = [];
            for (const scanPath of scanPaths) {
                if (scanPath === '.toc') {
                    continue;
                }

                if (path.isAbsolute(scanPath)) {
                    console.warn('not supported');
                    continue;
                }

                subfolders.add(path.join(root, scanPath));
            } */
            await Promise.all(subfolders.map(f => this.openToc(f.fsPath)));
        }));
    }
    async onDidChangeVisibleTextEditors(editors) {
        if (!vscode_1.workspace.isTrusted) {
            return;
        }
        /*         const config = workspace.getConfiguration('git');
                const autoRepositoryDetection = config.get<boolean | 'subFolders' | 'openEditors'>('autoRepositoryDetection');
        
                if (autoRepositoryDetection !== true && autoRepositoryDetection !== 'openEditors') {
                    return;
                } */
        /*         await Promise.all(editors.map(async editor => {
                    const uri = editor.document.uri;
        
                    if (uri.scheme !== 'file') {
                        return;
                    }
        
                    const repository = this.getToc(uri);
        
                    if (repository) {
                        return;
                    }
        
                    await this.openToc(path.dirname(uri.fsPath));
                })); */
    }
    async openToc(tocPath) {
        if (this.getToc(tocPath)) {
            return;
        }
        // TODO: Add config
        /* const config = workspace.getConfiguration('wat', Uri.file(repoPath));
        const enabled = config.get<boolean>('enabled') === true;

        if (!enabled) {
            return;
        } */
        if (!vscode_1.workspace.isTrusted) {
            // TODO: Add error for untrusted workspace.
            try {
            }
            catch {
            }
        }
        try {
            const tocRoot = vscode_1.Uri.file(tocPath).fsPath;
            if (this.getToc(tocRoot)) {
                return;
            }
            /*             if (this.shouldRepositoryBeIgnored(rawRoot)) {
                            return;
                        } */
            //const dotGit = await this.git.getRepositoryDotGit(repositoryRoot);
            const tocFileContents = await Promise.resolve(vscode_1.workspace.fs.readFile(vscode_1.Uri.file(tocPath)).then(v => {
                return v.toString();
            }));
            const tocOutline = new tocOutline_1.TocOutline(vscode_1.Uri.file(tocPath), tocFileContents); //, this, this, this.globalState, this.outputChannel);
            this.open(tocOutline);
            //tocOutline.status(); // do not await this, we want SCM to know about the repo asap */
        }
        catch (ex) {
            // noop
            /* this.outputChannel.appendLine(`${logTimestamp()} Opening repository for path='${repoPath}' failed; ex=${ex}`); */
        }
    }
    open(toc) {
        this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()} Open Toc: ${toc.uri}`);
        //const onDidDisappearRepository = filterEvent(repository.onDidChangeState, state => state === RepositoryState.Disposed);
        //const disappearListener = onDidDisappearRepository(() => dispose());
        //const changeListener = repository.onDidChangeRepository(uri => this._onDidChangeRepository.fire({ repository, uri }));
        //const originalResourceChangeListener = repository.onDidChangeOriginalResource(uri => this._onDidChangeOriginalResource.fire({ repository, uri }));
        //const statusListener = repository.onDidRunGitStatus(checkForSubmodules);
        //checkForSubmodules();
        const dispose = () => {
            //disappearListener.dispose();
            //changeListener.dispose();
            //originalResourceChangeListener.dispose();
            //statusListener.dispose();
            //repository.dispose();
            this.parsedTocs = this.parsedTocs.filter(e => e !== openToc);
            this._onDidCloseTocFile.fire(toc.uri);
        };
        const openToc = { tocOutline: toc, dispose };
        this.parsedTocs.push(openToc);
        this._onDidOpenTocFile.fire(openToc.tocOutline);
        this.addTocFile(openToc.tocOutline);
        this.tocOutlineProvider.refresh();
    }
    async onDidChangeWorkspaceFolders({ added, removed }) {
        const possibleRepositoryFolders = added
            .filter(folder => !this.getParsedToc(folder.uri));
        const activeTocsList = vscode_1.window.visibleTextEditors
            .map(editor => this.getToc(editor.document.uri))
            .filter(tocOutline => !!tocOutline);
        const activeTocs = new Set(activeTocsList);
        const openRepositoriesToDispose = removed
            .map(folder => this.getParsedToc(folder.uri))
            .filter(r => !!r)
            .filter(r => !activeTocs.has(r.tocOutline))
            .filter(r => !(vscode_1.workspace.workspaceFolders || []).some(f => (0, util_1.isDescendant)(f.uri.fsPath, r.tocOutline.tocFile.addonFolder.fsPath)));
        openRepositoriesToDispose.forEach(r => r.dispose());
        await Promise.all(possibleRepositoryFolders.map(p => this.openToc(p.uri.fsPath)));
    }
    getToc(hint) {
        const tocOutline = this.getParsedToc(hint);
        return tocOutline && tocOutline.tocOutline;
    }
    getParsedToc(hint) {
        if (!hint) {
            return undefined;
        }
        if (typeof hint === 'string') {
            hint = vscode_1.Uri.file(hint);
        }
        if (hint instanceof vscode_1.Uri) {
            return this.parsedTocs.filter(r => r.tocOutline.uri === hint)[0];
        }
        return undefined;
    }
    dispose() {
        const parsedTocs = [...this.parsedTocs];
        parsedTocs.forEach(r => r.dispose());
        this.parsedTocs = [];
        this.disposables = (0, util_1.dispose)(this.disposables);
    }
}
exports.Model = Model;

//# sourceMappingURL=../out/model.js.map
