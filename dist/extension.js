/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AddonOutlineProvider = exports.OutlineEntry = exports.TocFile = void 0;
const vscode_1 = __webpack_require__(1);
const path = __webpack_require__(3);
const regExList = {
    toc: /(?:(?<line>^(?:^(?:## ?(?<metadata>(?<tagName>.+)(?:: )(?<tagValue>.+)))|^(?<file>[\S]+\.(?<ext>[a-z]+))|^(?:(?:# )?#(?<keywordEnd>@end[a-z-]+@))|^(?:(?:# )?#(?<keywordStart>@[a-z-]+@))|^(?<comment># (?<text>[\S ]+))))\n?|$(?<blankLine>[\n]))/gm
};
class TocFile {
    constructor(tocText) {
        this.interfaceRetail = '';
        this.interfaceClassic = '';
        this.interfaceBcc = '';
        this.title = '';
        this.author = '';
        this.version = '';
        this.notes = {};
        this.dependencies = [];
        this.optionalDependencies = [];
        this.loadOnDemand = 0;
        this.loadWith = [];
        this.loadManagers = [];
        this.savedVariables = [];
        this.savedVariablesPerCharacter = [];
        this.secure = 0;
        this.defaultState = false;
        this.thirdParty = {};
        this.files = [];
        this.longLines = [];
        this.textContents = '';
        this.treeItems = {};
        this.entryType = 'tocFile';
        if (tocText.length > 0) {
            [...tocText.matchAll(regExList.toc)].map((v, i) => {
                if (v.groups) {
                    if (v.groups.line && v.groups.line.length > 0) {
                        const tocLine = v.groups;
                        if (tocLine.line.length >= 1024) {
                            this.longLines.push(v.groups.line);
                        }
                        if (tocLine.metadata) {
                            if (tocLine.tagName && tocLine.tagValue && tocLine.tagValue.length > 0) {
                                const tagName = tocLine.tagName;
                                const tagValue = tocLine.tagValue;
                                if (tagValue.length > 0) {
                                    if (tagName.indexOf('Interface') > -1) {
                                        if (tagName.indexOf('-') === -1) {
                                            this.interfaceRetail = tagValue;
                                        }
                                        else if (tagName.indexOf('-BCC') > -1) {
                                            this.interfaceBcc = tagValue;
                                        }
                                        else if (tagName.indexOf('-Classic') > -1) {
                                            this.interfaceClassic = tagValue;
                                        }
                                    }
                                    else if (tagName === 'Title') {
                                        let tName = tagName.toLowerCase();
                                        this.title = tagValue;
                                    }
                                    else if (tagName === 'Author') {
                                        this.author = tagValue;
                                    }
                                    else if (tagName === 'Version') {
                                        this.version = tagValue;
                                    }
                                    else if (tagName === 'LoadOnDemand') {
                                        this.loadOnDemand = parseInt(tagValue);
                                    }
                                    else if (tagName === 'DefaultState') {
                                        this.defaultState = tagValue.toLowerCase() === 'enabled' ? true : false;
                                    }
                                    else if (tagName.indexOf('Notes') === 0) {
                                        if (tagName.indexOf('-') === -1) {
                                            this.notes['enUS'] = tagValue;
                                        }
                                        else {
                                            this.notes[tagName.substring(tagName.indexOf('-') + 1)] = tagValue;
                                        }
                                    }
                                    else if (tagName === 'Dependencies' || tagName === 'OptionalDep' || tagName === 'LoadWith' || tagName.indexOf('SavedVariables') > -1 || tagName === 'LoadManagers') {
                                        const tempName = tagName[0].toLowerCase() + tagName.substring(1);
                                        Object.defineProperty(this, tempName, tagValue.split(",").map(v => v.trim()));
                                    }
                                    else if (tagName === 'Secure') {
                                        this.secure = parseInt(tagValue);
                                    }
                                    else {
                                        this.thirdParty[tagName] = tagValue;
                                    }
                                }
                            }
                        }
                        else if (tocLine.file) {
                            this.files.push(path.normalize(tocLine.file));
                        }
                    }
                }
            })[0];
        }
    }
}
exports.TocFile = TocFile;
class OutlineEntry extends vscode_1.TreeItem {
    constructor(label, secondText, version, collapsibleState, command) {
        super(label, collapsibleState);
        this.label = label;
        this.secondText = secondText;
        this.version = version;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
        };
        this.contextValue = 'dependency';
        this.tooltip = `${this.label}-${this.version}`;
        this.description = this.version;
    }
}
exports.OutlineEntry = OutlineEntry;
class AddonOutlineProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode_1.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.autoRefresh = true;
        this.editor = vscode_1.window.activeTextEditor;
        this.entries = [];
        vscode_1.workspace.findFiles('*.toc', null, 1).then(tocUri => {
            if (tocUri.length > 0) {
                vscode_1.workspace.fs.readFile(tocUri[0]).then(v => {
                    this.tocFile = new TocFile(v.toString());
                    this.tocFile;
                });
            }
        }).then((v) => {
            vscode_1.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
            vscode_1.workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e));
            this.autoRefresh = vscode_1.workspace.getConfiguration('addonOutline').get('autorefresh');
            vscode_1.workspace.onDidChangeConfiguration(() => {
                this.autoRefresh = vscode_1.workspace.getConfiguration('addonOutline').get('autorefresh');
            });
            this.onActiveEditorChanged();
        });
    }
    refresh(offset) {
        this.parseTree();
        this._onDidChangeTreeData.fire(null);
    }
    rename(offset) {
        vscode_1.window.showInputBox({ placeHolder: 'Enter the new label' })
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
    onActiveEditorChanged() {
        if (vscode_1.window.activeTextEditor) {
            if (vscode_1.window.activeTextEditor.document.uri.scheme === 'file') {
                const enabled = vscode_1.window.activeTextEditor.document.languageId === 'plaintext' || vscode_1.window.activeTextEditor.document.languageId === 'toc';
                vscode_1.commands.executeCommand('setContext', 'addonOutlineEnabled', enabled);
                if (enabled) {
                    this.refresh();
                }
            }
        }
        else {
            vscode_1.commands.executeCommand('setContext', 'addonOutlineEnabled', false);
        }
    }
    onDocumentChanged(changeEvent) {
        if (this.autoRefresh && changeEvent.document?.uri.toString() === this.editor.document.uri.toString()) {
            this._onDidChangeTreeData.fire(null);
        }
    }
    parseTree() {
        this.editor = vscode_1.window.activeTextEditor;
        if (this.editor && this.editor.document) {
            //this.text = this.editor.document.getText();
            this.tree = {
                tocFile: this.tocFile,
                entries: this.entries
            };
        }
    }
    getChildren(element) {
        return Promise.resolve([new OutlineEntry('Addon Name', this.tocFile.title, '1', vscode_1.TreeItemCollapsibleState.None)]);
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
    getParent(element) {
        if (this.tocFile) {
            return new OutlineEntry(this.tocFile.title, this.tocFile.author, this.tocFile.version, vscode_1.TreeItemCollapsibleState.Expanded);
        }
    }
    getTreeItem(element) {
        element.description = element.secondText;
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
    select(range) {
        this.editor.selection = new vscode_1.Selection(range.start, range.end);
    }
}
exports.AddonOutlineProvider = AddonOutlineProvider;


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("path");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
/* import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "wat" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('wat.helloWorld', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World from WoW Addon Tools!');
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
 */

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = void 0;
const vscode = __webpack_require__(1);
const addonOutline_1 = __webpack_require__(2);
function activate(context) {
    const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    const addonOutlineProvider = new addonOutline_1.AddonOutlineProvider(context);
    vscode.window.registerTreeDataProvider('addonOutline', addonOutlineProvider);
    vscode.commands.registerCommand('addonOutline.refresh', () => addonOutlineProvider.refresh());
    vscode.commands.registerCommand('addonOutline.refreshNode', offset => addonOutlineProvider.refresh(offset));
    vscode.commands.registerCommand('addonOutline.renameNode', offset => addonOutlineProvider.rename(offset));
    vscode.commands.registerCommand('extension.openJsonSelection', range => addonOutlineProvider.select(range));
}
exports.activate = activate;

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map