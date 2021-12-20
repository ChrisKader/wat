"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandCenter = void 0;
const fs_1 = require("./fs");
const path = require("path");
const vscode_1 = require("vscode");
const node_fetch_1 = require("node-fetch");
const util_1 = require("./util");
const watCommands = [];
function command(commandId, options = {}) {
    return (_target, key, descriptor) => {
        if (!(typeof descriptor.value === 'function')) {
            throw new Error('not supported');
        }
        watCommands.push({ commandId, key, method: descriptor.value, options });
    };
}
class CommandCenter {
    constructor(model, outputChannel) {
        this.model = model;
        this.outputChannel = outputChannel;
        this.disposables = watCommands.map(({ commandId, key, method, options }) => {
            const command = this.createCommand(commandId, key, method, options);
            return vscode_1.commands.registerCommand(commandId, command);
        });
    }
    async walkDir(directory) {
        let fileList = [];
        const files = await fs_1.realfs.readdir(directory);
        for (const file of files) {
            const p = path.join(directory, file);
            if ((await fs_1.realfs.stat(p)).isDirectory()) {
                fileList = [...fileList, ...(await this.walkDir(p))];
            }
            else {
                fileList.push(p);
            }
        }
        return fileList;
    }
    async getLibraryFiles(url) {
        const linkRex = /<li><a href="(?<href>.+)">(?<text>.+)<\/a><\/li>/gm;
        return await (0, node_fetch_1.default)(url.toString(true)).then(async (res) => {
            if (res.ok) {
                const pageText = await res.text();
                let rtnObj = [];
                return [...pageText.matchAll(linkRex)]
                    .filter(v => v.groups)
                    .reduce(async (pV, cV) => {
                    const href = cV.groups?.href;
                    if (href && href !== '../') {
                        const nextUri = vscode_1.Uri.joinPath(url, href);
                        if (href.substring(href.length) === '/') {
                            return (await pV).concat(await this.getLibraryFiles(nextUri));
                        }
                        else {
                            return (0, node_fetch_1.default)(nextUri.toString(false)).then(async (r) => {
                                (await pV).push({ [nextUri.toString(false)]: await r.text() });
                                return await pV;
                            });
                        }
                    }
                    else {
                        return pV;
                    }
                }, Promise.resolve(rtnObj));
            }
            else {
                return Promise.resolve([]);
            }
        });
    }
    async createAddon() {
        const list = await this.getLibraryFiles(vscode_1.Uri.parse('https://repos.curseforge.com/wow/ace3/trunk/AceConfig-3.0'));
        console.log(list);
        const gitExtension = vscode_1.extensions.getExtension('vscode.git').exports;
        const git = gitExtension.getAPI(1).git._model.git;
        this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: Running command wat.createAddon`);
        vscode_1.window.showInputBox({ title: 'Addon Name', placeHolder: 'Choose wisely! This will also be the folder name.' }).then(addonName => {
            if (addonName) {
                this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: Addon Name: ${addonName}`);
                vscode_1.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false }).then(async (parentFolders) => {
                    if (typeof (parentFolders) !== 'undefined') {
                        const parentDir = parentFolders[0];
                        this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: Parent Directory: ${parentDir}`);
                        const templateGit = 'https://github.com/chriskader/wow-addon-template';
                        const addonRootDir = path.join(parentDir.fsPath, addonName);
                        this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: Addon Root Directory: ${addonRootDir}`);
                        try {
                            const addonReplaceReg = /@addon-name@/gm;
                            this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: Making Addon Directory at ${addonRootDir}`);
                            await fs_1.realfs.mkdir(addonRootDir);
                            this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: git.init in ${addonRootDir}`);
                            await git.init(addonRootDir);
                            this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: git.open in ${addonRootDir}`);
                            let templateRepo = git.open(addonRootDir, '.git');
                            await templateRepo.addRemote('origin', templateGit);
                            await templateRepo.fetch();
                            await templateRepo.checkout('origin/default', [], {});
                            /*
                                Due to the git extension opening a showInformationMessage (small user prompt at the bottom left of the screen)
                                and holding code execution until its clicked, we are calling the git.clone function directly from the vscode.git extension model.
                            */
                            //commands.executeCommand('git.clone', templateGit, parentDir.fsPath).then(async ()=>{});
                            /* const opts = {
                                location: ProgressLocation.Notification,
                                title: `Cloning ${templateGit} to ${parentDir.path}`,
                                cancellable: true
                            };
                            const repositoryPath = await window.withProgress(
                                opts,
                                (progress, token) => git.clone(templateGit!, { parentPath: parentDir.fsPath!, progress }, token)
                            ); */
                            await fs_1.realfs.rm(path.join(addonRootDir, 'README.md')).then(async () => {
                                await fs_1.realfs.rename(path.join(addonRootDir, '_README.md'), path.join(addonRootDir, 'README.md'));
                                await fs_1.realfs.rename(path.join(addonRootDir, 'Addon'), path.join(addonRootDir, addonName));
                                await fs_1.realfs.readdir(addonRootDir, { withFileTypes: true }).then(async (fileList) => {
                                    for (let file of fileList) {
                                        const fileName = path.join(addonRootDir, file.name);
                                        if (file.isDirectory()) {
                                            if (file.name === '.git') {
                                                await fs_1.realfs.rm(fileName, { force: true, recursive: true });
                                                this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: Deleted ${fileName}`);
                                            }
                                            if (file.name === addonName) {
                                                const extList = ['toc', 'lua'];
                                                for (let ext of extList) {
                                                    const oldFileName = path.join(fileName, `Addon.${ext}`);
                                                    const newFileName = path.join(fileName, `${addonName}.${ext}`);
                                                    await fs_1.realfs.rename(oldFileName, newFileName).then(async () => {
                                                        this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: Renamed ${oldFileName} to ${newFileName}`);
                                                        await fs_1.realfs.readFile(newFileName).then(async (fileBuffer) => {
                                                            this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: Reading ${newFileName}`);
                                                            await fs_1.realfs.writeFile(newFileName, fileBuffer.toString().replace(addonReplaceReg, addonName));
                                                            this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: Writing ${newFileName}`);
                                                        });
                                                    });
                                                }
                                                ;
                                            }
                                            ;
                                        }
                                        if (file.isFile()) {
                                            if (file.name === 'pkgmeta.yaml' || file.name === 'README.md') {
                                                await fs_1.realfs.readFile(fileName).then(async (fileBuffer) => {
                                                    this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: Reading ${fileName}`);
                                                    await fs_1.realfs.writeFile(fileName, fileBuffer.toString().replace(addonReplaceReg, addonName));
                                                    this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: wat.createAddon: Writing ${fileName}`);
                                                });
                                            }
                                            ;
                                        }
                                        ;
                                    }
                                    ;
                                });
                                await fs_1.realfs.mkdir(path.join(addonRootDir, addonName, 'libs')).catch((err) => {
                                    throw err;
                                });
                                vscode_1.commands.executeCommand('vscode.openFolder', vscode_1.Uri.file(addonRootDir), true);
                            });
                        }
                        catch (err) {
                            throw err;
                        }
                    }
                });
            }
        });
    }
    async test(text) {
        this.outputChannel.appendLine(`${(0, util_1.logTimestamp)()}: WAT Extension: testCommand - ${text}`);
        //localize('changed', "{0} Log level changed to: {1}", logTimestamp()))//'changed', "{0} Log level changed to: {1}", logTimestamp(), LogLevel[Log.logLevel]));
    }
    createCommand(id, key, method, options) {
        const result = (...args) => {
            let result;
            result = Promise.resolve(method.apply(this, args));
        };
        // patch this object, so people can call methods directly
        this[key] = result;
        return result;
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
__decorate([
    command('wat.createAddon')
], CommandCenter.prototype, "createAddon", null);
__decorate([
    command('wat.test')
], CommandCenter.prototype, "test", null);
exports.CommandCenter = CommandCenter;

//# sourceMappingURL=../out/commands.js.map
