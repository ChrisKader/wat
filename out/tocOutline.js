"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TocOutlineProvider = exports.TocOutline = exports.TocOutlineTreeItem = exports.TocOutlineField = exports.TocOutlineExpandedField = exports.TocFile = void 0;
const vscode_1 = require("vscode");
const path_1 = require("path");
const fs_1 = require("fs");
const util_1 = require("./util");
const regExList = {
    toc: {
        lines: /^(?<line>.*?)$/gm,
        metaData: /^## ?(?<tag>.+?): ?(?<value>[\S ]*?)$/gm,
        files: /^(?<file>[\S]+\.(?<ext>[a-z]+))/gm,
    },
    toc1: /(?:(?<line>^(?:^(?:## ?(?<metadata>(?<tagName>.+)(?:: )(?<tagValue>[\S ]+)))|^(?:(?:# )?#(?<keywordEnd>@end[a-z-]+@))|^(?:(?:# )?#(?<keywordStart>@[a-z-]+@))|^(?<comment># ?(?<text>[\S ]+))|^(?<file>[\S]+\.(?<ext>[a-z]+))))\n?|$(?<blankLine>[\n]))/gm
};
class TocFile {
    constructor(tocUri, tocText, tocOutline) {
        this.tocUri = tocUri;
        this.tocText = tocText;
        this.tocOutline = tocOutline;
        this._onNewMissingFile = new vscode_1.EventEmitter();
        this.onNewMissingFile = this._onNewMissingFile.event;
        this.tocData = new Map();
        this.tocDataRef = new Map();
        this.lines = new Map();
        this.files = new Map();
        this.missingFiles = new Map();
        this.addonFolder = vscode_1.Uri.from({
            scheme: 'file',
            authority: '',
            path: (0, path_1.dirname)(tocUri.fsPath),
            query: '',
            fragment: '',
        });
        [...tocText.matchAll(regExList.toc.lines)].map(v => v.groups?.line).map((tocLine, lineIndex) => {
            if (tocLine) {
                const metaDataArray = [...tocLine.matchAll(regExList.toc.metaData)];
                if (metaDataArray.length > 0) {
                    metaDataArray.filter(v => Object.keys(v.groups).length > 0).map(v => {
                        if (v.groups) {
                            this.tocData.set(v.groups.tag, v.groups.value);
                            this.tocDataRef.set(v.groups.tag, lineIndex);
                        }
                        ;
                    });
                }
                else {
                    const fileArray = [...tocLine.matchAll(regExList.toc.files)];
                    if (fileArray.length > 0) {
                        fileArray.filter(v => Object.keys(v.groups).length > 0).map(v => {
                            if (v.groups) {
                                this.files.set(this.files.size + 1, v.groups.file);
                                this.tocDataRef.set(v.groups.file, lineIndex);
                            }
                            ;
                        });
                    }
                }
            }
        });
        this.addonTitle = this.tocData.get("Title") || (0, path_1.basename)(this.tocUri.toString()).substring(0, (0, path_1.basename)(this.tocUri.toString()).length - 4);
    }
    getMissingFiles() {
        return this.missingFiles.entries();
    }
    async addMissingFiles(uris) {
        const rtnVal = [];
        uris.map(u => {
            console.log(`tocOutline.ts > TocFile > addMissingFiles ${u}`);
            this.missingFiles.set(u.fsPath.toLowerCase(), u);
            rtnVal.push(this.missingFiles.get(u.fsPath.toLowerCase()));
        });
        console.log(`tocOutline.ts > TocFile > addMissingFile _onNewMissingFile ${rtnVal}`);
        this._onNewMissingFile.fire(rtnVal);
    }
    removeMissingFiles(uris) {
        return uris.map(u => {
            const rtnObj = {
                status: this.missingFiles.delete(u.fsPath.toLowerCase()),
                uri: u
            };
            return rtnObj;
        });
    }
    async checkMissingFile(uri) {
        return this.missingFiles.has(uri.toLowerCase());
    }
    checkMissingFiles(uri) {
        return new Promise((resolve, reject) => {
            resolve(new Set([...this.missingFiles.keys()].filter(v => {
                return uri.some(u => u.toLowerCase() === v);
            }).map(k => this.missingFiles.get(k)?.fsPath)));
        });
    }
}
exports.TocFile = TocFile;
class TocOutlineExpandedField extends vscode_1.TreeItem {
    constructor(tocFile, fieldType, tocFileUri, fieldName, fieldValue, line) {
        super(fieldName);
        this.uri = tocFileUri.with({ fragment: line.toString() });
        this.command = { command: 'vscode.open', title: "Open File", arguments: [this.uri, { selection: new vscode_1.Range(line, 0, line, 999) }] };
        this.tooltip = fieldValue;
        if (fieldType === 'file') {
            this.contextValue = 'file';
            const addonDirectory = vscode_1.Uri.parse(tocFileUri.fsPath.replace((0, path_1.basename)(tocFileUri.fsPath), ''));
            const fileUri = vscode_1.Uri.parse((0, path_1.join)(addonDirectory.fsPath, fieldName.toString().replace(/\\/gm, '/')));
            this.resourceUri = fileUri;
            if (!(0, fs_1.existsSync)(this.resourceUri.fsPath)) {
                tocFile.addMissingFiles([this.resourceUri]);
                this.iconPath = new vscode_1.ThemeIcon('error', new vscode_1.ThemeColor('testing.iconErrored'));
                this.description = 'Missing';
                this.tooltip = `Cannot find ${fieldName}`;
            }
        }
        else if (fieldType === 'note') {
            this.description = fieldValue;
            this.iconPath = new vscode_1.ThemeIcon('note');
        }
        else if (fieldType === 'interface') {
            this.description = fieldValue;
            this.iconPath = new vscode_1.ThemeIcon('gear');
        }
        else {
            this.description = fieldValue;
            this.iconPath = new vscode_1.ThemeIcon('field');
        }
    }
}
exports.TocOutlineExpandedField = TocOutlineExpandedField;
class TocOutlineField extends vscode_1.TreeItem {
    constructor(tocFile, fieldName, fieldValues, fieldType) {
        super(fieldName);
        let startLine = tocFile.tocDataRef.get(fieldName.toString()) || tocFile.tocDataRef.get([...tocFile.tocDataRef.keys()][0]);
        let endLine = tocFile.tocDataRef.get([...tocFile.tocDataRef.keys()][tocFile.tocDataRef.size - 1]);
        this.description = fieldValues.size > 1 ? fieldValues.size.toString() : fieldValues.get(fieldName.toString());
        this.collapsibleState = vscode_1.TreeItemCollapsibleState.None;
        this.children = [];
        this.uri = tocFile.tocUri;
        this.iconPath = new vscode_1.ThemeIcon('tag');
        if (fieldValues.size > 1 || (fieldType === 'files') || (fieldType === 'notes') || (fieldType === 'interface')) {
            this.description = fieldValues.size.toString();
            this.collapsibleState = vscode_1.TreeItemCollapsibleState.Collapsed;
            for (let child of fieldValues) {
                let newItem;
                const itemName = child[0];
                const itemValue = child[1];
                let lineNumber = tocFile.tocDataRef.get(itemName.toString());
                if (fieldType === 'files') {
                    lineNumber = tocFile.tocDataRef.get(itemValue);
                    this.iconPath = new vscode_1.ThemeIcon('files', new vscode_1.ThemeIcon('symbolIcon.fileForeground'));
                    newItem = new TocOutlineExpandedField(tocFile, 'file', tocFile.tocUri, itemValue, itemValue, lineNumber);
                }
                else if (fieldType === 'notes') {
                    this.iconPath = new vscode_1.ThemeIcon('notebook');
                    newItem = new TocOutlineExpandedField(tocFile, 'note', tocFile.tocUri, itemName, itemValue, lineNumber);
                }
                else if (fieldType === 'interface') {
                    this.iconPath = new vscode_1.ThemeIcon('settings');
                    newItem = new TocOutlineExpandedField(tocFile, 'interface', tocFile.tocUri, itemName, itemValue, lineNumber);
                }
                else {
                    this.iconPath = new vscode_1.ThemeIcon('plus');
                    newItem = new TocOutlineExpandedField(tocFile, itemName, tocFile.tocUri, itemName, itemValue, lineNumber);
                }
                this.children.push(newItem);
            }
        }
        else {
            this.tooltip = fieldValues.get(fieldName.toString());
            this.command = {
                command: 'vscode.open',
                title: "Open File",
                arguments: [
                    tocFile.tocUri,
                    {
                        selection: new vscode_1.Range(startLine, 0, fieldValues.size > 1 ? endLine : startLine, 999)
                    }
                ]
            };
        }
    }
}
exports.TocOutlineField = TocOutlineField;
class TocOutlineTreeItem extends vscode_1.TreeItem {
    constructor(tocFile) {
        super(tocFile.addonTitle);
        const fieldKeys = [...tocFile.tocData.keys()];
        this.collapsibleState = vscode_1.TreeItemCollapsibleState.Collapsed;
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
                }
                else {
                    similarFieldsMap.set(fieldName, fieldValue);
                }
                this.children.push(new TocOutlineField(tocFile, fieldName, similarFieldsMap, fieldName.split('-', 1)[0].toLowerCase()));
            }
        }
        this.children.push(new TocOutlineField(tocFile, 'Files', tocFile.files, 'files'));
    }
}
exports.TocOutlineTreeItem = TocOutlineTreeItem;
class TocOutline {
    constructor(tocFileUri, tocFileContents) {
        this.disposables = [];
        this._onAddTocFile = new vscode_1.EventEmitter();
        this.onAddTocFile = this._onAddTocFile.event;
        this.tocFile = new TocFile(tocFileUri, tocFileContents, this);
        vscode_1.workspace.onDidCreateFiles((e) => this.tocFile?.removeMissingFiles(e.files.map(e => e)));
        this.uri = this.tocFile.tocUri;
        this.treeItem = new TocOutlineTreeItem(this.tocFile);
        this._onAddTocFile.fire(this);
    }
    dispose() {
        this.disposables = (0, util_1.dispose)(this.disposables);
    }
}
exports.TocOutline = TocOutline;
class TocOutlineProvider {
    constructor() {
        this._onCreateTocOutline = new vscode_1.EventEmitter();
        this.onCreateTocOutline = this._onCreateTocOutline.event;
        this._onDidChangeTreeData = new vscode_1.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.watTrees = new Map();
        this.editor = vscode_1.window.activeTextEditor;
        this.refresh();
    }
    addTocOutline(watTree) {
        this.watTrees.set(watTree.tocFile.tocUri.fsPath, watTree);
        //this._onCreateTocOutline.fire(watTree);
        this._onDidChangeTreeData.fire(watTree.treeItem);
    }
    getTocOutlineTreeItems() {
        return [...this.watTrees].map(v => {
            return v[1].treeItem;
        });
    }
    getTocOutlines() {
        return [...this.watTrees].map(v => v[1]);
    }
    watTree(uri) {
        return this.watTrees.get(uri.toString());
    }
    checkTocsMissingFiles(uri) {
    }
    openFile(file) {
        vscode_1.workspace.openTextDocument(file.resourceUri);
    }
    refresh(tocUriStr) {
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
    rename(offset) {
        vscode_1.window.showInputBox({ placeHolder: 'Enter the new label' })
            .then(value => {
            if (value !== null && value !== undefined) {
            }
        });
    }
    getChildren(element) {
        if (element && element.children && element.children.length > 0) {
            return Promise.resolve(element.children);
        }
        return Promise.resolve(this.getTocOutlineTreeItems());
    }
    getTreeItem(element) {
        return element;
    }
    select(range) {
        this.editor.selection = new vscode_1.Selection(range.start, range.end);
    }
    dispose() {
    }
}
exports.TocOutlineProvider = TocOutlineProvider;

//# sourceMappingURL=../out/tocOutline.js.map
