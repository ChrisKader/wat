import {
	Command,
	commands as Commands,
	Event,
	EventEmitter,
	ExtensionContext,
	ProviderResult,
	Range,
	Selection,
	TextDocumentChangeEvent,
	TextEditor,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	window as Window,
	workspace as Workspace
} from 'vscode';
import * as path from 'path';

const regExList = {
	toc: /(?:(?<line>^(?:^(?:## ?(?<metadata>(?<tagName>.+)(?:: )(?<tagValue>.+)))|^(?<file>[\S]+\.(?<ext>[a-z]+))|^(?:(?:# )?#(?<keywordEnd>@end[a-z-]+@))|^(?:(?:# )?#(?<keywordStart>@[a-z-]+@))|^(?<comment># (?<text>[\S ]+))))\n?|$(?<blankLine>[\n]))/gm
};
export interface BaseObj {
	[key: string]: string;
}

export class TocFile {

    interfaceRetail= '';
    interfaceClassic= '';
    interfaceBcc= '';
    title= '';
    author= '';
    version= '';
    notes= <{[key:string]:string}>{};
    dependencies= <string[]>[];
    optionalDependencies= <string[]>[];
    loadOnDemand= 0;
    loadWith= <string[]>[];
    loadManagers= <string[]>[];
    savedVariables= <string[]>[];
    savedVariablesPerCharacter= <string[]>[];
    secure= 0;
    defaultState= false;
    thirdParty=<{[key:string]:string}>{};
	files:string[] = [];
	longLines:string[] = [];
	textContents = '';
	treeItems = {};
	entryType = 'tocFile';
	
	constructor(
		tocText: string
	){
		if(tocText.length > 0){
			[...tocText.matchAll(regExList.toc)].map((v,i) => {
				if(v.groups){
					if(v.groups.line && v.groups.line.length > 0){
						const tocLine:{
                            [key: string]: string
                        } = v.groups;
						if(tocLine.line.length >= 1024){
							this.longLines.push(v.groups.line);
						}
						if(tocLine.metadata){
							if(tocLine.tagName && tocLine.tagValue && tocLine.tagValue.length > 0){
								const tagName = tocLine.tagName;
								const tagValue = tocLine.tagValue;
								if(tagValue.length > 0){
									if(tagName.indexOf('Interface') > -1){
										if(tagName.indexOf('-') === -1){
											this.interfaceRetail = tagValue;	
										}else if(tagName.indexOf('-BCC') > -1){
											this.interfaceBcc = tagValue;	
										}else if(tagName.indexOf('-Classic') > -1){
											this.interfaceClassic = tagValue;	
										}
									} else if(tagName === 'Title'){
                                        let tName = tagName.toLowerCase()
										this.title = tagValue;
									} else if(tagName === 'Author'){
										this.author = tagValue;
									} else if(tagName === 'Version'){
										this.version = tagValue;
									} else if(tagName === 'LoadOnDemand'){
										this.loadOnDemand = parseInt(tagValue);
									} else if(tagName === 'DefaultState'){
										this.defaultState = tagValue.toLowerCase() === 'enabled' ? true : false;
									} else if(tagName.indexOf('Notes') === 0){
										if(tagName.indexOf('-') === -1){
											this.notes['enUS'] = tagValue;
										} else {
											this.notes[tagName.substring(tagName.indexOf('-') + 1)] = tagValue;
										}
									} else if(tagName === 'Dependencies' || tagName === 'OptionalDep' || tagName === 'LoadWith' || tagName.indexOf('SavedVariables') > -1 || tagName === 'LoadManagers'){
										const tempName = tagName[0].toLowerCase() + tagName.substring(1);
										Object.defineProperty(this,tempName, tagValue.split(",").map(v=>v.trim()));
									} else if(tagName === 'Secure'){
										this.secure = parseInt(tagValue);
									} else {
										this.thirdParty[tagName] = tagValue;
									}
								}
							}
						} else if(tocLine.file){
							this.files.push(path.normalize(tocLine.file));
						}
					}
				}
			})[0];
		}
	}
}

export interface Entry {
	type: string;
	name: string;
	index: number;
}
export class OutlineEntry extends TreeItem {
	constructor(
		public readonly label: string,
		public readonly secondText: string,
		private readonly version: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public readonly command?: Command
	) {
		super(label, collapsibleState);

		this.tooltip = `${this.label}-${this.version}`;
		this.description = this.version;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	contextValue = 'dependency';
}
export class AddonOutlineProvider implements TreeDataProvider<OutlineEntry> {

	private _onDidChangeTreeData: EventEmitter<OutlineEntry | null> = new EventEmitter<OutlineEntry | null>();
	readonly onDidChangeTreeData: Event<OutlineEntry | null> = this._onDidChangeTreeData.event;

	//private tree: json.Node;
	private tree?: {
		tocFile?: TocFile,
		entries: Entry[]
	};
	private editor: TextEditor;
	private autoRefresh = true;
	private tocFile?: TocFile;
	private entries: Entry[];

	constructor(private context: ExtensionContext) {
        this.editor = Window.activeTextEditor!;
        this.entries = [];
		Workspace.findFiles('*.toc',null,1).then(tocUri => {
			if(tocUri.length > 0){
				Workspace.fs.readFile(tocUri[0]).then(v=>{
					this.tocFile = new TocFile(v.toString());
					this.tocFile;
				});
			}
		}).then((v)=>{
			Window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
			Workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e));
			this.autoRefresh = Workspace.getConfiguration('addonOutline').get('autorefresh')!;
			Workspace.onDidChangeConfiguration(() => {
				this.autoRefresh = Workspace.getConfiguration('addonOutline').get('autorefresh')!;
			});
			this.onActiveEditorChanged();
		});
	
	}

	refresh(offset?: number): void {
		this.parseTree();
		this._onDidChangeTreeData.fire(null);
	}

	rename(offset: number): void {
		Window.showInputBox({ placeHolder: 'Enter the new label' })
			.then(value => {
				if (value !== null && value !== undefined) {
					this.editor.edit(editBuilder => {
						/* const path = json.getLocation(this.text, offset).path;
						let propertyNode = json.findNodeAtLocation(this.tree, path);
						if (propertyNode.parent.type !== 'array') {
							propertyNode = propertyNode.parent.children[0];
						}
						const range = new Range(this.editor.document.positionAt(propertyNode.offset), this.editor.document.positionAt(propertyNode.offset + propertyNode.length));
						editBuilder.replace(range, `"${value}"`);
						setTimeout(() => {
							this.parseTree();
							this.refresh(offset);
						}, 100); */
					});
				}
			});
	}

	private onActiveEditorChanged(): void {
		if (Window.activeTextEditor) {
			if (Window.activeTextEditor.document.uri.scheme === 'file') {
				const enabled = Window.activeTextEditor.document.languageId === 'plaintext' || Window.activeTextEditor.document.languageId === 'toc';
				Commands.executeCommand('setContext', 'addonOutlineEnabled', enabled);
				if (enabled) {
					this.refresh();
				}
			}
		} else {
			Commands.executeCommand('setContext', 'addonOutlineEnabled', false);
		}
	}

	private onDocumentChanged(changeEvent: TextDocumentChangeEvent): void {
		if (this.autoRefresh && changeEvent.document?.uri.toString() === this.editor.document.uri.toString()) {
			this._onDidChangeTreeData.fire(null);
		}
	}

	private parseTree(): void {
		this.editor = Window.activeTextEditor!;
		if (this.editor && this.editor.document) {
			//this.text = this.editor.document.getText();
			this.tree = {
                tocFile: this.tocFile,
                entries: this.entries
            };
		}
	}

	getChildren(element?: OutlineEntry): Thenable<OutlineEntry[]> {
        return Promise.resolve([new OutlineEntry(
            'Addon Name',this.tocFile!.title,'1',TreeItemCollapsibleState.None
        )]);
	}

/* 	private getChildrenOffsets(node: json.Node): number[] {
		const offsets: number[] = [];
		for (const child of node.children) {
			const childPath = json.getLocation(this.text, child.offset).path;
			const childNode = json.findNodeAtLocation(this.tree, childPath);
			if (childNode) {
				offsets.push(childNode.offset);
			}
		}
		return offsets;
	} */
	getParent(element: OutlineEntry): ProviderResult<OutlineEntry> {
        if(this.tocFile){
            return new OutlineEntry(this.tocFile.title,this.tocFile.author,this.tocFile.version,TreeItemCollapsibleState.Expanded);
        }
	}

	getTreeItem(element: OutlineEntry): TreeItem {
        element.description = element.secondText
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
