import {
	Command,
	commands as Commands,
	Event,
	EventEmitter,
	ExtensionContext,
	FileDecoration,
	FileDecorationProvider,
	FileSystemError,
	FileSystemWatcher,
	Position,
	ProviderResult,
	Range,
	RelativePattern,
	Selection,
	TextDocumentChangeEvent,
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

const regExList = {
	toc: {
		lines: /^(?<line>.*?)$/gm,
		metaData: /^## ?(?<tag>.+?): ?(?<value>[\S ]*?)$/gm,
		files: /^(?<file>[\S]+\.(?<ext>[a-z]+))/gm,
	},
	toc1: /(?:(?<line>^(?:^(?:## ?(?<metadata>(?<tagName>.+)(?:: )(?<tagValue>[\S ]+)))|^(?:(?:# )?#(?<keywordEnd>@end[a-z-]+@))|^(?:(?:# )?#(?<keywordStart>@[a-z-]+@))|^(?<comment># ?(?<text>[\S ]+))|^(?<file>[\S]+\.(?<ext>[a-z]+))))\n?|$(?<blankLine>[\n]))/gm
};

export class TocFile {

	tocData:Map<string,string> = new Map();
	tocDataRef:Map<string,number> = new Map()
	lines = new Map();
	addonFolder: Uri;
	files = new Map();
	//missingFiles: Map<string,Uri> = new Map();
	constructor(
		public tocUri: Uri,
		public tocText: string,
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
							this.tocDataRef.set(v.groups.tag,lineIndex)
						};
					});
				} else {
					const fileArray = [...tocLine.matchAll(regExList.toc.files)];
					if(fileArray.length > 0){
						fileArray.filter(v => Object.keys(v.groups!).length > 0).map(v => {
							if(v.groups){
								this.files.set(this.files.size + 1,v.groups.file);
								this.tocDataRef.set(v.groups.file,lineIndex)
							};
						});
					}
				}
			}
		});
	}
}

