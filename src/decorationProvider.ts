import { window as Window, workspace as Workspace, Uri, Disposable, Event, EventEmitter, FileDecoration, FileDecorationProvider, ThemeColor, } from 'vscode';
import { Model } from './model';
import { TocOutline, TocOutlineProvider, TocFile } from './tocOutline';
import { filterEvent, dispose, anyEvent, fireEvent, PromiseSource } from './util';


class UnknownTocFileProvider implements FileDecorationProvider {
    private static unknownTocFileDecoration: FileDecoration = {
        badge: 'M',
        color: new ThemeColor('problemsErrorIcon.foreground')
    };

    readonly onDidChangeFileDecorations: Event<Uri[]>;

    private queue = new Map<string, { tocFile: TocFile; queue: Map<string, PromiseSource<FileDecoration | undefined>>; }>();
    private disposables: Disposable[] = [];

    constructor(private addonOutline: TocOutline) {
        this.onDidChangeFileDecorations = fireEvent(anyEvent<any>(
            filterEvent(Workspace.onDidOpenTextDocument, e => addonOutline.tocFile.checkMissingFile(e.uri.fsPath)),
            addonOutline.tocFile.onNewMissingFile,
        ));

        this.disposables.push(Window.registerFileDecorationProvider(this));
        console.log(`File Dec for ${addonOutline.tocFile.tocUri.fsPath} added!`);
    }

    async provideFileDecoration(uri: Uri): Promise<FileDecoration | undefined> {
        const tocFile = this.addonOutline.tocFile;

        if (!tocFile) {
            return;
        }

        let queueItem = this.queue.get(tocFile.tocUri.fsPath);

        if (!queueItem) {
            queueItem = { tocFile, queue: new Map<string, PromiseSource<FileDecoration | undefined>>() };
            this.queue.set(tocFile.tocUri.fsPath, queueItem);
        }

        let promiseSource = queueItem.queue.get(uri.fsPath);

        if (!promiseSource) {
            promiseSource = new PromiseSource();
            queueItem!.queue.set(uri.fsPath, promiseSource);
            this.checkIgnoreSoon();
        }

        return await promiseSource.promise;
    }

    /* @debounce(500) */
    private checkIgnoreSoon(): void {
        const queue = new Map(this.queue.entries());
        this.queue.clear();

        for (const [, item] of queue) {
            const paths = [...item.queue.keys()];

            item.tocFile.checkMissingFiles(paths).then(missingFileSet => {
                for (const [path, promiseSource] of item.queue.entries()) {
                    if (missingFileSet.has(path)){
                        console.log(`Sending decorator for ${path}`);
                        promiseSource.resolve(UnknownTocFileProvider.unknownTocFileDecoration);
                    } else {
                        promiseSource.resolve(undefined);
                    }
                }
            }, err => {
                console.error(err);

                for (const [, promiseSource] of item.queue.entries()) {
                    promiseSource.reject(err);
                }
            });
        }
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.queue.clear();
    }
}

export class WatDecorations {

    private disposables: Disposable[] = [];
    private modelDisposables: Disposable[] = [];
    private providers = new Map<TocOutline, Disposable>();

    constructor(private model: Model) {
        //this.addonOutlineProvider.getAddonOutlines().forEach(a=>this.disposables.push(new UnknownTocFileProvider(a!)));

        //const onEnablementChange = filterEvent(workspace.onDidChangeConfiguration, e => e.affectsConfiguration('git.decorations.enabled'));
        //onEnablementChange(this.update, this, this.disposables);
        this.update();
    }

    private update(): void {
        /* const enabled = workspace.getConfiguration('git').get('decorations.enabled'); */
        this.enable();
/*         if (enabled) {
            this.enable();
        } else {
            this.disable();
        } */
    }

    private enable(): void {
        //this.addonOutlineProvider.onCreateAddonOutline(this.onDidCreateAddonOutline, this, this.modelDisposables);
    }

    private disable(): void {
        this.modelDisposables = dispose(this.modelDisposables);
        this.providers.forEach(value => value.dispose());
        this.providers.clear();
    }

    private onDidCreateAddonOutline(addonOutline: TocOutline): void {
        const provider = new UnknownTocFileProvider(addonOutline);
        this.providers.set(addonOutline, provider);
    }

/*     private onDidCloseRepository(addonOutlineProvider: AddonOutlineProvider): void {
        const provider = this.providers.get(addonOutlineProvider);

        if (provider) {
            provider.dispose();
            this.providers.delete(addonOutline);
        }
    } */

    dispose(): void {
        this.disable();
        this.disposables = dispose(this.disposables);
    }
}