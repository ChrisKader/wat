/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TocDataEntry": () => (/* binding */ TocDataEntry),
/* harmony export */   "TocFile": () => (/* binding */ TocFile),
/* harmony export */   "AddonOutlineField": () => (/* binding */ AddonOutlineField),
/* harmony export */   "AddonOutline": () => (/* binding */ AddonOutline),
/* harmony export */   "AddonOutlineProvider": () => (/* binding */ AddonOutlineProvider)
/* harmony export */ });
/* harmony import */ var vscode__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var vscode__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(vscode__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);


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
class TocDataEntry extends Map {
}
class TocFile {
    constructor(tocUri, tocText) {
        this.tocUri = tocUri;
        this.tocText = tocText;
        this.tocData = new Map();
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
        this.lines = new Map();
        this.files = new Map();
        this.addonFolder = path__WEBPACK_IMPORTED_MODULE_1__.dirname(tocUri.fsPath);
        [...tocText.matchAll(regExList.toc.lines)].map(v => v.groups?.line).map(tocLine => {
            if (tocLine) {
                const metaDataArray = [...tocLine.matchAll(regExList.toc.metaData)];
                if (metaDataArray.length > 0) {
                    metaDataArray.filter(v => Object.keys(v.groups).length > 0).map(v => {
                        if (v.groups) {
                            this.tocData.set(v.groups.tag, v.groups.value);
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
                            }
                            ;
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
class AddonOutlineField extends vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItem {
    constructor(label, description, children, excludeDescription) {
        super('');
        this.children = [];
        this.iconPath = {
            light: path__WEBPACK_IMPORTED_MODULE_1__.join(__dirname, 'dist', 'resources', 'light', 'dependency.svg'),
            dark: path__WEBPACK_IMPORTED_MODULE_1__.join(__dirname, 'dist', 'resources', 'dark', 'dependency.svg')
        };
        this.label = label;
        this.description = description;
        if (children) {
            for (let child of children) {
                this.children.push(new AddonOutlineField(excludeDescription ? child[1] : child[0], excludeDescription ? false : child[1]));
                this.collapsibleState = vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItemCollapsibleState.Collapsed;
            }
        }
        else {
            this.collapsibleState = vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItemCollapsibleState.None;
        }
    }
}
class AddonOutline extends vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItem {
    constructor(tocFile) {
        super('');
        this.children = [];
        this.iconPath = {
            light: path__WEBPACK_IMPORTED_MODULE_1__.join(__dirname, '..', 'resources', 'light', 'dependency.svg'),
            dark: path__WEBPACK_IMPORTED_MODULE_1__.join(__dirname, '..', 'resources', 'dark', 'dependency.svg')
        };
        this.uri = tocFile.tocUri;
        const tocFilename = path__WEBPACK_IMPORTED_MODULE_1__.basename(tocFile.tocUri.toString());
        this.label = tocFile.tocData.get("Title") || tocFilename.substring(0, tocFilename.length - 4);
        this.collapsibleState = vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItemCollapsibleState.Collapsed;
        const fieldKeys = [...tocFile.tocData.keys()];
        let keysCompleted = new Map();
        for (let field of tocFile.tocData) {
            if (keysCompleted.has(field[0]) === false) {
                const similarFields = fieldKeys.filter(k => {
                    return ((keysCompleted.has(k) === false) && k.toLowerCase().indexOf(field[0].toLowerCase()) > -1);
                });
                const similarFieldsMap = new Map();
                if (similarFields.length > 1) {
                    similarFields.map(f => {
                        similarFieldsMap.set(f, tocFile.tocData.get(f));
                        keysCompleted.set(f, f);
                    });
                }
                this.children.push(new AddonOutlineField(field[0], similarFields.length > 1 ? similarFields.length.toString() : field[1], similarFields.length > 1 ? similarFieldsMap : undefined));
            }
        }
        this.children.push(new AddonOutlineField('Files', tocFile.files.size.toString(), tocFile.files, true));
    }
}
class AddonOutlineProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode__WEBPACK_IMPORTED_MODULE_0__.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.tocFiles = new Map();
        this.editor = vscode__WEBPACK_IMPORTED_MODULE_0__.window.activeTextEditor;
        vscode__WEBPACK_IMPORTED_MODULE_0__.workspace.findFiles('**/*.toc', null).then(tocUris => {
            tocUris.map(tocUri => {
                vscode__WEBPACK_IMPORTED_MODULE_0__.workspace.fs.readFile(tocUri).then(tocFileContents => {
                    let newTocEntry = new TocFile(tocUri, tocFileContents.toString());
                    this.addTocFile(newTocEntry);
                }, reason => {
                    throw Error(reason);
                });
            });
        });
        vscode__WEBPACK_IMPORTED_MODULE_0__.window.onDidChangeActiveTextEditor(() => this.refresh());
        //Workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e));
        this.refresh();
    }
    addTocFile(tocFile) {
        this.tocFiles.set(tocFile.tocUri.toString(), tocFile);
        this.refresh(tocFile.tocUri);
    }
    refresh(tocUriStr) {
        if (tocUriStr) {
            //console.log(`${tocUriStr} added!`);
        }
        this._onDidChangeTreeData.fire();
    }
    rename(offset) {
        vscode__WEBPACK_IMPORTED_MODULE_0__.window.showInputBox({ placeHolder: 'Enter the new label' })
            .then(value => {
            if (value !== null && value !== undefined) {
            }
        });
    }
    getChildren(element) {
        /*
        'single'
        'keyedObj'
        'stringArray'
        */
        if (element && element.children.length > 0) {
            return Promise.resolve(element.children);
        }
        return Promise.resolve([...this.tocFiles.values()].map((tocFile) => {
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
    getTreeItem(element) {
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
        this.editor.selection = new vscode__WEBPACK_IMPORTED_MODULE_0__.Selection(range.start, range.end);
    }
}


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
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "activate": () => (/* binding */ activate)
/* harmony export */ });
/* harmony import */ var vscode__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var vscode__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(vscode__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _addonOutline__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2);



function activate(context) {
    const addonOutlineProvider = new _addonOutline__WEBPACK_IMPORTED_MODULE_1__.AddonOutlineProvider(context);
    const view = vscode__WEBPACK_IMPORTED_MODULE_0__.window.createTreeView('addonOutline', { treeDataProvider: addonOutlineProvider });
    context.subscriptions.push(view);
    vscode__WEBPACK_IMPORTED_MODULE_0__.commands.registerCommand('addonOutline.refresh', () => addonOutlineProvider.refresh());
    vscode__WEBPACK_IMPORTED_MODULE_0__.commands.registerCommand('addonOutline.refreshNode', offset => addonOutlineProvider.refresh(offset));
    vscode__WEBPACK_IMPORTED_MODULE_0__.commands.registerCommand('addonOutline.renameNode', offset => addonOutlineProvider.rename(offset));
    vscode__WEBPACK_IMPORTED_MODULE_0__.commands.registerCommand('extension.openJsonSelection', range => addonOutlineProvider.select(range));
}

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map