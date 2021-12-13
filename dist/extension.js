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
/* harmony export */   "TocFile": () => (/* binding */ TocFile),
/* harmony export */   "AddonOutlineExpandedField": () => (/* binding */ AddonOutlineExpandedField),
/* harmony export */   "AddonOutlineField": () => (/* binding */ AddonOutlineField),
/* harmony export */   "AddonOutline": () => (/* binding */ AddonOutline),
/* harmony export */   "AddonOutlineProvider": () => (/* binding */ AddonOutlineProvider)
/* harmony export */ });
/* harmony import */ var vscode__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var vscode__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(vscode__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_2__);



const regExList = {
    toc: {
        lines: /^(?<line>.*?)$/gm,
        metaData: /^## ?(?<tag>.+?): ?(?<value>[\S ]*?)$/gm,
        files: /^(?<file>[\S]+\.(?<ext>[a-z]+))/gm,
    },
    toc1: /(?:(?<line>^(?:^(?:## ?(?<metadata>(?<tagName>.+)(?:: )(?<tagValue>[\S ]+)))|^(?:(?:# )?#(?<keywordEnd>@end[a-z-]+@))|^(?:(?:# )?#(?<keywordStart>@[a-z-]+@))|^(?<comment># ?(?<text>[\S ]+))|^(?<file>[\S]+\.(?<ext>[a-z]+))))\n?|$(?<blankLine>[\n]))/gm
};
class TocFile {
    //missingFiles: Map<string,Uri> = new Map();
    constructor(tocUri, tocText) {
        this.tocUri = tocUri;
        this.tocText = tocText;
        this.tocData = new Map();
        this.tocDataRef = new Map();
        this.lines = new Map();
        this.files = new Map();
        this.addonFolder = vscode__WEBPACK_IMPORTED_MODULE_0__.Uri.from({
            scheme: 'file',
            authority: '',
            path: (0,path__WEBPACK_IMPORTED_MODULE_1__.dirname)(tocUri.fsPath),
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
    }
}
class AddonOutlineExpandedField extends vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItem {
    constructor(tocFile, fieldType, tocFileUri, fieldName, fieldValue, line) {
        super(fieldName);
        this.uri = tocFileUri.with({ fragment: line.toString() });
        this.command = { command: 'vscode.open', title: "Open File", arguments: [this.uri, { selection: new vscode__WEBPACK_IMPORTED_MODULE_0__.Range(line, 0, line, 999) }] };
        this.tooltip = fieldValue;
        if (fieldType == 'file') {
            this.contextValue = 'file';
            const addonDirectory = vscode__WEBPACK_IMPORTED_MODULE_0__.Uri.parse(tocFileUri.fsPath.replace((0,path__WEBPACK_IMPORTED_MODULE_1__.basename)(tocFileUri.fsPath), ''));
            const fileUri = vscode__WEBPACK_IMPORTED_MODULE_0__.Uri.parse((0,path__WEBPACK_IMPORTED_MODULE_1__.join)(addonDirectory.fsPath, fieldName.toString().replace(/\\/gm, '/')));
            this.resourceUri = fileUri;
            if (!(0,fs__WEBPACK_IMPORTED_MODULE_2__.existsSync)(this.resourceUri.fsPath)) {
                this.iconPath = new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeIcon('error', new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeColor('testing.iconErrored'));
                this.description = 'Missing';
                this.tooltip = `Cannot find ${fieldName}`;
            }
        }
        else if (fieldType == 'note') {
            this.description = fieldValue;
            this.iconPath = new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeIcon('note');
        }
        else if (fieldType == 'interface') {
            this.description = fieldValue;
            this.iconPath = new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeIcon('gear');
        }
        else {
            this.description = fieldValue;
            this.iconPath = new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeIcon('field');
        }
    }
}
class AddonOutlineField extends vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItem {
    constructor(tocFile, fieldName, fieldValues, fieldType) {
        super(fieldName);
        let startLine = tocFile.tocDataRef.get(fieldName.toString()) || tocFile.tocDataRef.get([...tocFile.tocDataRef.keys()][0]);
        let endLine = tocFile.tocDataRef.get([...tocFile.tocDataRef.keys()][tocFile.tocDataRef.size - 1]);
        this.description = fieldValues.size > 1 ? fieldValues.size.toString() : fieldValues.get(fieldName.toString());
        this.collapsibleState = vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItemCollapsibleState.None;
        this.children = [];
        this.uri = tocFile.tocUri;
        this.iconPath = new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeIcon('tag');
        if (fieldValues.size > 1 || (fieldType == 'files') || (fieldType == 'notes') || (fieldType == 'interface')) {
            this.description = fieldValues.size.toString();
            this.collapsibleState = vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItemCollapsibleState.Collapsed;
            for (let child of fieldValues) {
                let newItem;
                const itemName = child[0];
                const itemValue = child[1];
                let lineNumber = tocFile.tocDataRef.get(itemName.toString());
                if (fieldType == 'files') {
                    lineNumber = tocFile.tocDataRef.get(itemValue);
                    this.iconPath = new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeIcon('files', new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeIcon('symbolIcon.fileForeground'));
                    newItem = new AddonOutlineExpandedField(tocFile, 'file', tocFile.tocUri, itemValue, itemValue, lineNumber);
                }
                else if (fieldType == 'notes') {
                    this.iconPath = new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeIcon('notebook');
                    newItem = new AddonOutlineExpandedField(tocFile, 'note', tocFile.tocUri, itemName, itemValue, lineNumber);
                }
                else if (fieldType == 'interface') {
                    this.iconPath = new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeIcon('settings');
                    newItem = new AddonOutlineExpandedField(tocFile, 'interface', tocFile.tocUri, itemName, itemValue, lineNumber);
                }
                else {
                    this.iconPath = new vscode__WEBPACK_IMPORTED_MODULE_0__.ThemeIcon('plus');
                    newItem = new AddonOutlineExpandedField(tocFile, itemName, tocFile.tocUri, itemName, itemValue, lineNumber);
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
                        selection: new vscode__WEBPACK_IMPORTED_MODULE_0__.Range(startLine, 0, fieldValues.size > 1 ? endLine : startLine, 999)
                    }
                ]
            };
        }
    }
}
class AddonOutline extends vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItem {
    constructor(tocFile, addonTitle) {
        super(addonTitle);
        this.children = [];
        this.children = [];
        this.uri = tocFile.tocUri;
        this.collapsibleState = vscode__WEBPACK_IMPORTED_MODULE_0__.TreeItemCollapsibleState.Collapsed;
        const fieldKeys = [...tocFile.tocData.keys()];
        let keysCompleted = new Map();
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
                this.children.push(new AddonOutlineField(tocFile, fieldName, similarFieldsMap, fieldName.split('-', 1)[0].toLowerCase()));
            }
        }
        this.children.push(new AddonOutlineField(tocFile, 'Files', tocFile.files, 'files'));
    }
}
class AddonOutlineProvider {
    constructor(context) {
        this.context = context;
        this.tocFiles = new Map();
        this.editor = vscode__WEBPACK_IMPORTED_MODULE_0__.window.activeTextEditor;
        vscode__WEBPACK_IMPORTED_MODULE_0__.window.onDidChangeActiveTextEditor(() => this.refresh());
        this.refresh();
    }
    addTocFile(tocFile) {
        this.tocFiles.set(tocFile.tocUri.toString(), tocFile);
    }
    checkTocsMissingFiles(uri) {
    }
    openFile(file) {
        vscode__WEBPACK_IMPORTED_MODULE_0__.workspace.openTextDocument(file.resourceUri);
    }
    refresh(tocUriStr) {
        vscode__WEBPACK_IMPORTED_MODULE_0__.workspace.findFiles(new vscode__WEBPACK_IMPORTED_MODULE_0__.RelativePattern(vscode__WEBPACK_IMPORTED_MODULE_0__.workspace.workspaceFolders[0], '**/*.toc')).then(tocUris => {
            tocUris.map(tocUri => {
                vscode__WEBPACK_IMPORTED_MODULE_0__.workspace.fs.readFile(tocUri).then(tocFileContents => {
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
    rename(offset) {
        vscode__WEBPACK_IMPORTED_MODULE_0__.window.showInputBox({ placeHolder: 'Enter the new label' })
            .then(value => {
            if (value !== null && value !== undefined) {
            }
        });
    }
    getChildren(element) {
        if (element && element.children && element.children.length > 0) {
            return Promise.resolve(element.children);
        }
        return Promise.resolve([...this.tocFiles.values()].map((tocFile) => {
            const addonTitle = tocFile.tocData.get("Title") || (0,path__WEBPACK_IMPORTED_MODULE_1__.basename)(tocFile.tocUri.toString()).substring(0, (0,path__WEBPACK_IMPORTED_MODULE_1__.basename)(tocFile.tocUri.toString()).length - 4);
            return new AddonOutline(tocFile, addonTitle);
        }));
    }
    getTreeItem(element) {
        return element;
    }
    select(range) {
        this.editor.selection = new vscode__WEBPACK_IMPORTED_MODULE_0__.Selection(range.start, range.end);
    }
}


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("fs");

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
    vscode__WEBPACK_IMPORTED_MODULE_0__.commands.registerCommand('addonOutline.openFile', (s) => addonOutlineProvider.openFile(s));
    vscode__WEBPACK_IMPORTED_MODULE_0__.commands.registerCommand('addonOutline.refreshNode', offset => addonOutlineProvider.refresh(offset));
    vscode__WEBPACK_IMPORTED_MODULE_0__.commands.registerCommand('addonOutline.renameNode', offset => addonOutlineProvider.rename(offset));
    vscode__WEBPACK_IMPORTED_MODULE_0__.commands.registerCommand('extension.openJsonSelection', range => addonOutlineProvider.select(range));
}

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map