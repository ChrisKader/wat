import {
	Disposable,
	Event,
	EventEmitter,
	ExtensionContext,
	Range,
	RelativePattern,
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
	workspace as Workspace
} from 'vscode';
import {
	basename as Basename,
	dirname as DirName,
	join as Join,
} from 'path';
import { existsSync } from 'fs';
import { dispose } from './util';
const regExList = {
	toc: {
		lines: /^(?<line>.*?)$/gm,
		metaData: /^## ?(?<tag>.+?): ?(?<value>[\S ]*?)$/gm,
		files: /^(?<file>[\S]+\.(?<ext>[a-z]+))/gm,
	},
	toc1: /(?:(?<line>^(?:^(?:## ?(?<metadata>(?<tagName>.+)(?:: )(?<tagValue>[\S ]+)))|^(?:(?:# )?#(?<keywordEnd>@end[a-z-]+@))|^(?:(?:# )?#(?<keywordStart>@[a-z-]+@))|^(?<comment># ?(?<text>[\S ]+))|^(?<file>[\S]+\.(?<ext>[a-z]+))))\n?|$(?<blankLine>[\n]))/gm
};

export class TocFile {
	private _onNewMissingFile = new EventEmitter<Uri[]>();
	readonly onNewMissingFile: Event<Uri[]> = this._onNewMissingFile.event;
	tocData:Map<string,string> = new Map();
	tocDataRef:Map<string,number> = new Map();
	lines = new Map();
	addonFolder: Uri;
	files = new Map();
	missingFiles: Map<string,Uri> = new Map();
	addonTitle: string;
	constructor(
		public tocUri: Uri,
		public tocText: string,
		private tocOutline: TocOutline
	) {
		this.addonFolder = Uri.from({
			scheme: 'file',
			authority: '',
			path: DirName(tocUri.fsPath),
			query: '',
			fragment: '',
		});

		[...tocText.matchAll(regExList.toc.lines)].map(v => v.groups?.line).map((tocLine,lineIndex) => {
			if(tocLine){
				const metaDataArray = [...tocLine.matchAll(regExList.toc.metaData)];
				if(metaDataArray.length > 0){
					metaDataArray.filter(v => Object.keys(v.groups!).length > 0).map(v => {
						if(v.groups){
							this.tocData.set(v.groups.tag,v.groups.value);
							this.tocDataRef.set(v.groups.tag,lineIndex);
						};
					});
				} else {
					const fileArray = [...tocLine.matchAll(regExList.toc.files)];
					if(fileArray.length > 0){
						fileArray.filter(v => Object.keys(v.groups!).length > 0).map(v => {
							if(v.groups){
								this.files.set(this.files.size + 1,v.groups.file);
								this.tocDataRef.set(v.groups.file,lineIndex);
							};
						});
					}
				}
			}
		});

		this.addonTitle = this.tocData.get("Title") || Basename(this.tocUri.toString()).substring(0, Basename(this.tocUri.toString()).length - 4);
	}
	getMissingFiles(){
		return this.missingFiles.entries()
	}
	async addMissingFiles(uris: Uri[]){
		const rtnVal:Uri[] =  []
		uris.map(u =>{
			console.log(`tocOutline.ts > TocFile > addMissingFiles ${u}`);
			this.missingFiles.set(u.fsPath.toLowerCase(), u);
			rtnVal.push(this.missingFiles.get(u.fsPath.toLowerCase())!);
		})
		console.log(`tocOutline.ts > TocFile > addMissingFile _onNewMissingFile ${rtnVal}`);
		this._onNewMissingFile.fire(rtnVal);
	}

	removeMissingFiles(uris: Uri[]){
		return uris.map(u => {
			const rtnObj = {
				status: this.missingFiles.delete(u.fsPath.toLowerCase()),
				uri: u
			};
			return rtnObj;
		});
	}
	async checkMissingFile(uri: string){
		return this.missingFiles.has(uri.toLowerCase())
	}
	checkMissingFiles(uri: string[]){
		return new Promise<Set<string>>((resolve, reject) => {
			resolve(new Set([...this.missingFiles.keys()].filter(v => {
				return uri.some(u => u.toLowerCase() === v);
			}).map(k => this.missingFiles.get(k)?.fsPath!)));
		});

	}
}

export class TocOutlineExpandedField extends TreeItem {
	uri: Uri;
	constructor(
		tocFile: TocFile,
		fieldType: string,
		tocFileUri: Uri,
		fieldName: string | TreeItemLabel,
		fieldValue: string,
		line: number,
	){
		super(fieldName);
		this.uri = tocFileUri.with({fragment: line.toString()});
		this.command = { command: 'vscode.open', title: "Open File", arguments: [this.uri,<TextDocumentShowOptions>{selection:new Range(line,0,line,999)}] };
		this.tooltip = fieldValue;
		if(fieldType === 'file'){
			this.contextValue = 'file';
			const addonDirectory = Uri.parse(tocFileUri.fsPath.replace(Basename(tocFileUri.fsPath),''));
			const fileUri = Uri.parse(Join(addonDirectory.fsPath,fieldName.toString().replace(/\\/gm,'/')));
			this.resourceUri = fileUri;
			if(!existsSync(this.resourceUri.fsPath)){
				tocFile.addMissingFiles([this.resourceUri]);
				this.iconPath = new ThemeIcon('error',new ThemeColor('testing.iconErrored'));
				this.description = 'Missing';
				this.tooltip = `Cannot find ${fieldName}`;
			}
		} else if(fieldType === 'note'){
			this.description = fieldValue;
			this.iconPath = new ThemeIcon('note');
		} else if(fieldType === 'interface'){
			this.description = fieldValue;
			this.iconPath = new ThemeIcon('gear');
		} else {
			this.description = fieldValue;
			this.iconPath = new ThemeIcon('field');
		}
	}
}
export class TocOutlineField extends TreeItem {
	children?: TreeItem[];
	uri?: Uri;
	constructor(
		tocFile: TocFile,
		fieldName: string | TreeItemLabel,
		fieldValues: Map<string,string>,
		fieldType: string,
	){
		super(fieldName);
		let startLine =  tocFile.tocDataRef.get(fieldName.toString()) || tocFile.tocDataRef.get([...tocFile.tocDataRef.keys()][0]);
		let endLine = tocFile.tocDataRef.get([...tocFile.tocDataRef.keys()][tocFile.tocDataRef.size - 1]);
		this.description = fieldValues.size > 1 ? fieldValues.size.toString() : fieldValues.get(fieldName.toString());
		this.collapsibleState = TreeItemCollapsibleState.None;
		this.children = [];
		this.uri = tocFile.tocUri;
		this.iconPath = new ThemeIcon('tag');
		if(fieldValues.size > 1 || (fieldType === 'files') || (fieldType === 'notes') || (fieldType === 'interface')) {
			this.description = fieldValues.size.toString();
			this.collapsibleState = TreeItemCollapsibleState.Collapsed;
			for(let child of fieldValues){
				let newItem:TocOutlineExpandedField;
				const itemName = child[0];
				const itemValue = child[1];
				let lineNumber = tocFile.tocDataRef.get(itemName.toString())!;
				if(fieldType === 'files'){
					lineNumber = tocFile.tocDataRef.get(itemValue)!;
					this.iconPath = new ThemeIcon('files',new ThemeIcon('symbolIcon.fileForeground'));
					newItem = new TocOutlineExpandedField(tocFile,'file',tocFile.tocUri,itemValue,itemValue,lineNumber);
				} else if (fieldType === 'notes') {
					this.iconPath = new ThemeIcon('notebook');
					newItem = new TocOutlineExpandedField(tocFile,'note',tocFile.tocUri, itemName, itemValue, lineNumber);
				} else if (fieldType === 'interface'){
					this.iconPath = new ThemeIcon('settings');
					newItem = new TocOutlineExpandedField(tocFile,'interface',tocFile.tocUri,itemName,itemValue,lineNumber);
				} else {
					this.iconPath = new ThemeIcon('plus');
					newItem = new TocOutlineExpandedField(tocFile,itemName,tocFile.tocUri,itemName,itemValue,lineNumber);
				}
				this.children.push(newItem!);
			}
		} else {
			this.tooltip = fieldValues.get(fieldName.toString());
			this.command = { 
				command: 'vscode.open',
				title: "Open File",
				arguments: [
					tocFile.tocUri,
					{
						selection:new Range(startLine!,0,fieldValues.size > 1 ? endLine! : startLine!,999)
					}
				]
			};
		}
	}
}

export class TocOutlineTreeItem extends TreeItem {
	children?: TreeItem[];
	constructor(
		tocFile: TocFile
	){
		super(tocFile.addonTitle);
		const fieldKeys = [...tocFile.tocData.keys()];
		this.collapsibleState = TreeItemCollapsibleState.Collapsed;
		let keysCompleted = new Map();
		this.children = [];
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
				} else {
					similarFieldsMap.set(fieldName, fieldValue);
				}
				this.children.push(new TocOutlineField(
					tocFile,
					fieldName,
					similarFieldsMap,
					fieldName.split('-', 1)[0].toLowerCase(),
				));
			}
		}
		this.children.push(new TocOutlineField(
			tocFile,
			'Files',
			tocFile.files,
			'files',
		));
	}
}
export class TocOutline implements Disposable {

	private disposables: Disposable[] = [];
	uri: Uri;
	tocFile: TocFile;
	treeItem: TocOutlineTreeItem;
	private _onAddTocFile = new EventEmitter<TocOutline>();
	readonly onAddTocFile: Event<TocOutline> = this._onAddTocFile.event;
	constructor(
		tocFileUri: Uri,
		tocFileContents: string,
	) {
		this.tocFile = new TocFile(tocFileUri, tocFileContents, this);
		Workspace.onDidCreateFiles((e) => this.tocFile?.removeMissingFiles(e.files.map(e=> e)));
		this.uri = this.tocFile.tocUri;
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

	private _onDidChangeTreeData: EventEmitter<TocOutlineTreeItem | undefined | null | void> = new EventEmitter<TocOutlineTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<TocOutlineTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	//private tree: json.Node;
	private editor: TextEditor;

	private watTrees:Map<string,TocOutline> = new Map();

	public addTocOutline(watTree: TocOutline) {
		this.watTrees.set(watTree.tocFile.tocUri.fsPath, watTree);
		//this._onCreateTocOutline.fire(watTree);
		this._onDidChangeTreeData.fire(watTree.treeItem);
	}
	
	constructor() {
		this.editor = Window.activeTextEditor!;
		this.refresh();

	}
	getTocOutlineTreeItems(){
		return [...this.watTrees].map(v=>{
			return v[1].treeItem;
		});
	}
	public getTocOutlines(){
		return [...this.watTrees].map(v=>v[1]);
	}
	public watTree(uri: Uri) {
		return this.watTrees.get(uri.toString());
	}
	checkTocsMissingFiles(uri: Uri){
	}
	openFile(file:TocOutlineExpandedField):void{
		Workspace.openTextDocument(file.resourceUri!);
	}

	refresh(tocUriStr?: Uri) {
		
		//.findFiles(new RelativePattern(Workspace.workspaceFolders![0],'**/*.toc')).then(tocUris => {
/* 			tocUris.map(tocUri => {
				Workspace.fs.readFile(tocUri).then(tocFileContents => {
					this.addTocOutline(new TocOutline(tocUri, tocFileContents.toString()));
				}, reason => {
					throw Error(reason);
				});
			});
		}); */
		this._onDidChangeTreeData.fire();
		if (tocUriStr) {
		}
	}

	rename(offset: number): void {
		Window.showInputBox({ placeHolder: 'Enter the new label' })
		.then(value => {
			if (value !== null && value !== undefined) {
			}
		});
	}

	getChildren(element?: TocOutlineTreeItem): Thenable<TreeItem[]> {

		if(element && element.children && element.children.length > 0) {
			return Promise.resolve(element.children);
		}
		return Promise.resolve(this.getTocOutlineTreeItems());
	}

	getTreeItem(element: TocOutlineTreeItem): TreeItem {
		return element;
	}

	select(range: Range) {
		this.editor.selection = new Selection(range.start, range.end);
	}
	dispose(){

	}
}
