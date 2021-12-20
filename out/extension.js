"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatExtensionImpl = void 0;
const vscode_1 = require("vscode");
class WatExtensionImpl {
    constructor(model) {
        this.enabled = false;
        this._onDidChangeEnablement = new vscode_1.EventEmitter();
        this.onDidChangeEnablement = this._onDidChangeEnablement.event;
        this._model = undefined;
        if (model) {
            this.enabled = true;
            this._model = model;
        }
    }
    set model(model) {
        this._model = model;
        const enabled = !!model;
        if (this.enabled === enabled) {
            return;
        }
        this.enabled = enabled;
        this._onDidChangeEnablement.fire(this.enabled);
    }
    get model() {
        return this._model;
    }
}
exports.WatExtensionImpl = WatExtensionImpl;

//# sourceMappingURL=../out/extension.js.map
