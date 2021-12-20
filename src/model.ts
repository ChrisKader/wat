import { commands as Commands, Disposable, Event, EventEmitter, Memento, OutputChannel, workspace as Workspace, Uri, window as Window, window, workspace, WorkspaceFoldersChangeEvent, TextEditor, ExtensionContext } from "vscode";
import { TocOutline, TocOutlineProvider } from "./tocOutline";
import { anyEvent, dispose, eventToPromise, filterEvent, isDescendant, logTimestamp } from "./util";
import * as fs from 'fs';
import { State } from "./wat";
import * as path from "path";
interface ParsedToc extends Disposable {
    tocOutline: TocOutline
}
export interface TocChangeEvent {
    toc: TocOutline;
    uri: Uri;
}

export class Model {
    private _onDidOpenTocFile = new EventEmitter<TocOutline>();
    readonly onDidOpenTocFile: Event<TocOutline> = this._onDidOpenTocFile.event;

    private _onDidCloseTocFile = new EventEmitter<Uri>();
    readonly onDidCloseTocFile: Event<Uri> = this._onDidCloseTocFile.event;

    private _onDidChangeRepository = new EventEmitter<TocChangeEvent>();
    readonly onDidChangeRepository: Event<TocChangeEvent> = this._onDidChangeRepository.event;

    private parsedTocs:ParsedToc[] = [];
    get tocs(): TocOutline[] { return this.parsedTocs.map(r => r.tocOutline); }

    private _onDidChangeState = new EventEmitter<State>();
    readonly onDidChangeState = this._onDidChangeState.event;

    private _state: State = 'uninitialized';
    get state(): State { return this._state; }

    setState(state: State): void {
        this._state = state;
        this._onDidChangeState.fire(state);
        Commands.executeCommand('setContext', 'wat.state', state);
    }
    private tocOutlineProvider: TocOutlineProvider
    get isInitialized(): Promise<void> {
        if (this._state === 'initialized') {
            return Promise.resolve();
        }

        return eventToPromise(filterEvent(this.onDidChangeState, s => s === 'initialized')) as Promise<any>;
    }

    private disposables: Disposable[] = [];
    private addTocFile(tocOutline: TocOutline){
        this.tocOutlineProvider.addTocOutline(tocOutline)
    }
    constructor(private context: ExtensionContext, private outputChannel: OutputChannel){
        Workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspaceFolders, this, this.disposables);
        Window.onDidChangeVisibleTextEditors(this.onDidChangeVisibleTextEditors, this, this.disposables);

