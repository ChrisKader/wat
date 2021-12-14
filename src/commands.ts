import { rename, renameSync,rm } from 'fs';
import { readdir, readFile, writeFile } from 'fs/promises';
import path = require('path');
import { commands, Disposable, OutputChannel, window, Uri } from 'vscode';
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
    async createAddon(){
        window.showInputBox({title: 'Addon Name',placeHolder: 'Choose wisely! This will also be the folder name.'}).then(addonName => {
            if(addonName){
                window.showOpenDialog({canSelectFiles: false, canSelectFolders: true, canSelectMany: false}).then(rootFolder => {
                    if(rootFolder){
                        console.log(rootFolder)
                        commands.executeCommand('git.clone','https://github.com/ChrisKader/wow-addon-template',rootFolder[0].path).then(()=>{
                            rename(path.join(rootFolder[0].path,'wow-addon-template'),path.join(rootFolder[0].path,addonName),()=>{
                                const defaultPath = path.join(rootFolder[0].path,addonName)
                                rm(path.join(defaultPath,'.git'),()=>{
                                    rename(path.join(defaultPath,'Addon'),path.join(defaultPath,addonName),()=>{
                                        readFile(path.join(defaultPath,addonName,'Addon.toc')).then(v=>{
                                            const newFileContent = v.toString().replace(/\@addon-name@/gm,addonName)
                                            writeFile(path.join(defaultPath,addonName,addonName + '.toc'),newFileContent).then(()=>{
                                                readFile(path.join(defaultPath,addonName,'Addon.lua')).then(v=>{
                                                    const newFileContent = v.toString().replace(/\@addon-name@/gm,addonName)
                                                    writeFile(path.join(defaultPath,addonName,addonName + '.lua'),newFileContent).then(()=>{
                                                        readFile(path.join(defaultPath,'pkgmeta.yaml')).then(v=>{
                                                            const newFileContent = v.toString().replace(/\@addon-name@/gm,addonName)
                                                            writeFile(path.join(defaultPath,'pkgmeta.yaml'),newFileContent).then(()=>{
                                                                rm(path.join(defaultPath,addonName,'Addon.toc'),()=>{
                                                                    rm(path.join(defaultPath,addonName,'Addon.lua'),()=>{
                                                                        commands.executeCommand('vscode.openFolder',Uri.file(path.join(defaultPath)))
                                                                    })
                                                                })
                                                            })
                                                        })
                                                    })
                                                })
                                            })
                                        })
                                    })
                                })
                            })
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