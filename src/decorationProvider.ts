import { window as Window, Uri, Disposable, Event, EventEmitter, FileDecoration, FileDecorationProvider, ThemeColor, workspace, RelativePattern, } from 'vscode';
import { Model } from './model';
import { TocOutline } from './tocOutline';
import { anyEvent, dispose, filterEvent, fireEvent } from './util';


class WatDecorationProvider implements FileDecorationProvider {

	private static missingFileDecorationData: FileDecoration = {
		tooltip: 'Missing',
		color: new ThemeColor('problemsErrorIcon.foreground'),
		propagate: true,
	};

	private readonly _onDidChangeFileDecorations = new EventEmitter<Uri[]>();
	readonly onDidChangeFileDecorations: Event<Uri[]> = this._onDidChangeFileDecorations.event;

	private disposables: Disposable[] = [];
	private decorations = new Map<string, FileDecoration>();

	constructor(private tocOutline: TocOutline) {
		/* this.onDidChangeFileDecorations = fireEvent(anyEvent<any>(
			filterEvent(workspace.onDidSaveTextDocument,e=>e.uri.toString().includes(workspace.workspaceFolders![0].uri.toString()))
		)) */
		this.disposables.push(
			Window.registerFileDecorationProvider(this),
			tocOutline.tocFile.onNewMissingFile(e => this.onNewMissingFile(e), this)
		);
	}

	private onNewMissingFile(uri: Uri[]): void {
		let newDecorations = new Map<string, FileDecoration>();
		this.collectDecorationData(this.tocOutline, newDecorations);

		const uris = new Set([...this.decorations.keys()].concat([...newDecorations.keys()]));
		this.decorations = newDecorations;
		this._onDidChangeFileDecorations.fire([...uris.values()].map(value => Uri.parse(value, true)));
	}

	private collectDecorationData(tocOutline: TocOutline, bucket: Map<string, FileDecoration>): void {
		for (const r of tocOutline.tocFile.getMissingFiles()) {
			const decoration = WatDecorationProvider.missingFileDecorationData;
			bucket.set(r[1].fsPath.toString(), decoration);
		}
	}

	async provideFileDecoration(uri: Uri): Promise<FileDecoration | undefined> {
		if (uri.toString().includes(workspace.workspaceFolders![0].uri.toString())) {
			if (await this.tocOutline.tocFile.checkFileExists(uri) === false) {
				return WatDecorationProvider.missingFileDecorationData;
			}
			return this.decorations.get(uri.toString());
		} else {
			return undefined
		}
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}

export class WatDecorations {

	private disposables: Disposable[] = [];
	private modelDisposables: Disposable[] = [];
	providers = new Map<TocOutline, Disposable>();

	constructor(private model: Model) {
		this.update();
	}

	private update(): void {
		this.enable();
	}

	private enable(): void {
		this.model.onDidOpenTocFile(this.onDidOpenTocOutline, this, this.modelDisposables);
	}

	private disable(): void {
		this.modelDisposables = dispose(this.modelDisposables);
		this.providers.forEach(value => value.dispose());
		this.providers.clear();
	}

	private onDidOpenTocOutline(tocOutline: TocOutline): void {
		const provider = new WatDecorationProvider(tocOutline);
		this.providers.set(tocOutline, provider);
	}

	dispose(): void {
		this.disable();
		this.disposables = dispose(this.disposables);
	}
}