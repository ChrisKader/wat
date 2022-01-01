import {
	Disposable,
	Event,
	EventEmitter,
	ExtensionContext,
	Range,
	Selection,
	TextDocumentShowOptions,
	TextEditor,
	ThemeColor,
	ThemeIcon,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	TreeItemLabel,
	Uri,
	window as Window,
	workspace,
	workspace as Workspace
} from 'vscode';
import {
	basename as Basename,
	dirname as Dirname,
	join as Join,
} from 'path';
import { dispose } from './util';
const regExList = {
	toc: {
		lines: /^(?<line>.*?)$\r?\n?/gm,
		metaData: /^## ?(?<tag>.+?): ?(?<value>[\S ]*?)$/gm,
		files: /^(?<file>[\S]+\.(?<ext>[a-z]+))/gm,
	},
	toc1: /(?:(?<line>^(?:^(?:## ?(?<metadata>(?<tagName>.+)(?:: )(?<tagValue>[\S ]+)))|^(?:(?:# )?#(?<keywordEnd>@end[a-z-]+@))|^(?:(?:# )?#(?<keywordStart>@[a-z-]+@))|^(?<comment># ?(?<text>[\S ]+))|^(?<file>[\S]+\.(?<ext>[a-z]+))))\n?|$(?<blankLine>[\n]))/gm
};

import { WatDecorationProvider } from './decorationProvider';

let extContext: ExtensionContext;

interface TocLineRef { line: number, index: number }

function addonBaseDirectory(tocUri: Uri) {
	return tocUri.with({ path: Dirname(tocUri.path) })
}

let metaDataIconMap: {
	[key: string]: string | Uri | {
		light: string | Uri;
		dark: string | Uri;
	} | ThemeIcon | undefined
} = {}
export class TocFile {
	private _onNewMissingFile = new EventEmitter<Uri[]>();
	readonly onNewMissingFile: Event<Uri[]> = this._onNewMissingFile.event;
	tocData: Map<string, string> = new Map();
	tocDataRef: Map<string, TocLineRef> = new Map();
	lines = new Map();
	addonFolder: Uri;
	files = new Map();
	missingFiles: Map<string, Uri> = new Map();
	addonTitle: string = ''
	constructor(
		public tocUri: Uri,
		public tocFileContents: string,
		private tocOutline: TocOutline
	) {
		this.addonFolder = Uri.from({
			scheme: 'file',
			authority: '',
			path: Dirname(tocUri.fsPath),
			query: '',
			fragment: '',
		});
		[...this.tocFileContents.matchAll(regExList.toc.lines)].map(v => {
			return {
				lineText: v.groups!.line,
				textIndex: v.index!
			}
		}).map((tocLine: { lineText: string, textIndex: number }, lineIndex) => {
			if (tocLine) {
				const metaDataArray = [...tocLine.lineText.matchAll(regExList.toc.metaData)];
				if (metaDataArray.length > 0) {
					metaDataArray.filter(v => Object.keys(v.groups!).length > 0).map(v => {
						if (v.groups) {
							const valueIndex = tocLine.lineText.indexOf(v.groups.value)
							this.tocData.set(v.groups.tag, v.groups.value);
							this.tocDataRef.set(v.groups.tag, { line: lineIndex, index: valueIndex >= 0 ? valueIndex : tocLine.textIndex });
						};
					});
				} else {
					const fileArray = [...tocLine.lineText.matchAll(regExList.toc.files)];
					if (fileArray.length > 0) {
						fileArray.filter(v => Object.keys(v.groups!).length > 0).map(v => {
							if (v.groups) {
								const valueIndex = tocLine.lineText.indexOf(v.groups.file)
								this.files.set(v.groups.file, Uri.joinPath(addonBaseDirectory(tocUri), v.groups.file.replace(/\\/gm, '/')).toString(false));
								this.tocDataRef.set(v.groups.file, { line: lineIndex, index: valueIndex >= 0 ? valueIndex : tocLine.textIndex });
							};
						});
					}
				}
			}
		});

		this.addonTitle = this.tocData.get("Title") || Basename(this.tocUri.toString()).substring(0, Basename(this.tocUri.toString()).length - 4);

	}
	getMissingFiles() {
		return this.missingFiles.entries()
	}
	async addMissingFiles(uris: Uri[]) {
		const rtnVal: Uri[] = []
		uris.map(u => {
			this.missingFiles.set(u.fsPath.toLowerCase(), u);
			rtnVal.push(this.missingFiles.get(u.fsPath.toLowerCase())!);
		})
		this._onNewMissingFile.fire(rtnVal);
	}

	removeMissingFiles(uris: Uri[]) {
		return uris.map(u => {
			const rtnObj = {
				status: this.missingFiles.delete(u.fsPath.toLowerCase()),
				uri: u
			};
			return rtnObj;
		});
	}
	async checkMissingFile(uri: string) {
		return this.missingFiles.has(uri.toLowerCase())
	}
	checkMissingFiles(uri: string[]) {
		return new Promise<Set<string>>((resolve, reject) => {
			resolve(new Set([...this.missingFiles.keys()].filter(v => {
				return uri.some(u => u.toLowerCase() === v);
			}).map(k => this.missingFiles.get(k)?.fsPath!)));
		});

	}

	async checkFileExists(uri: Uri) {
		const v = (await Workspace.fs.stat(uri)).ctime;
		return v > 0;
	}
}

class TocOutlineMetaDataEntry extends TreeItem {
	children?: TreeItem[]
	file?: boolean = false;
	constructor(
		fieldLabel: string,
		fieldDescription: string,
		tocFileUri: Uri,
		fieldType: string,
		fieldValues?: Map<string, string>,
	) {
		super(fieldLabel)
		const lowerFieldLabel = fieldLabel.toLowerCase()
		if (fieldType === 'notes') {
			if (fieldValues) {
				this.iconPath = metaDataIconMap['notes']
			} else {
				this.iconPath = metaDataIconMap['note']
			}
		} else if (lowerFieldLabel.indexOf('interface') > -1) {
			if (fieldValues) {
				this.iconPath = metaDataIconMap['interface-group'];
			} else {
				this.iconPath = metaDataIconMap[lowerFieldLabel] || metaDataIconMap['default']
			}
		} else {
			this.iconPath = metaDataIconMap[lowerFieldLabel] || metaDataIconMap['default']
		}
		this.collapsibleState = (fieldType === 'metadata' || fieldValues) ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None
		this.children = (fieldType === 'metadata' || fieldValues) ? [] : undefined
		this.description = fieldType !== 'metadata' ? fieldDescription : undefined
		if (fieldValues) {
			for (let field of fieldValues) {
				const fieldName = field[0];
				const fieldValue = field[1];
				this.children?.push(new TocOutlineMetaDataEntry(fieldName, fieldValue, tocFileUri, fieldType))
			}
		}
	}
}

class TocOutlineFileList extends TreeItem {

	children?: TreeItem[]
	file?: boolean = true
	constructor(
		fieldLabel: string,
		fieldDescription: string,
		tocFileUri: Uri,
		fieldType: string,
		fieldValues?: Map<string, string>,
	) {
		super(fieldLabel)
		this.description = fieldDescription;
		if (!fieldValues) {
			const fileUri = Uri.joinPath(addonBaseDirectory(tocFileUri), fieldLabel.replace(/\\/gm, '/'))
			this.resourceUri = fileUri
			this.collapsibleState = TreeItemCollapsibleState.None
			this.label = Basename(fieldLabel)
			this.description = Dirname(fieldLabel).length > 1 ? Dirname(fieldLabel) : ''
			Workspace.fs.stat(fileUri).then((fileStat) => {
				this.command = { command: 'vscode.open', title: "Open File", arguments: [fileUri] };
				this.resourceUri = fileUri;
				if (fileUri.toString().indexOf('.xml') > -1) {
					Workspace.fs.readFile(fileUri).then((v) => {
						const xmlFileText = v.toString();
						const xmlIncludeSearch = [...xmlFileText.matchAll(/<(?<action>(?:Script)|(?:Include)) file="(?<filename>.+)"/gm)].filter(v => Object.keys(v.groups!).length > 0)
						if (xmlIncludeSearch.length > 0) {
							this.children = []
							this.collapsibleState = TreeItemCollapsibleState.Collapsed
						}
						xmlIncludeSearch.map(v => {
							if (v.groups) {
								let label = v.groups.filename
								let description = Dirname(v.groups.action)
								this.children?.push(new TocOutlineFileList(label, description, fileUri, 'file'))
							}
						})
					})
				}
			}, (e) => {
				this.command = undefined
			})
		} else {
			this.collapsibleState = TreeItemCollapsibleState.Collapsed
			this.children = []
			this.iconPath = metaDataIconMap['files']
			for (let field of fieldValues) {
				const fieldName = field[0];
				const fieldValue = field[1];
				this.children.push(new TocOutlineFileList(fieldName, fieldValue, tocFileUri, fieldType))
			}
		}
	}
}

export class TocOutlineTreeItem extends TreeItem {
	public children?: [TocOutlineMetaDataEntry | TocOutlineFileList];
	constructor(
		tocFile: TocFile
	) {
		super(tocFile.addonTitle);
		const fieldKeys = [...tocFile.tocData.keys()];
		this.collapsibleState = TreeItemCollapsibleState.Collapsed;
		let keysCompleted = new Map();
		this.children = [new TocOutlineMetaDataEntry('Metadata', 'Metadata', tocFile.tocUri, 'metadata')];
		for (let field of tocFile.tocData) {
			const fieldName = field[0];
			const fieldValue = field[1];
			if (keysCompleted.has(fieldName) === false) {
				const similarFields = fieldKeys.filter(k => {
					return ((keysCompleted.has(k) === false) && k.indexOf(fieldName) > -1);
				});
				const similarFieldsMap = new Map();
				if (similarFields.length > 1) {
					similarFields.map(f => {
						similarFieldsMap.set(f, tocFile.tocData.get(f));
						keysCompleted.set(f, f);
					});
					this.children[0].children?.push(new TocOutlineMetaDataEntry(
						fieldName,
						similarFieldsMap.size.toString(),
						tocFile.tocUri,
						fieldName === 'Notes' ? 'notes' : 'default',
						similarFieldsMap
					));
				} else {
					this.children[0].children?.push(new TocOutlineMetaDataEntry(
						fieldName,
						fieldValue,
						tocFile.tocUri,
						'default'
					));
				}
			}
		}
		this.children.push(new TocOutlineFileList(
			'Files',
			tocFile.files.size.toString(),
			tocFile.tocUri,
			'file',
			tocFile.files,
		));
	}

}

export class TocOutline implements Disposable {
	private _onAddTocFile = new EventEmitter<TocOutline>();
	readonly onAddTocFile: Event<TocOutline> = this._onAddTocFile.event;

	private disposables: Disposable[] = [];

	public tocFile: TocFile;
	public treeItem: TocOutlineTreeItem;

	constructor(
		public tocFileUri: Uri,
		public tocFileContents: string,
	) {


		this.tocFile = new TocFile(tocFileUri, tocFileContents, this);
		Workspace.onDidCreateFiles((e) => this.tocFile?.removeMissingFiles(e.files.map(e => e)));

		this.treeItem = new TocOutlineTreeItem(this.tocFile);
		this._onAddTocFile.fire(this);
	}

	dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}

export class TocOutlineProvider implements TreeDataProvider<TocOutlineTreeItem> {
	private _onCreateTocOutline = new EventEmitter<TocOutline>();
	readonly onCreateTocOutline: Event<TocOutline> = this._onCreateTocOutline.event;

	private _onDidChangeTreeData: EventEmitter<TreeItem | undefined | null | void> = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private disposables: Disposable[] = [];

	private tocOutlines: Map<string, TocOutline> = new Map();

	constructor(public context: ExtensionContext) {
		extContext = context
		this.refresh();
		metaDataIconMap = {
			'author': new ThemeIcon('account'),
			'default': new ThemeIcon('file-code'),
			'dependencies': new ThemeIcon('package'),
			'files': new ThemeIcon('files'),
			'optionaldeps': new ThemeIcon('package'),
			'version': new ThemeIcon('versions'),
			'interface': Join(extContext!.extensionPath, 'resources/wow.svg'),
			'interface-group': new ThemeIcon('settings'),
			'interface-bcc': Join(extContext!.extensionPath, 'resources/wowc.svg'),
			'interface-classic': Join(extContext!.extensionPath, 'resources/wowc.svg'),
			'savedvariables': new ThemeIcon('variable'),
			'note': new ThemeIcon('note'),
			'notes': new ThemeIcon('notebook'),
		}
	}

	public async addTocFile(uri: Uri) {
		const tocOutline = new TocOutline(uri, (await Workspace.fs.readFile(uri)).toString())
		const existed = !(typeof (this.getTocOutline(uri)) === 'undefined')
		this.tocOutlines.set(tocOutline.tocFile.tocUri.fsPath, tocOutline);
		this._onDidChangeTreeData.fire(undefined);

	}

	public openFile(s: TocOutlineMetaDataEntry) {
		console.log(s.resourceUri!)
		if (!s.resourceUri) return;
		Workspace.openTextDocument(s.resourceUri)
	}

	public getTocOutlineTreeItems() {
		return [...this.tocOutlines].map(v => {
			return v[1].treeItem;
		})
	}

	public getTocOutline(uri: Uri) {
		return this.tocOutlines.get(uri.fsPath)
	}

	public getTocOutlines(uri?: Uri) {
		if (uri) {
			return this.tocOutlines.get(uri.fsPath);
		} else {
			return [...this.tocOutlines].map(v => v[1]);
		}
	}

	public refresh(TreeItem?: TreeItem) {
		if (TreeItem) {
			this._onDidChangeTreeData.fire(TreeItem);
			console.log(TreeItem)
		} else {
			this._onDidChangeTreeData.fire();
		}
	}

	public rename(offset: number): void {
		Window.showInputBox({ placeHolder: 'Enter the new label' })
			.then(value => {
				if (value !== null && value !== undefined) {
				}
			});
	}

	public getChildren(element?: TocOutlineTreeItem): Thenable<TreeItem[]> {

		if (element && element.children) {
			return Promise.resolve(element.children);
		}
		return Promise.resolve(this.getTocOutlineTreeItems());
	}

	public getTreeItem(element: TocOutlineTreeItem): TreeItem {
		return element;
	}

	dispose() {
		this.disposables = dispose(this.disposables);
	}
}
