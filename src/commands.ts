import { readdir, readFile, writeFile, rename, rm, mkdtemp, stat, mkdir, access, copyFile } from 'fs/promises';
import path = require('path');
import { commands, Disposable, extensions as Extensions, OutputChannel, window, Uri, workspace, ProgressLocation } from 'vscode';
import { API, GitExtension } from './git'
import { Model } from './model';
import { logTimestamp } from './util';
interface WatCommandOptions {
    uri?: boolean;
}

interface WatCommand {
    commandId: string;
    key: string;
    method: Function;
    options: WatCommandOptions;
}

const watCommands: WatCommand[] = [];

function command(commandId: string, options: WatCommandOptions = {}): Function {
    return (_target: any, key: string, descriptor: any) => {
        if (!(typeof descriptor.value === 'function')) {
            throw new Error('not supported');
        }

        watCommands.push({ commandId, key, method: descriptor.value, options });
    };
}
export class CommandCenter {
    private disposables: Disposable[];

    constructor(
        private model: Model,
        private outputChannel: OutputChannel,
    ) {
        this.disposables = watCommands.map(({ commandId, key, method, options }) => {
            const command = this.createCommand(commandId, key, method, options);

            return commands.registerCommand(commandId, command);
        });
    }

    async walkDir(directory: string) {
        let fileList: string[] = [];
        const files = await readdir(directory);
        for (const file of files) {
            const p = path.join(directory, file);
            if ((await stat(p)).isDirectory()) {
                fileList = [...fileList, ...(await this.walkDir(p))];
            } else {
                fileList.push(p);
            }
        }
        return fileList;
    }
    @command('wat.createAddon')
    async createAddon() {
        const gitExtension = Extensions.getExtension<GitExtension>('vscode.git')!.exports;
        const git = gitExtension.getAPI(1).git._model.git;
        this.outputChannel.appendLine(`${logTimestamp()}: Running command wat.createAddon`);
        window.showInputBox({ title: 'Addon Name', placeHolder: 'Choose wisely! This will also be the folder name.' }).then(addonName => {
            if (addonName) {
                this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Addon Name: ${addonName}`);
                window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false }).then(async parentFolders => {
                    if (typeof (parentFolders) !== 'undefined') {
                        const parentDir = parentFolders[0];
                        this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Parent Directory: ${parentDir}`);
                        const templateGit = 'https://github.com/ckog/wow-addon-template';
                        const addonRootDir = path.join(parentDir.fsPath, addonName);
                        this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Addon Root Directory: ${addonRootDir}`);
                        try {
                            const addonReplaceReg = /@addon-name@/gm;
                            await mkdir(addonRootDir);
                            await git.init(addonRootDir).then(async ()=>{
                                const gitRep = git.open(addonRootDir, '.git');
                                await gitRep.addRemote('origin', templateGit);
                                await gitRep.fetch();
                                await gitRep.checkout('origin/main', ['standard'], {})
                            });
                            this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Cloning ${templateGit} into ${parentDir}/wow-addon-template`);
                            /*
                                Due to the git extension opening a showInformationMessage (small user prompt at the bottom left of the screen)
                                and holding code execution until its clicked, we are calling the git.clone function directly from the vscode.git extension model.
                            */
                            //commands.executeCommand('git.clone', templateGit, parentDir.fsPath).then(async ()=>{});
                            const opts = {
                                location: ProgressLocation.Notification,
                                title: `Cloning ${templateGit} to ${parentDir.path}`,
                                cancellable: true
                            };
                            const repositoryPath = await window.withProgress(
                                opts,
                                (progress, token) => git.clone(templateGit!, { parentPath: parentDir.fsPath!, progress }, token)
                            );

                            if (repositoryPath) {
                                const templateRepo = git.open(repositoryPath, path.join(repositoryPath, '.git'));
                                this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Clone of ${templateGit} into ${parentDir}/wow-addon-template complete!`);
                                await rename(path.join(parentDir.fsPath, 'wow-addon-template'), addonRootDir).then(async () => {
                                    await rename(path.join(addonRootDir, 'Addon'), path.join(addonRootDir, addonName));
                                    await readdir(addonRootDir, { withFileTypes: true }).then(async fileList => {
                                        for (let file of fileList) {
                                            const fileName = path.join(addonRootDir, file.name);
                                            if (file.isDirectory()) {
                                                if (file.name === '.git') {
                                                    await rm(fileName, { force: true, recursive: true });
                                                    this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Deleted ${fileName}`);
                                                }
                                                if (file.name === addonName) {
                                                    const extList = ['toc', 'lua'];
                                                    for (let ext of extList) {
                                                        const oldFileName = path.join(fileName, `Addon.${ext}`);
                                                        const newFileName = path.join(fileName, `${addonName}.${ext}`);
                                                        await rename(oldFileName, newFileName).then(async () => {
                                                            this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Renamed ${oldFileName} to ${newFileName}`);
                                                            await readFile(newFileName).then(async fileBuffer => {
                                                                this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Reading ${newFileName}`);
                                                                await writeFile(newFileName, fileBuffer.toString().replace(addonReplaceReg, addonName));
                                                                this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Writing ${newFileName}`);
                                                            });
                                                        });
                                                    };
                                                };
                                            }
                                            if (file.isFile()) {
                                                if (file.name === 'pkgmeta.yaml' || file.name === 'README.md') {
                                                    await readFile(fileName).then(async fileBuffer => {
                                                        this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Reading ${fileName}`);
                                                        await writeFile(fileName, fileBuffer.toString().replace(addonReplaceReg, addonName));
                                                        this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Writing ${fileName}`);
                                                    });
                                                };
                                            };
                                        };
                                    });
                                });
                                await mkdir(path.join(addonRootDir, addonName, 'libs')).catch((err) => {
                                    throw err;
                                });
                                commands.executeCommand('vscode.openFolder', Uri.file(addonRootDir), true);
                            } else {
                                this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Clone of ${templateGit} into ${parentDir}/wow-addon-template failed!`);
                                throw Error(`${logTimestamp()}: wat.createAddon: Clone of ${templateGit} into ${parentDir}/wow-addon-template failed!`);
                            }
                        } catch (err) {
                            throw err;
                        }
                    }
                });
            }
        });
    }

    @command('wat.test')
    async test(text: string): Promise<void> {
        this.outputChannel.appendLine(`${logTimestamp()}: WAT Extension: testCommand - ${text}`);
        //localize('changed', "{0} Log level changed to: {1}", logTimestamp()))//'changed', "{0} Log level changed to: {1}", logTimestamp(), LogLevel[Log.logLevel]));
    }
    private createCommand(id: string, key: string, method: Function, options: WatCommandOptions): (...args: any[]) => any {
        const result = (...args: any[]) => {
            let result: Promise<any>;

            result = Promise.resolve(method.apply(this, args));

        };
        // patch this object, so people can call methods directly
        (this as any)[key] = result;

        return result;
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}