        const fsWatcher = Workspace.createFileSystemWatcher('**');
        this.disposables.push(fsWatcher);
        const onWorkspaceChange = anyEvent(fsWatcher.onDidChange, fsWatcher.onDidCreate, fsWatcher.onDidDelete);
        this.tocOutlineProvider = new TocOutlineProvider();
        this.onDidOpenTocFile(e => this.tocOutlineProvider.addTocOutline(e))
        //const onPossibleGitRepositoryChange = filterEvent(onGitRepositoryChange, uri => !this.getRepository(uri));
        //onPossibleGitRepositoryChange(this.onPossibleGitRepositoryChange, this, this.disposables);
        this.setState('uninitialized');
        this.doInitialScan().finally(() => {
            this.setState('initialized')
            console.log('model.ts > constructor > init done!')
            if(this.tocOutlineProvider){
                const view = Window.createTreeView('watTree', {treeDataProvider: this.tocOutlineProvider});
                Commands.registerCommand('watTree.refresh', () => this.tocOutlineProvider!.refresh());
                Commands.registerCommand('watTree.openFile', (s) => this.tocOutlineProvider!.openFile(s));
                Commands.registerCommand('watTree.refreshNode', offset => this.tocOutlineProvider!.refresh(offset));
                Commands.registerCommand('watTree.renameNode', offset => this.tocOutlineProvider!.rename(offset));
                context.subscriptions.push(view);
                this.tocOutlineProvider.refresh()
            }
            //this.disposables.push(tocOutlineProvider);
        }).catch(r=>{
            this.tocOutlineProvider = new TocOutlineProvider()
        })
        
    }
    private async doInitialScan(): Promise<void> {
        await Promise.all([
            this.onDidChangeWorkspaceFolders({ added: workspace.workspaceFolders || [], removed: [] }),
            this.onDidChangeVisibleTextEditors(window.visibleTextEditors),
            this.scanWorkspaceFolders()
        ]);
    }
    private async scanWorkspaceFolders(): Promise<void> {
        //const config = workspace.getConfiguration('git');
        //const autoRepositoryDetection = config.get<boolean | 'subFolders' | 'openEditors'>('autoRepositoryDetection');

        //if (autoRepositoryDetection !== true && autoRepositoryDetection !== 'subFolders') {
            //return;
        //}

        await Promise.all((workspace.workspaceFolders || []).map(async folder => {
            const root = folder.uri.fsPath;
            //workspace.findFiles('**/*.toc')
            //const children = (await fs.promises.readdir(root, { withFileTypes: true })).filter(dirent => dirent.isFile()).map(dirent => dirent.name);
            const subfolders = await workspace.findFiles('**/*.toc')

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
    private async onDidChangeVisibleTextEditors(editors: readonly TextEditor[]): Promise<void> {
        if (!workspace.isTrusted) {
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
    async openToc(tocPath: string): Promise<void> {
        if (this.getToc(tocPath)) {
            return;
        }
        // TODO: Add config
        /* const config = workspace.getConfiguration('wat', Uri.file(repoPath));
        const enabled = config.get<boolean>('enabled') === true;

        if (!enabled) {
            return;
        } */

        if (!workspace.isTrusted) {
            // TODO: Add error for untrusted workspace.
            try {

            } catch {

            }
        }

        try {
            const tocRoot = Uri.file(tocPath).fsPath;

            if (this.getToc(tocRoot)) {
                return;
            }

/*             if (this.shouldRepositoryBeIgnored(rawRoot)) {
                return;
            } */

            //const dotGit = await this.git.getRepositoryDotGit(repositoryRoot);
            const tocFileContents = await Promise.resolve(Workspace.fs.readFile(Uri.file(tocPath)).then(v => {
                return v.toString();
            }));
            const tocOutline = new TocOutline(Uri.file(tocPath), tocFileContents);//, this, this, this.globalState, this.outputChannel);

            this.open(tocOutline);
            //tocOutline.status(); // do not await this, we want SCM to know about the repo asap */
        } catch (ex) {
            // noop
            /* this.outputChannel.appendLine(`${logTimestamp()} Opening repository for path='${repoPath}' failed; ex=${ex}`); */
        }
    }

    private open(toc: TocOutline): void {
        this.outputChannel.appendLine(`${logTimestamp()} Open Toc: ${toc.uri}`);

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

        const openToc:ParsedToc = { tocOutline:toc, dispose };
        this.parsedTocs.push(openToc);
        this._onDidOpenTocFile.fire(openToc.tocOutline);
        this.addTocFile(openToc.tocOutline)
        this.tocOutlineProvider.refresh()
    }
    private async onDidChangeWorkspaceFolders({ added, removed }: WorkspaceFoldersChangeEvent): Promise<void> {
        const possibleRepositoryFolders = added
            .filter(folder => !this.getParsedToc(folder.uri));

        const activeTocsList = window.visibleTextEditors
            .map(editor => this.getToc(editor.document.uri))
            .filter(tocOutline => !!tocOutline) as TocOutline[];

        const activeTocs = new Set<TocOutline>(activeTocsList);
        const openRepositoriesToDispose = removed
            .map(folder => this.getParsedToc(folder.uri))
            .filter(r => !!r)
            .filter(r => !activeTocs.has(r!.tocOutline))
            .filter(r => !(workspace.workspaceFolders || []).some(f => isDescendant(f.uri.fsPath, r!.tocOutline.tocFile.addonFolder.fsPath))) as ParsedToc[];

        openRepositoriesToDispose.forEach(r => r.dispose());
        await Promise.all(possibleRepositoryFolders.map(p => this.openToc(p.uri.fsPath)));
    }

    private getToc(path: string): TocOutline | undefined;
    private getToc(resource: Uri): TocOutline | undefined;
    private getToc(hint: any): TocOutline | undefined {
        const tocOutline = this.getParsedToc(hint);
        return tocOutline && tocOutline.tocOutline;
    }

    private getParsedToc(path: string): ParsedToc | undefined;
    private getParsedToc(resource: Uri): ParsedToc | undefined;
    private getParsedToc(hint: any): ParsedToc | undefined {
        if (!hint) {
            return undefined;
        }
        if (typeof hint === 'string') {
            hint = Uri.file(hint);
        }
        if (hint instanceof Uri) {
            return this.parsedTocs.filter(r => r.tocOutline.uri === hint)[0];
        }
        return undefined;
    }
    
    dispose(): void {
        const parsedTocs = [...this.parsedTocs];
        parsedTocs.forEach(r => r.dispose());
        this.parsedTocs = [];
        
        this.disposables = dispose(this.disposables);
    }
}