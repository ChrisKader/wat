'use strict';

import {
	window as Window,
	commands as Commands,
	OutputChannel,
	ExtensionContext,
	Disposable
} from 'vscode';
import { CommandCenter } from './commands';
import { WatDecorations } from './decorationProvider';
import { WatExtensionImpl } from './extension';
import { WatFileSystemProvider } from './fileSystemProvider';
import { Model } from './model';
import { TocOutlineProvider } from './tocOutline';
import { logTimestamp } from './util';

export async function activate1(context: ExtensionContext) {
	const disposables: Disposable[] = [];
	const addonOutlineProvider = new TocOutlineProvider();
	const view = Window.createTreeView('addonOutline',{treeDataProvider: addonOutlineProvider});
	//const tocDecorations = new WatDecorations(addonOutlineProvider);
	//disposables.push(tocDecorations);
	context.subscriptions.push(view);
	Commands.registerCommand('addonOutline.refresh', () => addonOutlineProvider.refresh());
	Commands.registerCommand('addonOutline.openFile', (s) => addonOutlineProvider.openFile(s));
	Commands.registerCommand('addonOutline.refreshNode', offset => addonOutlineProvider.refresh(offset));
	Commands.registerCommand('addonOutline.renameNode', offset => addonOutlineProvider.rename(offset));
	Commands.registerCommand('extension.openJsonSelection', range => addonOutlineProvider.select(range));
}


async function createModel(context: ExtensionContext, outputChannel: OutputChannel, disposables: Disposable[]): Promise<Model> {
	const model = new Model(context, outputChannel);
	disposables.push(model);

	//outputChannel.appendLine();

	const onOutput = (str: string) => {
		const lines = str.split(/\r?\n/mg);

		while (/^\s*$/.test(lines[lines.length - 1])) {
			lines.pop();
		}

		outputChannel.appendLine(`${logTimestamp()} ${lines.join('\n')}`);
	};
	const cc = new CommandCenter(model, outputChannel);
	disposables.push(
		cc,
		new WatFileSystemProvider(model),
		new WatDecorations(model),
	);

	return model;
}


export async function _activate(context: ExtensionContext): Promise<WatExtensionImpl>{
	const disposables: Disposable[] = [];
	context.subscriptions.push(new Disposable(() => Disposable.from(...disposables).dispose()));

	const outputChannel = Window.createOutputChannel('WoW Addon Tools');
	disposables.push(outputChannel);
	try {
		const model = await createModel(context, outputChannel, disposables);
		return new WatExtensionImpl(model);
	} catch (err:any){

		console.warn(err.message);
		outputChannel.appendLine(`${logTimestamp()} ${err.message}`);

		//Commands.executeCommand('setContext', 'git.missing', true);

		return new WatExtensionImpl();
	}
}

let _context: ExtensionContext;
export function getExtensionContext(): ExtensionContext {
	return _context;
}

export async function activate(context: ExtensionContext): Promise<WatExtensionImpl> {
	_context = context;

	const result = await _activate(context);
	return result;
}