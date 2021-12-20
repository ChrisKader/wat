"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatDecorations = void 0;
const vscode_1 = require("vscode");
const util_1 = require("./util");
class WatDecorationProvider {
    constructor(tocOutline) {
        this.tocOutline = tocOutline;
        this._onDidChangeFileDecorations = new vscode_1.EventEmitter();
        this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
        this.disposables = [];
        this.decorations = new Map();
        console.log(`decorationsProvider.ts > WatDecorationProvider > constructor`);
        this.disposables.push(vscode_1.window.registerFileDecorationProvider(this), tocOutline.tocFile.onNewMissingFile(e => this.onNewMissingFile(e), this));
    }
    onNewMissingFile(uri) {
        console.log(`${uri}`);
        console.log(`decorationsProvider.ts > WatDecorationProvider > onNewMissingFile`);
        let newDecorations = new Map();
        this.collectDecorationData(this.tocOutline, newDecorations);
        const uris = new Set([...this.decorations.keys()].concat([...newDecorations.keys()]));
        this.decorations = newDecorations;
        this._onDidChangeFileDecorations.fire([...uris.values()].map(value => vscode_1.Uri.parse(value, true)));
    }
    collectDecorationData(tocOutline, bucket) {
        for (const r of tocOutline.tocFile.getMissingFiles()) {
            const decoration = WatDecorationProvider.missingFileDecorationData;
            bucket.set(r[1].fsPath.toString(), decoration);
        }
    }
    async provideFileDecoration(uri) {
        if (await this.tocOutline.tocFile.checkMissingFile(uri.fsPath)) {
            console.log(`decorationsProvider.ts > WatDecorationProvider > provideFileDecoration ${uri} ${uri.fsPath}`);
            return WatDecorationProvider.missingFileDecorationData;
        }
        return this.decorations.get(uri.toString());
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
WatDecorationProvider.missingFileDecorationData = {
    tooltip: 'Missing',
    color: new vscode_1.ThemeColor('problemsErrorIcon.foreground'),
    propagate: true,
};
class WatDecorations {
    constructor(model) {
        this.model = model;
        this.disposables = [];
        this.modelDisposables = [];
        this.providers = new Map();
        console.log('decorationsProvider.ts > WatDecorations > constructor');
        //model.tocs.forEach(a=>this.disposables.push(new UnknownTocFileProvider(a!)))
        //this.watTreeProvider.getAddonOutlines().forEach(a=>this.disposables.push(new UnknownTocFileProvider(a!)));
        //const onEnablementChange = filterEvent(workspace.onDidChangeConfiguration, e => e.affectsConfiguration('git.decorations.enabled'));
        //onEnablementChange(this.update, this, this.disposables);
        this.update();
    }
    update() {
        /* const enabled = workspace.getConfiguration('git').get('decorations.enabled'); */
        console.log('decorationsProvider.ts > WatDecorations > update');
        this.enable();
        /*         if (enabled) {
                    this.enable();
                } else {
                    this.disable();
                } */
    }
    enable() {
        console.log('decorationsProvider.ts > WatDecorations > enable');
        this.model.onDidOpenTocFile(this.onDidOpenTocOutline, this, this.modelDisposables);
    }
    disable() {
        this.modelDisposables = (0, util_1.dispose)(this.modelDisposables);
        this.providers.forEach(value => value.dispose());
        this.providers.clear();
    }
    onDidOpenTocOutline(tocOutline) {
        console.log(`decorationsProvider.ts > WatDecorations > onDidOpenTocOutline > ${tocOutline.tocFile.tocUri}`);
        const provider = new WatDecorationProvider(tocOutline);
        this.providers.set(tocOutline, provider);
    }
    /*     private onDidCloseRepository(watTreeProvider: AddonOutlineProvider): void {
            const provider = this.providers.get(watTreeProvider);
    
            if (provider) {
                provider.dispose();
                this.providers.delete(watTree);
            }
        } */
    dispose() {
        this.disable();
        this.disposables = (0, util_1.dispose)(this.disposables);
    }
}
exports.WatDecorations = WatDecorations;

//# sourceMappingURL=../out/decorationProvider.js.map
