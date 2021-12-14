import { commands as Commands, extensions as Extensions, Uri } from "vscode";
import { GitExtension } from "./git";


export class AddonTemplate {
    cloneTemplate(parentFolder: string){
        Commands.executeCommand('git.clone',['https://github.com/ChrisKader/wow-addon-template',])
    }
    constructor(){
    }
}