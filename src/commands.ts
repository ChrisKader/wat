import { realfs } from './fs';
import * as path from 'path';
import { commands, Disposable, extensions as Extensions, OutputChannel, window, Uri } from 'vscode';
import { GitExtension } from './git';
import { fetchAgain } from './nodeFetchRetry';
import { Model } from './model';
import { logTimestamp } from './util';
import { Response } from 'node-fetch/';
interface WatCommandOptions {
	uri?: boolean;
}

interface WatCommand {
	commandId: string;
	key: string;
	method: Function;
	options: WatCommandOptions;
}
interface BaseObj {
	baseUrl: string;
	files: Map<string, string>;
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
		const files = await realfs.readdir(directory);
		for (const file of files) {
			const p = path.join(directory, file);
			if ((await realfs.stat(p)).isDirectory()) {
				fileList = [...fileList, ...(await this.walkDir(p))];
			} else {
				fileList.push(p);
			}
		}
		return fileList;
	}

	async getSvnLibrary(baseUrl: Uri): Promise<BaseObj> {
		const linkRex = /<li><a href="(?<href>.+)">(?<text>.+)<\/a><\/li>/gm;
		let rtnObj = {
			baseUrl: baseUrl.toString(true),
			files: new Map<string, string>()
		};
		return await fetchAgain(baseUrl.toString(true)).then(async (res: Response) => {
			if (res.ok) {
				const pageText = await res.text();
				return [...pageText.matchAll(linkRex)]
					.filter(v => v.groups)
					.reduce(async (rtnObj, currentResult) => {
						const href = currentResult.groups?.href;
						// check if we got a link and ensure its not a link that goes backwards.
						if (href && href !== '../') {
							// Join new link with the base url to get the full path.
							const nextUri = Uri.joinPath(baseUrl, href);
							// if the link ends with a /, then its a directory.
							if (href.substring(href.length) === '/') {
								const dirEntries = (await this.getSvnLibrary(nextUri));
								(await rtnObj).files = Object.assign({}, (await rtnObj).files, dirEntries.files);
								return rtnObj;
								//return (await fileArray).concat(await this.getSvnLibrary(nextUri));
							} else {
								// if not a directory, attempt to fetch the text value of the file and add it to the array.
								return fetchAgain(nextUri.toString(false)).then(async r => {
									//(await fileArray).push({ [nextUri.toString(false)]: await r.text() });
									(await rtnObj).files.set(href, await r.text());
									return rtnObj;
								});
							}
						} else {
							return rtnObj;
						}
					}, Promise.resolve(rtnObj));
			} else {
				return Promise.reject(res.statusText);
			}
		}).catch((r) => {
			throw Error(`${r}`);
		});
	}

	@command('wat.createAddon')
	async createAddon() {
		const list = await this.getSvnLibrary(Uri.parse('https://repos.curseforge.com/wow/ace3/trunk/AceConfig-3.0/'));
		console.log(list);
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
						const templateGit = 'https://github.com/chriskader/wow-addon-template';
						const addonRootDir = path.join(parentDir.fsPath, addonName);
						this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Addon Root Directory: ${addonRootDir}`);
						try {
							const addonReplaceReg = /@addon-name@/gm;
							this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Making Addon Directory at ${addonRootDir}`);
							await realfs.mkdir(addonRootDir);
							this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: git.init in ${addonRootDir}`);
							await git.init(addonRootDir);
							this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: git.open in ${addonRootDir}`);
							let templateRepo = git.open(addonRootDir, '.git');
							await templateRepo.addRemote('origin', templateGit);
							await templateRepo.fetch();
							await templateRepo.checkout('origin/default', [], {});
							/*
								Due to the git extension opening a showInformationMessage (small user prompt at the bottom left of the screen)
								and holding code execution until its clicked, we are calling the git.clone function directly from the vscode.git extension model.
							*/
							//commands.executeCommand('git.clone', templateGit, parentDir.fsPath).then(async ()=>{});
							/* const opts = {
								location: ProgressLocation.Notification,
								title: `Cloning ${templateGit} to ${parentDir.path}`,
								cancellable: true
							};
							const repositoryPath = await window.withProgress(
								opts,
								(progress, token) => git.clone(templateGit!, { parentPath: parentDir.fsPath!, progress }, token)
							); */
							await realfs.rm(path.join(addonRootDir, 'README.md')).then(async () => {
								await realfs.rename(path.join(addonRootDir, '_README.md'), path.join(addonRootDir, 'README.md'));
								await realfs.rename(path.join(addonRootDir, 'Addon'), path.join(addonRootDir, addonName));
								await realfs.readdir(addonRootDir, { withFileTypes: true }).then(async fileList => {
									for (let file of fileList) {
										const fileName = path.join(addonRootDir, file.name);
										if (file.isDirectory()) {
											if (file.name === '.git') {
												await realfs.rm(fileName, { force: true, recursive: true });
												this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Deleted ${fileName}`);
											}
											if (file.name === addonName) {
												const extList = ['toc', 'lua'];
												for (let ext of extList) {
													const oldFileName = path.join(fileName, `Addon.${ext}`);
													const newFileName = path.join(fileName, `${addonName}.${ext}`);
													await realfs.rename(oldFileName, newFileName).then(async () => {
														this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Renamed ${oldFileName} to ${newFileName}`);
														await realfs.readFile(newFileName).then(async fileBuffer => {
															this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Reading ${newFileName}`);
															await realfs.writeFile(newFileName, fileBuffer.toString().replace(addonReplaceReg, addonName));
															this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Writing ${newFileName}`);
														});
													});
												};
											};
										}
										if (file.isFile()) {
											if (file.name === 'pkgmeta.yaml' || file.name === 'README.md') {
												await realfs.readFile(fileName).then(async fileBuffer => {
													this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Reading ${fileName}`);
													await realfs.writeFile(fileName, fileBuffer.toString().replace(addonReplaceReg, addonName));
													this.outputChannel.appendLine(`${logTimestamp()}: wat.createAddon: Writing ${fileName}`);
												});
											};
										};
									};
								});
								await realfs.mkdir(path.join(addonRootDir, addonName, 'libs')).catch((err) => {
									throw err;
								});
								commands.executeCommand('vscode.openFolder', Uri.file(addonRootDir), true);
							});
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