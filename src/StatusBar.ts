import { Command, Disposable, EventEmitter, Event, StatusBarItem, window as Window } from 'vscode'
import { WowPack } from './packager'
import { TocOutline } from './tocOutlineProvider'


interface WatStatusBarState {
	readonly enabled: boolean;
	readonly isParseRunning: boolean;
	readonly hasTocFiles: boolean;
	readonly hasPkgMetaFiles: boolean;
	readonly PkgMetaFiles: WowPack[],
	readonly TocFiles: TocOutline[]
}

export class WatStatusBarItem {
	private readonly _statusBarItem: StatusBarItem

	set text(text: string) {
		this._statusBarItem.text = text
	}

	set show(show: boolean) {
		if (typeof (show) === 'boolean') {
			if (show === true) {
				this._statusBarItem.show()
			} else {
				this._statusBarItem.hide()
			}
		}
	}

	constructor() {
		this._statusBarItem = Window.createStatusBarItem('watStatusBar')
		//TODO: Setup config option to hide.
	}
}