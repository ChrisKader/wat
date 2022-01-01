import { commands as Commands, Disposable, Event, EventEmitter, OutputChannel, workspace as Workspace, Uri, window as Window, WorkspaceFoldersChangeEvent, TextEditor, ExtensionContext, FileSystemWatcher, RelativePattern, WorkspaceFolder, workspace } from "vscode";
import { WatOutputChannel } from './main';
import { parsePkgMeta } from './packager';
import { TocOutline, TocOutlineProvider } from "./tocOutlineProvider";
import { anyEvent, dispose, eventToPromise, filterEvent, isDescendant, logTimestamp } from "./util";
import { State } from "./wat";
import { WatDecorationProvider } from './decorationProvider'
interface ParsedToc extends Disposable {
	tocOutline: TocOutline
}

export interface TocChangeEvent {
	toc: TocOutline;
	uri: Uri;
}
const pkgMetaTocRegEx = /(.+\.toc)|(\.?pkgmeta.*(\.yaml)?)/;
const pkgMetaTocGlob = '**/{*.toc,.pkgmeta*,pkgmeta*.yaml}'
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

	private _fileWatchPatterns = [
		{ fileType: 'pkgmeta', pattern: '**/.pkgmeta*' },
		{ fileType: 'pkgmeta', pattern: '**/pkgmeta*.yaml' },
		{ fileType: 'toc', pattern: '**/*.toc' }
	]

	private disposables: Disposable[] = [];
	decorationProvider = new WatDecorationProvider()
	private async onPossibleWatchedFileChange(uri: Uri) {
		this.decorationProvider.updateMissingFile(uri);
		this.outputChannel.appendLine(`onPossibleWatchedFileChange ${uri.fsPath}`, 'model.ts', 0)
		if (/\.?pkgmeta.*(?:\.yaml)?/.test(uri.fsPath)) {
			const newPkgMetaFile = await parsePkgMeta(uri, {}, this.outputChannel)
			console.log(newPkgMetaFile)
			this.tocOutlineProvider.refresh()
		} else if (/.+\.toc/.test(uri.fsPath)) {
			this.tocOutlineProvider.addTocFile(uri)
			this.tocOutlineProvider.refresh()
		}
	}

	private async onDidChangeWorkspaceFolders({ added, removed }: WorkspaceFoldersChangeEvent): Promise<void> {
		added.map(workspaceFolder => {
			Workspace.findFiles(new RelativePattern(workspaceFolder, pkgMetaTocGlob)).then(fileUris => {
				fileUris.map(fileUri => {
					this.onPossibleWatchedFileChange(fileUri)
				})
			})
		});

		removed.map(async workspaceFolder => {
			(await Workspace.findFiles(new RelativePattern(workspaceFolder, pkgMetaTocGlob)))
				.map(async fileUri => {
					this.tocOutlineProvider.getTocOutline(fileUri)?.dispose()
				})
		})
	}

	private async onDidChangeVisibleTextEditors(editors: readonly TextEditor[]): Promise<void> {
		//TODO: Setup expanding/collapsing tree items the text editor related to the tree items file selected/deselected.
		if (!Workspace.isTrusted) {
			return;
		}
	}

	private onDidChangeConfiguration(): void {
		//TODO: Add Logic for any config changes.

	}

	private async initialWorkspaceScan() {
		this.onDidChangeWorkspaceFolders({ added: Workspace.workspaceFolders!, removed: [] })
		this.onDidChangeVisibleTextEditors(Window.visibleTextEditors)
	}

	private checkifInWorkspace(uri: Uri) {
		if (!Workspace.workspaceFolders) return false;
		return typeof (Workspace.getWorkspaceFolder(uri)) !== 'undefined'
	}

	constructor(
		private context: ExtensionContext,
		private outputChannel: WatOutputChannel,
		private tocOutlineProvider: TocOutlineProvider
	) {
		Workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspaceFolders, this, this.disposables);
		Window.onDidChangeVisibleTextEditors(this.onDidChangeVisibleTextEditors, this, this.disposables);
		Workspace.onDidChangeConfiguration(this.onDidChangeConfiguration, this, this.disposables);

		const fsWatcher = Workspace.createFileSystemWatcher('**/*');
		this.disposables.push(fsWatcher);

		const onWorkspaceChange = anyEvent(fsWatcher.onDidChange, fsWatcher.onDidCreate, fsWatcher.onDidDelete);
		const onWatchedFileChange = filterEvent(onWorkspaceChange, uri => this.checkifInWorkspace(uri));
		onWatchedFileChange(this.onPossibleWatchedFileChange, this, this.disposables);


		this.initialWorkspaceScan()
		const view = Window.createTreeView('watTree', { treeDataProvider: this.tocOutlineProvider });
		Commands.registerCommand('watTree.refresh', () => this.tocOutlineProvider.refresh());
		Commands.registerCommand('watTree.openFile', (s) => this.tocOutlineProvider.openFile(s));
		Commands.registerCommand('watTree.refreshNode', offset => this.tocOutlineProvider.refresh(offset));
		//Commands.registerCommand('watTree.renameNode', offset => this.tocOutlineProvider.rename(offset));
		context.subscriptions.push(view);
		this.tocOutlineProvider.refresh()

	}

	dispose(): void {
		const parsedTocs = [...this.parsedTocs];
		parsedTocs.forEach(r => r.dispose());
		this.parsedTocs = [];

		this.disposables = dispose(this.disposables);
	}
}