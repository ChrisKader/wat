import { commands, Disposable, OutputChannel } from 'vscode';
import { Model } from './model';
import * as nls from 'vscode-nls';
import { logTimestamp } from './util';
const localize = nls.loadMessageBundle();
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