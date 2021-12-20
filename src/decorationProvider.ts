import { window as Window, Uri, Disposable, Event, EventEmitter, FileDecoration, FileDecorationProvider, ThemeColor, } from 'vscode';
import { Model } from './model';
import { TocOutline} from './tocOutline';
import { dispose } from './util';


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
        console.log(`decorationsProvider.ts > WatDecorationProvider > constructor`);
		this.disposables.push(
			Window.registerFileDecorationProvider(this),
			tocOutline.tocFile.onNewMissingFile( e => this.onNewMissingFile(e),this)
		);
	}

	private onNewMissingFile(uri: Uri[]): void {
        console.log(`${uri}`);
        console.log(`decorationsProvider.ts > WatDecorationProvider > onNewMissingFile`);
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
        if(await this.tocOutline.tocFile.checkMissingFile(uri.fsPath)){
            console.log(`decorationsProvider.ts > WatDecorationProvider > provideFileDecoration ${uri} ${uri.fsPath}`);
            return WatDecorationProvider.missingFileDecorationData;
        }
		return this.decorations.get(uri.toString());
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}

export class WatDecorations {

    private disposables: Disposable[] = [];
    private modelDisposables: Disposable[] = [];
    private providers = new Map<TocOutline, Disposable>();

    constructor(private model: Model) {
        console.log('decorationsProvider.ts > WatDecorations > constructor');
        //model.tocs.forEach(a=>this.disposables.push(new UnknownTocFileProvider(a!)))
        //this.watTreeProvider.getAddonOutlines().forEach(a=>this.disposables.push(new UnknownTocFileProvider(a!)));

        //const onEnablementChange = filterEvent(workspace.onDidChangeConfiguration, e => e.affectsConfiguration('git.decorations.enabled'));
        //onEnablementChange(this.update, this, this.disposables);
        this.update();
    }

    private update(): void {
        /* const enabled = workspace.getConfiguration('git').get('decorations.enabled'); */
        console.log('decorationsProvider.ts > WatDecorations > update');
        this.enable();
/*         if (enabled) {
            this.enable();
        } else {
            this.disable();
        } */
    }

    private enable(): void {
        console.log('decorationsProvider.ts > WatDecorations > enable');
        this.model.onDidOpenTocFile(this.onDidOpenTocOutline, this, this.modelDisposables);
    }

    private disable(): void {
        this.modelDisposables = dispose(this.modelDisposables);
        this.providers.forEach(value => value.dispose());
        this.providers.clear();
    }

    private onDidOpenTocOutline(tocOutline: TocOutline): void {
        console.log(`decorationsProvider.ts > WatDecorations > onDidOpenTocOutline > ${tocOutline.tocFile.tocUri}`);
        const provider = new WatDecorationProvider(tocOutline);
        this.providers.set(tocOutline, provider);
    }

/*     private onDidCloseRepository(watTreeProvider: AddonOutlineProvider): void {
        const provider = this.providers.get(watTreeProvider);

        if (provider) {
            provider.dispose();
            this.providers.delete(watTree);
        }
    } */

    dispose(): void {
        this.disable();
        this.disposables = dispose(this.disposables);
    }
}