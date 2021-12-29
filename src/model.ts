import { commands as Commands, Disposable, Event, EventEmitter, OutputChannel, workspace as Workspace, Uri, window as Window, WorkspaceFoldersChangeEvent, TextEditor, ExtensionContext, FileSystemWatcher, RelativePattern, WorkspaceFolder } from "vscode";
import { WatOutputChannel } from './main';
import { parsePkgMeta, WowPack } from './packager';
import { TocOutline, TocOutlineProvider } from "./tocOutline";
import { anyEvent, dispose, eventToPromise, filterEvent, isDescendant, logTimestamp } from "./util";
import { State } from "./wat";
import { WatStatusBarItem } from './watStatusBarItem';

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

	private parsedTocs: ParsedToc[] = [];
	get tocs(): TocOutline[] { return this.parsedTocs.map(r => r.tocOutline); }

	private _onDidChangeState = new EventEmitter<State>();
	readonly onDidChangeState = this._onDidChangeState.event;

	private _state: State = 'uninitialized';
	get state(): State { return this._state; }

	private _WorkspaceWatchers = new Map<string, FileSystemWatcher>()

	private pkgMetaFiles: WowPack[] = []

	private _fileWatchPatterns = [
		{ fileType: 'pkgmeta', pattern: '**/.pkgmeta*' },
		{ fileType: 'pkgmeta', pattern: '**/pkgmeta*.yaml' },
		{ fileType: 'toc', pattern: '**/*.toc' }
	]
	setState(state: State): void {
		this._state = state;
		this._onDidChangeState.fire(state);
		Commands.executeCommand('setContext', 'wat.state', state);
	}

	get statusBarText() {
		return `$(lightbulb) ${this.tocOutlineProvider.getTocOutlines().length} TOC Files / ${this.pkgMetaFiles.length} PkgMeta Files`
	}

	get isInitialized(): Promise<void> {
		if (this._state === 'initialized') {
			return Promise.resolve();
		}
		return eventToPromise(filterEvent(this.onDidChangeState, s => s === 'initialized')) as Promise<any>;
	}

	private disposables: Disposable[] = [];
	statusBarItem: WatStatusBarItem

	private addTocFile(tocOutline: TocOutline) {
		this.tocOutlineProvider.addTocOutline(tocOutline)
		this.statusBarItem.text = this.statusBarText
	}

	private async fsWatcherEventProcessor(uri: Uri, event: string, fileType: string) {
		this.outputChannel.appendLine(`${uri.fsPath} ${event} ${fileType}`, 'model.ts', 0)
		if (fileType === 'pkgmeta') {
			this.pkgMetaFiles.push(await parsePkgMeta(uri, {}, this.outputChannel))
			console.log(this.pkgMetaFiles)
			this.statusBarItem.text = this.statusBarText
		} else if (fileType === 'toc') {
			this.parseToc(uri)
			this.statusBarItem.text = this.statusBarText
		}
	}

	private buildWatcherString(uri: Uri, pattern: string) {
		return `${uri.fsPath}-${pattern}`
	}


	private async onDidChangeWorkspaceFolders({ added, removed }: WorkspaceFoldersChangeEvent): Promise<void> {
		added.map(v => {
			this._fileWatchPatterns.map(filePattern => {
				const watcherString = this.buildWatcherString(v.uri, filePattern.pattern)
				const fsWatcher = Workspace.createFileSystemWatcher(new RelativePattern(v, filePattern.pattern))
				fsWatcher.onDidChange(e => this.fsWatcherEventProcessor(e, 'onDidChange', filePattern.fileType), undefined, this.disposables)
				fsWatcher.onDidCreate(e => this.fsWatcherEventProcessor(e, 'onDidCreate', filePattern.fileType), undefined, this.disposables)
				fsWatcher.onDidDelete(e => this.fsWatcherEventProcessor(e, 'onDidDelete', filePattern.fileType), undefined, this.disposables)
				this._WorkspaceWatchers.set(watcherString, fsWatcher)
			})
		});

		removed.map(v => {
			this._fileWatchPatterns.map(filePattern => {
				const watcherString = this.buildWatcherString(v.uri, filePattern.pattern)
				this._WorkspaceWatchers.get(watcherString)?.dispose()
			})
		})

		const possibleTocFolders = added
			.filter(folder => !this.getParsedToc(folder.uri));

		const activeTocsList = Window.visibleTextEditors
			.map(editor => this.getToc(editor.document.uri))
			.filter(tocOutline => !!tocOutline) as TocOutline[];

		const activeTocs = new Set<TocOutline>(activeTocsList);

		removed
			.map(folder => this.getParsedToc(folder.uri))
			.filter(r => !!r)
			.filter(r => !activeTocs.has(r!.tocOutline))
			.filter(r => !(Workspace.workspaceFolders || []).some(f => isDescendant(f.uri.fsPath, r!.tocOutline.tocFile.addonFolder.fsPath)))
			.forEach(r => r?.dispose());

		//await Promise.all(possibleTocFolders.map(p => this.openToc(p.uri.fsPath)));
	}

	private async onDidChangeVisibleTextEditors(editors: readonly TextEditor[]): Promise<void> {
		//TODO: Setup expanding/collapsing tree items the text editor related to the tree items file selected/deselected.
		if (!Workspace.isTrusted) {
			return;
		}
	}

	private async initialWorkspaceScan() {
		if (Workspace.workspaceFolders) {
			this.statusBarItem.text = '$(sync~spin) Loading Workspace..'
			this.statusBarItem.show = true
			this.onDidChangeWorkspaceFolders({ added: Workspace.workspaceFolders, removed: [] })
			this.onDidChangeVisibleTextEditors(Window.visibleTextEditors)
			await Promise.all((Workspace.workspaceFolders).map(async folder => {
				const root = folder.uri.fsPath;
				this._fileWatchPatterns.map(async p => (await Workspace.findFiles(new RelativePattern(folder, p.pattern))).map(f => this.fsWatcherEventProcessor(f, 'intial', p.fileType)))
			}));
			this.statusBarItem.text = `$(lightbulb) ${this.tocOutlineProvider.getTocOutlines().length} TOC Files Loaded`
		}
	}

	constructor(
		private context: ExtensionContext,
		private outputChannel: WatOutputChannel,
		private tocOutlineProvider: TocOutlineProvider
	) {
		Workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspaceFolders, this, this.disposables);
		Window.onDidChangeVisibleTextEditors(this.onDidChangeVisibleTextEditors, this, this.disposables);
		this.statusBarItem = new WatStatusBarItem()


		this.onDidOpenTocFile(e => this.tocOutlineProvider.addTocOutline(e))

		this.setState('uninitialized');

		if (!Workspace.workspaceFolders) {
			this.statusBarItem.text = '$(error) No Workspace Opened'
		} else {
			this.initialWorkspaceScan()
			const view = Window.createTreeView('watTree', { treeDataProvider: this.tocOutlineProvider });
			Commands.registerCommand('watTree.refresh', () => this.tocOutlineProvider.refresh());
			Commands.registerCommand('watTree.openFile', (s) => this.tocOutlineProvider.openFile(s));
			context.subscriptions.push(view);
			this.tocOutlineProvider.refresh()
		}
	}
	private async doInitialScan(): Promise<void> {
		await Promise.all([
			this.onDidChangeWorkspaceFolders({ added: Workspace.workspaceFolders || [], removed: [] }),
			this.onDidChangeVisibleTextEditors(Window.visibleTextEditors),
			//this.scanWorkspaceFolders()
		]);
	}

	private async parseToc(uri: Uri, refresh?: boolean) {
		const currentToc = this.getToc(uri)
		if (currentToc) {
			if (refresh) {
				currentToc.dispose()
			} else {
				return
			}
		}

		try {

			const tocOutline = new TocOutline(uri, (await Workspace.fs.readFile(uri)).toString())
			this.outputChannel.appendLine(`parseToc: ${tocOutline.uri.fsPath}`, 'model.ts');

			const dispose = () => {
				this.parsedTocs = this.parsedTocs.filter(e => e !== openToc);
				this._onDidCloseTocFile.fire(tocOutline.uri);
			};

			const openToc: ParsedToc = { tocOutline: tocOutline, dispose };
			this.parsedTocs.push(openToc);
			this._onDidOpenTocFile.fire(openToc.tocOutline);
			this.addTocFile(openToc.tocOutline)
			this.tocOutlineProvider.refresh()
			//tocOutline.status(); // do not await this, we want SCM to know about the repo asap */
		} catch (ex) {

		}
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