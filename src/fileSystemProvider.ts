import { Disposable, Event, EventEmitter, FileChangeEvent, FileStat, FileSystemProvider, FileType, Uri, workspace as Workspace} from "vscode";
import { Model } from "./model";
import { pathEquals, EmptyDisposable } from "./util";
interface CacheRow {
    uri: Uri;
    timestamp: number;
}
const THREE_MINUTES = 1000 * 60 * 3;
const FIVE_MINUTES = 1000 * 60 * 5;
export class WatFileSystemProvider implements FileSystemProvider {

	private _onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
	readonly onDidChangeFile: Event<FileChangeEvent[]> = this._onDidChangeFile.event;

	private changedTocRoots = new Set<string>();
	private cache = new Map<string, CacheRow>();
	private mtime = new Date().getTime();
	private disposables: Disposable[] = [];

	constructor(private model: Model) {
		this.disposables.push(
            //model.onDidOpenTocFile(this.onDidOpenTocFile, this),
			//model.onDidChangeOriginalResource(this.onDidChangeOriginalResource, this),
			Workspace.registerFileSystemProvider('wat', this, { isReadonly: true, isCaseSensitive: true }),
		);

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

	private cleanup(): void {
		const now = new Date().getTime();
		const cache = new Map<string, CacheRow>();

		for (const row of this.cache.values()) {
            const path = row.uri.fsPath;
			const isOpen = Workspace.textDocuments
				.filter(d => d.uri.scheme === 'file')
				.some(d => pathEquals(d.uri.fsPath, path));

			if (isOpen || now - row.timestamp < THREE_MINUTES) {
				cache.set(row.uri.toString(), row);
			} else {
				// TODO: should fire delete events?
			}
		}

		this.cache = cache;
	}

	watch(): Disposable {
		return EmptyDisposable;
	}

	async stat(uri: Uri): Promise<FileStat> {
		await this.model.isInitialized;

		return Promise.resolve(Workspace.fs.stat(uri));
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

	readDirectory(): Thenable<[string, FileType][]> {
		throw new Error('Method not implemented.');
	}

	createDirectory(): void {
		throw new Error('Method not implemented.');
	}

	async readFile(uri: Uri): Promise<Uint8Array> {
		await this.model.isInitialized;

        const timestamp = new Date().getTime();
        const cacheValue: CacheRow = { uri, timestamp };

        this.cache.set(uri.toString(), cacheValue);

        try {
            return await Workspace.fs.readFile(uri);
        } catch (err) {
            return new Uint8Array(0);
        }
	}

	writeFile(): void {
		throw new Error('Method not implemented.');
	}

	delete(): void {
		throw new Error('Method not implemented.');
	}

	rename(): void {
		throw new Error('Method not implemented.');
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}