export class AddonOutlineExpandedField extends TreeItem {
	uri: Uri
	constructor(
		tocFile: TocFile,
		fieldType: string,
		tocFileUri: Uri,
		fieldName: string | TreeItemLabel,
		fieldValue: string,
		line: number,
	){
		super(fieldName);
		this.uri = tocFileUri.with({fragment: line.toString()})
		this.command = { command: 'vscode.open', title: "Open File", arguments: [this.uri,<TextDocumentShowOptions>{selection:new Range(line,0,line,999)}] }
		this.tooltip = fieldValue
		if(fieldType == 'file'){
			this.contextValue = 'file'
			const addonDirectory = Uri.parse(tocFileUri.fsPath.replace(Basename(tocFileUri.fsPath),''))
			const fileUri = Uri.parse(Join(addonDirectory.fsPath,fieldName.toString().replace(/\\/gm,'/')))
			this.resourceUri = fileUri
			if(!existsSync(this.resourceUri.fsPath)){
				this.iconPath = new ThemeIcon('error',new ThemeColor('testing.iconErrored'))
				this.description = 'Missing'
				this.tooltip = `Cannot find ${fieldName}`
			}
		} else if(fieldType == 'note'){
			this.description = fieldValue
			this.iconPath = new ThemeIcon('note')
		} else if(fieldType == 'interface'){
			this.description = fieldValue
			this.iconPath = new ThemeIcon('gear')
		} else {
			this.description = fieldValue
			this.iconPath = new ThemeIcon('field')
		}
	}
}
export class AddonOutlineField extends TreeItem {
	children?: TreeItem[]
	uri?: Uri;
	constructor(
		tocFile: TocFile,
		fieldName: string | TreeItemLabel,
		fieldValues: Map<string,string>,
		fieldType: string,
	){
		super(fieldName);
		let startLine =  tocFile.tocDataRef.get(fieldName.toString()) || tocFile.tocDataRef.get([...tocFile.tocDataRef.keys()][0])
		let endLine = tocFile.tocDataRef.get([...tocFile.tocDataRef.keys()][tocFile.tocDataRef.size - 1])
		this.description = fieldValues.size > 1 ? fieldValues.size.toString() : fieldValues.get(fieldName.toString())
		this.collapsibleState = TreeItemCollapsibleState.None
		this.children = []
		this.uri = tocFile.tocUri
		this.iconPath = new ThemeIcon('tag')
		if(fieldValues.size > 1 || (fieldType == 'files') || (fieldType == 'notes') || (fieldType == 'interface')) {
			this.description = fieldValues.size.toString()
			this.collapsibleState = TreeItemCollapsibleState.Collapsed
			for(let child of fieldValues){
				let newItem:AddonOutlineExpandedField
				const itemName = child[0]
				const itemValue = child[1]
				let lineNumber = tocFile.tocDataRef.get(itemName.toString())!
				if(fieldType == 'files'){
					lineNumber = tocFile.tocDataRef.get(itemValue)!
					this.iconPath = new ThemeIcon('files',new ThemeIcon('symbolIcon.fileForeground'));
					newItem = new AddonOutlineExpandedField(tocFile,'file',tocFile.tocUri,itemValue,itemValue,lineNumber)
				} else if (fieldType == 'notes') {
					this.iconPath = new ThemeIcon('notebook')
					newItem = new AddonOutlineExpandedField(tocFile,'note',tocFile.tocUri, itemName, itemValue, lineNumber)
				} else if (fieldType == 'interface'){
					this.iconPath = new ThemeIcon('settings')
					newItem = new AddonOutlineExpandedField(tocFile,'interface',tocFile.tocUri,itemName,itemValue,lineNumber)
				} else {
					this.iconPath = new ThemeIcon('plus')
					newItem = new AddonOutlineExpandedField(tocFile,itemName,tocFile.tocUri,itemName,itemValue,lineNumber)
				}
				this.children.push(newItem!)
			}
		} else {
			this.tooltip = fieldValues.get(fieldName.toString())
			this.command = { 
				command: 'vscode.open',
				title: "Open File",
				arguments: [
					tocFile.tocUri,
					{
						selection:new Range(startLine!,0,fieldValues.size > 1 ? endLine! : startLine!,999)
					}
				]
			}
		}
	}
}
export class AddonOutline extends TreeItem {
	children?: TreeItem[] = [];
	uri?: Uri;
	constructor(
		tocFile: TocFile,
		addonTitle: string,
	) {
		super(addonTitle);
		this.children = [];
		this.uri = tocFile.tocUri;
		this.collapsibleState = TreeItemCollapsibleState.Collapsed;
		const fieldKeys = [...tocFile.tocData.keys()];
		let keysCompleted = new Map();
		for(let field of tocFile.tocData){
			const fieldName = field[0];
			const fieldValue = field[1]
			if(keysCompleted.has(fieldName) === false){
				const similarFields = fieldKeys.filter(k => {
					return ((keysCompleted.has(k) === false) && k.indexOf(fieldName) > -1);
				});
				const similarFieldsMap = new Map();
				if(similarFields.length > 1){
					similarFields.map(f => {
						similarFieldsMap.set(f,tocFile.tocData.get(f));
						keysCompleted.set(f,f);
					});
				} else {
					similarFieldsMap.set(fieldName,fieldValue)
				}
				this.children.push(new AddonOutlineField(
					tocFile,
					fieldName,
					similarFieldsMap,
					fieldName.split('-',1)[0].toLowerCase(),
				));
			}
		}
		this.children.push(new AddonOutlineField(
			tocFile,
			'Files',
			tocFile.files,
			'files',
		))
	}
}

export class AddonOutlineProvider implements TreeDataProvider<AddonOutline> {

	//private tree: json.Node;
	private editor: TextEditor;
	private tocFiles:Map<string,TocFile> = new Map();

	private addTocFile(tocFile: TocFile) {
		this.tocFiles.set(tocFile.tocUri.toString(),tocFile);
	}
	constructor(private context: ExtensionContext) {
		this.editor = Window.activeTextEditor!;
		Window.onDidChangeActiveTextEditor(() => this.refresh());
		this.refresh();

	}
	checkTocsMissingFiles(uri: Uri){

	}
	openFile(file:AddonOutlineExpandedField):void{
		Workspace.openTextDocument(file.resourceUri!)
	}

	refresh(tocUriStr?: Uri) {
		Workspace.findFiles(new RelativePattern(Workspace.workspaceFolders![0],'**/*.toc')).then(tocUris => {
			tocUris.map(tocUri => {
				Workspace.fs.readFile(tocUri).then(tocFileContents => {
					let newTocEntry = new TocFile(tocUri, tocFileContents.toString());
					this.addTocFile(newTocEntry);
				}, reason => {
					throw Error(reason);
				});
			});
		});
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

	getChildren(element?: AddonOutline): Thenable<TreeItem[]> {

		if(element && element.children && element.children.length > 0) {
			return Promise.resolve(element.children);
		}
		return Promise.resolve([...this.tocFiles.values()].map((tocFile)=>{
			const addonTitle = tocFile.tocData.get("Title") || Basename(tocFile.tocUri.toString()).substring(0,Basename(tocFile.tocUri.toString()).length - 4);
			return new AddonOutline(tocFile,addonTitle);
		}));
	}

	getTreeItem(element: AddonOutline): TreeItem {
		return element;
	}

	select(range: Range) {
		this.editor.selection = new Selection(range.start, range.end);
	}
}
