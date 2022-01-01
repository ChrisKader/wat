import { existsSync } from 'graceful-fs';
import { window as Window, Uri, Disposable, Event, EventEmitter, FileDecoration, FileDecorationProvider, ThemeColor, workspace as Workspace, RelativePattern, } from 'vscode';
import { anyEvent, dispose, filterEvent, fireEvent } from './util';


export class WatDecorationProvider implements FileDecorationProvider {

	private static missingFileDecorationData: FileDecoration = {
		tooltip: 'Missing',
		badge: 'M',
		color: new ThemeColor('problemsErrorIcon.foreground'),
		propagate: false
	};

	private static standardFileDecorationData: FileDecoration = {
		tooltip: '',
		badge: '',
		color: '#cccccc',//new ThemeColor('gitDecoration.renamedResourceForeground'),
		propagate: false
	};

	private checkExists(uri: Uri) {
		if (!Workspace.getWorkspaceFolder(uri)) return false
		return existsSync(uri.fsPath)
	}

	private readonly _onDidChangeFileDecorations = new EventEmitter<Uri>();
	readonly onDidChangeFileDecorations: Event<Uri> = this._onDidChangeFileDecorations.event;

	async updateMissingFile(uri: Uri) {
		this._onDidChangeFileDecorations.fire(uri)
	}

	private disposables: Disposable[] = [];
	private decorations = new Map<string, FileDecoration>();

	constructor() {
		Window.registerFileDecorationProvider(this)
	}

	async provideFileDecoration(uri: Uri): Promise<FileDecoration> {
		if (existsSync(uri.fsPath)) {
			return WatDecorationProvider.standardFileDecorationData
		}
		return WatDecorationProvider.missingFileDecorationData
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}