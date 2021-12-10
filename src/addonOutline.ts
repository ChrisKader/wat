import {
	Command,
	commands as Commands,
	Event,
	EventEmitter,
	ExtensionContext,
	FileDecoration,
	ProviderResult,
	Range,
	Selection,
	TextDocumentChangeEvent,
	TextEditor,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	TreeItemLabel,
	Uri,
	window as Window,
	workspace,
	workspace as Workspace
} from 'vscode';
import * as path from 'path';
import { timeStamp } from 'console';
import { fstat } from 'fs';

const regExList = {
	toc: {
		lines: /^(?<line>.*?)$/gm,
		metaData: /^## ?(?<tag>.+?): ?(?<value>[\S ]*?)$/gm,
		files: /^(?<file>[\S]+\.(?<ext>[a-z]+))/gm,
	},
	toc1: /(?:(?<line>^(?:^(?:## ?(?<metadata>(?<tagName>.+)(?:: )(?<tagValue>[\S ]+)))|^(?:(?:# )?#(?<keywordEnd>@end[a-z-]+@))|^(?:(?:# )?#(?<keywordStart>@[a-z-]+@))|^(?<comment># ?(?<text>[\S ]+))|^(?<file>[\S]+\.(?<ext>[a-z]+))))\n?|$(?<blankLine>[\n]))/gm
};
//(^.*?$)
//(?:^## ?(?<metadata>.+$))
const headerFields = {
	interface: [
		{
			toc: 'Interface',
			friendly: 'Interface',
		},
		{
			toc: 'Interface-Classic',
			friendly: 'Interface Classic',
		},
		{
			toc: 'Interface-BCC',
			friendly: 'Interface BCC',
		}
	],
	title: [
		{
			toc: 'Title',
			friendly: 'Title',
		}
	],
	author: [{
		toc: 'Author',
		friendly: 'Author',
	}],
	version: [{
		toc: 'Version',
		friendly: 'Version',
	}],
	loadOnDemand: [{
		toc: 'Load On Demand',
		friendly: 'Load On Demand',
	}],
	secure: [{
		toc: 'Secure',
		friendly: 'Secure',
	}],
	defaultState: [{
		toc: 'Default State',
		friendly: 'Default State',
	}],
	notes: [{
		toc: 'Notes',
		friendly: 'Notes',
	}],
	dependencies: [{
		toc: 'Dependencies',
		friendly: 'Dependencies',
	}],
	optionalDependencies: [{
		toc: 'OptionalDeps',
		friendly: 'Optional Dependencies',
	}],
	loadWith: [{
		toc: 'LoadWith',
		friendly: 'Load With',
	}],
	loadManagers: [{
		toc: 'LoadManagers',
		friendly: 'Load Managers',
	}],
	savedVariables: [{
		toc: 'SavedVariables',
		friendly: 'Saved Variables',
	}],
	savedVariablesPerCharacter: [{
		toc: 'SavedVariabesPerChar',
		friendly: 'Saved Variabes Per Character',
	}],
	files: [{
		toc: 'Files',
		friendly: 'Files',
	}],
};
export class TocDataEntry extends Map{
	
}
export class TocFile {

	tocData:Map<string,string> = new Map();

		/* title: new Map(),
		author: new Map(),
		version: new Map(),
		entryType: new Map(),
		loadOnDemand: new Map(),
		secure: new Map(),
		defaultState: new Map(),
		notes: new Map(),
		thirdParty: new Map(),
		dependencies: new Map(),
		optionalDependencies: new Map(),
		loadWith: new Map(),
		loadManagers: new Map(),
		savedVariables: new Map(),
		savedVariablesPerCharacter: new Map(),
		files: new Map(), */

	lines = new Map();
	addonFolder: string;
	files = new Map();
	constructor(
		public tocUri: Uri,
		public tocText: string,
	) {
		this.addonFolder = path.dirname(tocUri.fsPath);

		[...tocText.matchAll(regExList.toc.lines)].map(v => v.groups?.line).map(tocLine => {
			if(tocLine){
				const metaDataArray = [...tocLine.matchAll(regExList.toc.metaData)];
				if(metaDataArray.length > 0){
					metaDataArray.filter(v => Object.keys(v.groups!).length > 0).map(v => {
						if(v.groups){
							this.tocData.set(v.groups.tag,v.groups.value);
						};
					});
				} else {
					const fileArray = [...tocLine.matchAll(regExList.toc.files)];
					if(fileArray.length > 0){
						fileArray.filter(v => Object.keys(v.groups!).length > 0).map(v => {
							if(v.groups){
								this.files.set(this.files.size + 1,v.groups.file);
							};
						});
					}
				}
			}
		});
/* 		.reduce((tocObj, currentMatch) => {
			if (currentMatch.groups) {
				if (currentMatch.groups.line && currentMatch.groups.line.length > 0) {
					const tocLine = currentMatch.groups;
					this.lines.set((this.lines.size + 1).toString(), tocLine.line);
					if (tocLine.metadata) {
						if (tocLine.tagName && tocLine.tagValue && tocLine.tagValue.length > 0) {
							const tagName = tocLine.tagName;
							const tagValue = tocLine.tagValue;
							if (tagValue.length > 0) {
								if (tagName.indexOf('Interface') > -1) {
									if (tagName.indexOf('-') === -1) {
										this.interfaceRetail = tagValue;
									} else if (tagName.indexOf('-BCC') > -1) {
										this.interfaceBcc = tagValue;
									} else if (tagName.indexOf('-Classic') > -1) {
										this.interfaceClassic = tagValue;
									}
								} else if (tagName === 'Title') {
									let tName = tagName.toLowerCase();
									this.title = tagValue;
								} else if (tagName === 'Author') {
									this.author = tagValue;
								} else if (tagName === 'Version') {
									this.version = tagValue;
								} else if (tagName === 'LoadOnDemand') {
									this.loadOnDemand = tagValue;
								} else if (tagName === 'DefaultState') {
									this.defaultState = tagValue;
								} else if (tagName.indexOf('Notes') === 0) {
									if (tagName.indexOf('-') === -1) {
										this.notes['enUS'] = tagValue;
									} else {
										this.notes[tagName.substring(tagName.indexOf('-') + 1)] = tagValue;
									}
								} else if (tagName === 'Dependencies' || tagName === 'OptionalDep' || tagName === 'LoadWith' || tagName.indexOf('SavedVariables') > -1 || tagName === 'LoadManagers') {
									const tempName = tagName[0].toLowerCase() + tagName.substring(1);
									Object.defineProperty(this, tempName, tagValue.split(",").map(v => v.trim()));
								} else if (tagName === 'Secure') {
									this.secure = tagValue;
								} else {
									this.thirdParty[tagName] = tagValue;
								}
							}
						}
					} else if (tocLine.file) {
						this.files.push(tocLine.file);
					}
				}
			}
			return tocObj;
		}, {});
		if (this.title.length === 0) {
			this.title = this.addonFolder.substring(this.addonFolder.lastIndexOf('/') + 1 || this.addonFolder.lastIndexOf('\\') + 1);
		} */
	}
}

export interface Entry {
	type: string;
	name: string;
	index: number;
}

export class AddonOutlineField extends TreeItem {
	children: AddonOutlineField[] = [];
	uri?: Uri;
	constructor(
		label: string | TreeItemLabel,
		description: string | boolean,
		children?: Map<string,string>,
		excludeDescription?: boolean
	){
		super('');
		this.label = label;
		this.description = description;
		if(children){
			for(let child of children){
				this.children.push(new AddonOutlineField(
					excludeDescription? child[1] : child[0],
					excludeDescription ? false : child[1],
				));
				this.collapsibleState = TreeItemCollapsibleState.Collapsed;
			}
		} else {
			this.collapsibleState = TreeItemCollapsibleState.None;
		}
	}
	iconPath = {
		light: path.join(__dirname, 'dist','resources', 'light', 'dependency.svg'),
		dark: path.join(__dirname, 'dist','resources', 'dark', 'dependency.svg')
	};
}

export class AddonOutline extends TreeItem {
	children: AddonOutlineField[] = [];
	uri?: Uri;
	constructor(
		tocFile: TocFile,
	) {
		super('');
		this.uri = tocFile.tocUri;
		const tocFilename = path.basename(tocFile.tocUri.toString());
		this.label = tocFile.tocData.get("Title") || tocFilename.substring(0,tocFilename.length - 4);
		this.collapsibleState = TreeItemCollapsibleState.Collapsed;
		const fieldKeys = [...tocFile.tocData.keys()];
		let keysCompleted = new Map();
		for(let field of tocFile.tocData){
			if(keysCompleted.has(field[0]) === false){
				const similarFields = fieldKeys.filter(k => {
					return ((keysCompleted.has(k) === false) && k.toLowerCase().indexOf(field[0].toLowerCase()) > -1);
				});
				const similarFieldsMap = new Map();
				if(similarFields.length > 1){
					similarFields.map(f => {
						similarFieldsMap.set(f,tocFile.tocData.get(f));
						keysCompleted.set(f,f);
					});
				}
				this.children.push(new AddonOutlineField(
					field[0],
					similarFields.length > 1 ? similarFields.length.toString() : field[1],
					similarFields.length > 1 ? similarFieldsMap : undefined
				));
			}
		}
		this.children.push(new AddonOutlineField(
			'Files',
			tocFile.files.size.toString(),
			tocFile.files,
			true
		))
	}

	iconPath = {
		light: path.join(__dirname,'..','resources', 'light', 'dependency.svg'),
		dark: path.join(__dirname, '..','resources', 'dark', 'dependency.svg')
	};
}

export class AddonOutlineProvider implements TreeDataProvider<AddonOutline> {

	private _onDidChangeTreeData: EventEmitter<AddonOutline | undefined | null | void> = new EventEmitter<AddonOutline | undefined | null | void>();
	readonly onDidChangeTreeData: Event<AddonOutline | undefined | null | void> = this._onDidChangeTreeData.event;

	//private tree: json.Node;
	private editor: TextEditor;
	private tocFiles:Map<string,TocFile> = new Map();

	private addTocFile(tocFile: TocFile) {
		this.tocFiles.set(tocFile.tocUri.toString(),tocFile);
		this.refresh(tocFile.tocUri);
	}

	constructor(private context: ExtensionContext) {
		this.editor = Window.activeTextEditor!;
		Workspace.findFiles('**/*.toc', null).then(tocUris => {
			tocUris.map(tocUri => {
				Workspace.fs.readFile(tocUri).then(tocFileContents => {
					let newTocEntry = new TocFile(tocUri, tocFileContents.toString());
					this.addTocFile(newTocEntry);
				}, reason => {
					throw Error(reason);
				});
			});
		});
		Window.onDidChangeActiveTextEditor(() => this.refresh());
		//Workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e));
		this.refresh();

	}

	refresh(tocUriStr?: Uri): void {
		if (tocUriStr) {
			//console.log(`${tocUriStr} added!`);
		}
		this._onDidChangeTreeData.fire();
	}

	rename(offset: number): void {
		Window.showInputBox({ placeHolder: 'Enter the new label' })
			.then(value => {
				if (value !== null && value !== undefined) {
				}
			});
	}

	getChildren(element?: AddonOutline): Thenable<AddonOutline[]> {
		/*
		'single'
		'keyedObj'
		'stringArray'
		*/
		if(element && element.children.length > 0) {
			return Promise.resolve(element.children);
		}
		return Promise.resolve([...this.tocFiles.values()].map((tocFile)=>{
			return new AddonOutline(tocFile);
		}));
		//{ command: 'vscode.open', title: "Open File", arguments: [Uri.file(filePath)] },
	}

	/* getParent(element: AddonOutline): ProviderResult<AddonOutline> {
		return new AddonOutline(
			'Title',
			currentToc.title,
			TreeItemCollapsibleState.Collapsed
		);
	} */

	getTreeItem(element: AddonOutline): TreeItem {
		return element;

		/* 		const path = json.getLocation(this.text, offset).path;
				const valueNode = json.findNodeAtLocation(this.tree, path);
				if (valueNode) {
					const hasChildren = valueNode.type === 'object' || valueNode.type === 'array';
					const treeItem: TreeItem = new TreeItem(this.getLabel(valueNode), hasChildren ? valueNode.type === 'object' ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None);
					treeItem.command = {
						command: 'extension.openJsonSelection',
						title: '',
						arguments: [new Range(this.editor.document.positionAt(valueNode.offset), this.editor.document.positionAt(valueNode.offset + valueNode.length))]
					};
					treeItem.iconPath = this.getIcon(valueNode);
					treeItem.contextValue = valueNode.type;
					return treeItem;
				}
				return null; */
	}

	select(range: Range) {
		this.editor.selection = new Selection(range.start, range.end);
	}

	/* private getIcon(node: json.Node): any {
		const nodeType = node.type;
		if (nodeType === 'boolean') {
			return {
				light: this.context.asAbsolutePath(path.join('resources', 'light', 'boolean.svg')),
				dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'boolean.svg'))
			};
		}
		if (nodeType === 'string') {
			return {
				light: this.context.asAbsolutePath(path.join('resources', 'light', 'string.svg')),
				dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'string.svg'))
			};
		}
		if (nodeType === 'number') {
			return {
				light: this.context.asAbsolutePath(path.join('resources', 'light', 'number.svg')),
				dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'number.svg'))
			};
		}
		return null;
	} */

	/* private getLabel(node: json.Node): string {
		if (node.parent.type === 'array') {
			const prefix = node.parent.children.indexOf(node).toString();
			if (node.type === 'object') {
				return prefix + ':{ }';
			}
			if (node.type === 'array') {
				return prefix + ':[ ]';
			}
			return prefix + ':' + node.value.toString();
		}
		else {
			const property = node.parent.children[0].value.toString();
			if (node.type === 'array' || node.type === 'object') {
				if (node.type === 'object') {
					return '{ } ' + property;
				}
				if (node.type === 'array') {
					return '[ ] ' + property;
				}
			}
			const value = this.editor.document.getText(new Range(this.editor.document.positionAt(node.offset), this.editor.document.positionAt(node.offset + node.length)));
			return `${property}: ${value}`;
		}
	} */
}
