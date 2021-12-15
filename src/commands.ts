import { readdir, readFile, writeFile, rename, rm, mkdtemp, stat, mkdir, access, copyFile } from 'fs/promises';
import path = require('path');
import { commands, Disposable, OutputChannel, window, Uri, workspace } from 'vscode';
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

    @command('wat.createAddon')
    async createAddon() {
        window.showInputBox({ title: 'Addon Name', placeHolder: 'Choose wisely! This will also be the folder name.' }).then(addonName => {
            if (addonName) {
                console.log(`Addon name: ${addonName}`)
                window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false }).then(async rootFolder => {
                    console.log(`Root Folder: ${rootFolder}`)
                    if (rootFolder && rootFolder[0]) {
                        const parentDir = rootFolder[0]
                        const addonRootDir = path.join(parentDir.fsPath, addonName)
                        console.log(`Addon Root Dir: ${addonRootDir}`)
                        mkdir(addonRootDir).then(async () => {
                            console.log(`Successfuly created Addon Root ${addonRootDir}`)
                            console.log(`Cloning template into ${addonRootDir}/wow-addon-template`)
                            await commands.executeCommand('git.clone', 'https://github.com/ChrisKader/wow-addon-template', addonRootDir)
                            const tempFolder = path.join(addonRootDir, 'wow-addon-template')
                            const gitFolderPath = path.join(tempFolder, '\/.git')
                            console.log(gitFolderPath)
                            console.log(`Clone successful .git directory exists in ${tempFolder}`)
                                const tempAddonSubDir = path.join(tempFolder, 'Addon')
                                const permAddonSubDir = path.join(tempFolder, addonName)
                                rename(tempAddonSubDir, permAddonSubDir).then(() => {
                                    console.log(`Addon subfolder renamed ${permAddonSubDir}`);
                                    readdir(permAddonSubDir, { withFileTypes: true }).then(entries => {
                                        entries.reduce((prevVal, entry) => {
                                            if (entry.isFile()) {
                                                const newFilePath = path.join(permAddonSubDir, entry.name.replace('Addon', addonName))
                                                rename(path.join(permAddonSubDir, entry.name), newFilePath).then(() => {
                                                    console.log(`Successfully renamed ${newFilePath}`)
                                                    readFile(newFilePath).then(file => {
                                                        return file.toString().replace(/@addon-name@/gm, addonName)
                                                    }).catch(err => {
                                                        throw Error(`Failed to read ${newFilePath}`)
                                                    }).then((newString) => {
                                                        writeFile(newFilePath, newString).then(() => {
                                                            console.log(`File ${newFilePath} updated.`)
                                                        }).catch((err) => {
                                                            throw Error(`Failed to write ${newFilePath} in subfolder ${permAddonSubDir} ${err}`)
                                                        });
                                                    })
                                                }).catch((err) => {
                                                    throw Error(`Failed to rename ${newFilePath} in subfolder ${path.join(tempFolder, addonName)} ${err}`)
                                                });
                                            };
                                            return prevVal
                                        }, []);
                                        const pkgMetaPath = path.join(tempFolder, 'pkgmeta.yaml')
                                        readFile(pkgMetaPath).then(buffer => buffer.toString().replace(/@addon-name@/gm, addonName)).catch(err => { throw Error(`Failed to read ${pkgMetaPath} ${err}`); })
                                            .then(newPkgMetaString => {
                                                writeFile(pkgMetaPath, newPkgMetaString).then(() => {
                                                    console.log(`File ${pkgMetaPath} updated.`);
                                                    rm(gitFolderPath, { force: true, recursive: true }).then(() => {
                                                        console.log(`Successfully deleted ${gitFolderPath} folder.`)
                                                        readdir(tempFolder, { withFileTypes: true }).then(async (entries) => {
                                                            entries.map(async entry => {
                                                                await copyFile(path.join(tempFolder, entry.name), path.join(addonRootDir, entry.name))
                                                            })
                                                        }).then(() => {
                                                            commands.executeCommand('vscode.openFolder', Uri.file(addonRootDir), true)
                                                        })
                                                    })
                                                }).catch((err_1) => {
                                                    throw Error(`Failed to write ${pkgMetaPath} in ${tempFolder} ${err_1}`);
                                                })
                                            })
                                    }).catch((err) => {
                                        throw Error(`Failed to rename Addon subfolder ${tempAddonSubDir} ${err}`)
                                    }).then(() => {

                                    })
                                }).catch(() => { console.log('eee') })
                        })
                    }
                })
            }
        })
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