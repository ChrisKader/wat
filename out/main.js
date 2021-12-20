'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = exports.getExtensionContext = exports._activate = void 0;
const vscode_1 = require("vscode");
const commands_1 = require("./commands");
const decorationProvider_1 = require("./decorationProvider");
const extension_1 = require("./extension");
const fileSystemProvider_1 = require("./fileSystemProvider");
const model_1 = require("./model");
const util_1 = require("./util");
async function createModel(context, outputChannel, disposables) {
    const model = new model_1.Model(context, outputChannel);
    disposables.push(model);
    //outputChannel.appendLine();
    const onOutput = (str) => {
        const lines = str.split(/\r?\n/mg);
        while (/^\s*$/.test(lines[lines.length - 1])) {
            lines.pop();
        }
        outputChannel.appendLine(`${(0, util_1.logTimestamp)()} ${lines.join('\n')}`);
    };
    disposables.push(new commands_1.CommandCenter(model, outputChannel), new decorationProvider_1.WatDecorations(model), new fileSystemProvider_1.WatFileSystemProvider(model));
    return model;
}
async function _activate(context) {
    console.log(`_activate`);
    const disposables = [];
    context.subscriptions.push(new vscode_1.Disposable(() => vscode_1.Disposable.from(...disposables).dispose()));
    const outputChannel = vscode_1.window.createOutputChannel('WoW Addon Tools');
    disposables.push(outputChannel);
    //const { name, version } = require('../package.json') as { name: string, version: string };
    try {
        const model = await createModel(context, outputChannel, disposables);
        return new extension_1.WatExtensionImpl(model);
    }
    catch (err) {
        console.warn(err.message);
        outputChannel.appendLine(`${(0, util_1.logTimestamp)()} ${err.message}`);
        //Commands.executeCommand('setContext', 'git.missing', true);
        return new extension_1.WatExtensionImpl();
    }
}
exports._activate = _activate;
let _context;
function getExtensionContext() {
    return _context;
}
exports.getExtensionContext = getExtensionContext;
async function activate(context) {
    _context = context;
    const result = await _activate(context);
    return result;
}
exports.activate = activate;

//# sourceMappingURL=../out/main.js.map
