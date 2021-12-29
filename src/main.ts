'use strict';

import { CommandCenter } from './commands';
import { WatDecorations } from './decorationProvider';
import { WatExtensionImpl } from './extension';
import { WatFileSystemProvider } from './fileSystemProvider';
import { Model } from './model';
import { logTimestamp } from './util';

import {
	commands as Commands,
	Disposable,
	ExtensionContext,
	OutputChannel,
	StatusBarItem,
	window as Window,
} from 'vscode';
import { TocOutlineProvider } from './tocOutline';

let _context: ExtensionContext;

export class WatOutputChannel {
	private readonly _channel: OutputChannel;
	typeArray = [
		'DEBUG',
		'WARN',
		'INFO'
	]

	dispose() {
		this._channel
	}
	private get debugMessageHeader() {
		return `<${this.extLongName}(${this.extShortName})-${this.extVersion}>`
	}

	appendLine(text: string, fromFile: string, type?: number) {
		const linePrefix = `${logTimestamp()}${this._enableDebug ? this.debugMessageHeader : ''}`
		this._channel.appendLine(`${linePrefix}${type && this.typeArray[type] || ''}: ${fromFile}: ${text}`);
	}

	_enableDebug = false
	set enableDebug(toggle: boolean) {
		this._enableDebug = toggle
	}
	constructor(
		channelName: string,
		private extLongName: string,
		private extShortName: string,
		private extVersion: string
	) {
		this._channel = Window.createOutputChannel(channelName)
	}
}

async function createModel(context: ExtensionContext, outputChannel: WatOutputChannel, disposables: Disposable[]): Promise<Model> {
	const tocOutlineProvider = new TocOutlineProvider(context);
	const model = new Model(context, outputChannel, tocOutlineProvider);

	disposables.push(
		model,
		new CommandCenter(model, outputChannel),
		new WatDecorations(model),
		new WatFileSystemProvider(model),
	);

	return model;
}

export async function _activate(context: ExtensionContext): Promise<WatExtensionImpl> {
	context.globalState.update('loadStatus', 'loading')

	const { displayName, name, version } = require('../package.json') as { displayName: string, name: string, version: string };
	const outputChannel = new WatOutputChannel('WoW Addon Tools', displayName, name, version)

	outputChannel.appendLine(`${displayName}(${name}):${version}`, 'main.ts', 2)
	outputChannel.appendLine(`_activate function started`, 'main.ts', 0)

	const disposables: Disposable[] = [];
	context.subscriptions.push(new Disposable(() => Disposable.from(...disposables).dispose()));
	disposables.push(outputChannel);

	try {
		const model = await createModel(context, outputChannel, disposables);
		return new WatExtensionImpl(model);
	} catch (err: any) {
		outputChannel.appendLine(`Failed to create model: ${err.message}`, 'main.ts', 1);
		context.globalState.update('loadStatus', 'failed')
		return new WatExtensionImpl();
	}
}

export function getExtensionContext(): ExtensionContext {
	return _context;
}

export async function activate(context: ExtensionContext): Promise<WatExtensionImpl> {
	_context = context;

	return await _activate(getExtensionContext());;
}