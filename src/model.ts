import { commands, Disposable, Event, EventEmitter, Memento, OutputChannel, workspace as Workspace, Uri, window as Window, window, workspace, WorkspaceFoldersChangeEvent, TextEditor, ExtensionContext } from "vscode";
import { TocOutline, TocOutlineProvider } from "./tocOutline";
import { anyEvent, dispose, eventToPromise, filterEvent, isDescendant, logTimestamp } from "./util";
import * as fs from 'fs'
import { State } from "./wat";
import path = require("path");
import { localize } from "vscode-nls";
interface ParsedToc extends Disposable {
    tocOutline: TocOutline
}
export interface TocChangeEvent {
    toc: TocOutline;
    uri: Uri;
}

export class Model {
    private _onDidOpenTocFile = new EventEmitter<Uri>();
    readonly onDidOpenTocFile: Event<Uri> = this._onDidOpenTocFile.event;

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
        commands.executeCommand('setContext', 'wat.state', state);
    }

    get isInitialized(): Promise<void> {
        if (this._state === 'initialized') {
            return Promise.resolve();
        }

        return eventToPromise(filterEvent(this.onDidChangeState, s => s === 'initialized')) as Promise<any>;
    }

    private disposables: Disposable[] = [];

    constructor(private context: ExtensionContext, private outputChannel: OutputChannel){
        Workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspaceFolders, this, this.disposables);
        Window.onDidChangeVisibleTextEditors(this.onDidChangeVisibleTextEditors, this, this.disposables);
        //Workspace.onDidChangeConfiguration(this.onDidChangeConfiguration, this, this.disposables);

        const fsWatcher = Workspace.createFileSystemWatcher('**');
        this.disposables.push(fsWatcher);
        const tocOutlineProvider = new TocOutlineProvider();
        const view = Window.createTreeView('addonOutline', { treeDataProvider: tocOutlineProvider });
        context.subscriptions.push(view);
        this.disposables.push(tocOutlineProvider);
        const onWorkspaceChange = anyEvent(fsWatcher.onDidChange, fsWatcher.onDidCreate, fsWatcher.onDidDelete);
        const onGitRepositoryChange = filterEvent(onWorkspaceChange, uri => /\/\.git/.test(uri.path));
        //const onPossibleGitRepositoryChange = filterEvent(onGitRepositoryChange, uri => !this.getRepository(uri));
        //onPossibleGitRepositoryChange(this.onPossibleGitRepositoryChange, this, this.disposables);

        this.setState('uninitialized');
        this.doInitialScan().finally(() => this.setState('initialized'));
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
            const children = (await fs.promises.readdir(root, { withFileTypes: true })).filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
            const subfolders = new Set(children.filter(child => child !== '.git').map(child => path.join(root, child)));

            const scanPaths: never[] = [];
            for (const scanPath of scanPaths) {
                if (scanPath === '.toc') {
                    continue;
                }

                if (path.isAbsolute(scanPath)) {
                    console.warn(localize('not supported', ""));
                    continue;
                }

                subfolders.add(path.join(root, scanPath));
            }

            await Promise.all([...subfolders].map(f => this.openToc(f)));
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

        /* const config = workspace.getConfiguration('wat', Uri.file(repoPath));
        const enabled = config.get<boolean>('enabled') === true;

        if (!enabled) {
            return;
        } */

        if (!workspace.isTrusted) {
            // Check if the folder is a bare repo: if it has a file named HEAD && `rev-parse --show -cdup` is empty
            try {
                /* fs.accessSync(path.join(repoPath, 'HEAD'), fs.constants.F_OK);
                const result = await this.git.exec(repoPath, ['-C', repoPath, 'rev-parse', '--show-cdup'], { log: false });
                if (result.stderr.trim() === '' && result.stdout.trim() === '') {
                    return;
                } */
            } catch {
                // If this throw, we should be good to open the repo (e.g. HEAD doesn't exist)
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

        const shouldDetectSubmodules = workspace
            .getConfiguration('wat', Uri.file(toc.tocFile.addonFolder.fsPath))
            .get<boolean>('detectSubmodules') as boolean;

        const submodulesLimit = workspace
            .getConfiguration('wat', Uri.file(toc.tocFile.addonFolder.fsPath))
            .get<number>('detectSubmodulesLimit') as number;

        const checkForSubmodules = () => {
            if (!shouldDetectSubmodules) {
                return;
            }

/*             if (repository.submodules.length > submodulesLimit) {
                window.showWarningMessage(localize('too many submodules', "The '{0}' repository has {1} submodules which won't be opened automatically. You can still open each one individually by opening a file within.", path.basename(repository.root), repository.submodules.length));
                statusListener.dispose();
            } */

/*             repository.submodules
                .slice(0, submodulesLimit)
                .map(r => path.join(repository.root, r.path))
                .forEach(p => this.eventuallyScanPossibleGitRepository(p)); */
        };

        //const statusListener = repository.onDidRunGitStatus(checkForSubmodules);
        checkForSubmodules();

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
        this._onDidOpenTocFile.fire(openToc.tocOutline.uri);
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