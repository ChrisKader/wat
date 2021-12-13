import { Model } from './model';
import { Event, EventEmitter } from 'vscode';

export interface WatExtension {
    readonly enabled: boolean;
    readonly onDidChangeEnablement: Event<boolean>;
}

export class WatExtensionImpl implements WatExtension {

    enabled: boolean = false;

    private _onDidChangeEnablement = new EventEmitter<boolean>();
    readonly onDidChangeEnablement: Event<boolean> = this._onDidChangeEnablement.event;

    private _model: Model | undefined = undefined;

    set model(model: Model | undefined) {
        this._model = model;

        const enabled = !!model;

        if (this.enabled === enabled) {
            return;
        }

        this.enabled = enabled;
        this._onDidChangeEnablement.fire(this.enabled);
    }

    get model(): Model | undefined {
        return this._model;
    }

    constructor(model?: Model) {
        if (model) {
            this.enabled = true;
            this._model = model;
        }
    }
}