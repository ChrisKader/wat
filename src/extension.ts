'use strict';

import {
	window as Window,
	commands as Commands,
	ExtensionContext
} from 'vscode';

import { AddonOutlineProvider } from './addonOutline';

export function activate(context: ExtensionContext) {

	const addonOutlineProvider = new AddonOutlineProvider(context);
	const view = Window.createTreeView('addonOutline',{treeDataProvider: addonOutlineProvider});
	context.subscriptions.push(view);
	Commands.registerCommand('addonOutline.refresh', () => addonOutlineProvider.refresh());
	Commands.registerCommand('addonOutline.refreshNode', offset => addonOutlineProvider.refresh(offset));
	Commands.registerCommand('addonOutline.renameNode', offset => addonOutlineProvider.rename(offset));
	Commands.registerCommand('extension.openJsonSelection', range => addonOutlineProvider.select(range));
}