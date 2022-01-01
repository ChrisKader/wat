import oldFetch, { BodyMixin, Response } from 'node-fetch';
import * as path from 'path';
import { OutputChannel, Uri, workspace as Workspace } from 'vscode'
import { parse as YamlParse } from 'yaml'
import { WatOutputChannel } from './main';
import { logTimestamp, mkdirp } from './util';

const fetch: typeof oldFetch = require('fetch-retry')(oldFetch, {
	retries: 5,
	retryDelay: 800
})

export interface ApiTokens {
	curseforge?: string,
	wowinterface?: string,
	wago?: string,
	github?: string,
}

export interface PackagerOptions {
	createNoLib?: boolean;           // -s               Create a stripped-down "nolib" package.
	curseId?: string;                // -p curse-id      Set the project id used on CurseForge for localization and uploading. (Use 0 to unset the TOC value)
	gameVersion?: string;            // -g game-version  Set the game version to use for uploading.
	keepExistingPackageDir?: boolean;// -o               Keep existing package directory, overwriting its contents.
	pgkMetaFile?: string;            // -m pkgmeta.yaml  Set the pkgmeta file to use.
	releaseDirectory?: string;       // -r releasedir    Set directory containing the package directory. Defaults to "$topdir/.release".
	skipCopy?: boolean;              // -c               Skip copying files into the package directory.
	skipExternalCheckout?: boolean;  // -e               Skip checkout of external repositories.
	skipLocalization?: boolean;      // -l               Skip @localization@ keyword replacement.
	skipLocalizationUpload?: boolean;// -L               Only do @localization@ keyword replacement (skip upload to CurseForge).
	skipUpload?: boolean;            // -d               Skip uploading.
	skipZip?: boolean;               // -z               Skip zip file creation.
	topLevelDirectory?: string;      // -t topdir        Set top-level directory of checkout.
	unixLineEndings?: boolean;       // -u               Use Unix line-endings.
	wagoId?: string;                 // -a wago-id       Set the project id used on Wago Addons for uploading. (Use 0 to unset the TOC value)
	wowInterfaceId?: string;         // -w wowi-id       Set the addon id used on WoWInterface for uploading. (Use 0 to unset the TOC value)
	zipFileName?: string;            // -n "{template}"  Set the package zip file name and upload label. Use "-n help" for more info. */
	labelTemplate?: string;
	tokens?: ApiTokens;
}

interface BaseObj { [key: string]: string; }
class EpocTime {
	_date: Date
	public getTime() {
		return this._date.getTime() / 1000
	}
	constructor(
		timestamp?: number
	) {
		if (timestamp) {
			this._date = new Date(timestamp * 1000)
		} else {
			this._date = new Date()
		}
	}
}
class ExternalCacheEntry {
	public updated: number;
	public _updating: boolean;
	private readonly expiration: number
	public readonly added: number;
	public readonly files: Map<Uri, Buffer>;

	public addFile(filename: Uri, fileContents: Buffer) {
		this.files.set(filename, fileContents)
		this.updated = new EpocTime().getTime()
	}

	public getFile(filename: Uri) {
		return this.files.get(filename)
	}

	public get expired() {
		return new EpocTime().getTime() > this.expiration
	}

	get updating() {
		return this._updating
	}

	set updating(updating: boolean) {
		this._updating = updating
	}

	/**
		 * Create a new notebook range. If `start` is not
		 * before or equal to `end`, the values will be swapped.
		 *
		 * @param url Uri of the external library.
		 * @param expiration Number of seconds from creatation (max of 7 days or 604800).
		 * If larger then 7 days then then the value will be used as the epoch time if it is after the current time.
		 * If the value is not provided or not valid (Not a time after the current time), then the default expiration will be set to 3 days.
		 */
	constructor(
		public url: Uri,
		expiration?: number
	) {
		const currentTime = new EpocTime().getTime()

		this.added = new EpocTime().getTime()
		this.updated = new EpocTime().getTime()
		this.files = new Map()
		this._updating = true;

		if (expiration) {
			if (expiration <= 604800) {
				this.expiration = currentTime + expiration
			} else if (expiration > currentTime) {
				this.expiration = new EpocTime(expiration).getTime()
			} else {
				this.expiration = currentTime + 259200
			}
		} else {
			this.expiration = currentTime + 259200
		}
	}
}

interface PkgMetaExternalSub {
	url: string;
	tag?: number | string;
	branch?: string;
	commit?: string;
	type?: string;
}

interface PkgMetaExternal {
	[key: string]: {
		url: string;
		tag?: number | string;
		branch?: string;
		commit?: string;
		type?: string;
	}
}

interface PkgMetaMoveFolders {
	[key: string]: string
}

interface PkgMetaManualChangelog {
	filename: string;
	"markup-type": string;
}

interface PkgMeta {
	"package-as": string;
	"externals"?: PkgMetaExternal;
	"move-folders"?: PkgMetaMoveFolders;
	"ignore"?: string[];
	"required-dependencies"?: string[];
	"optional-dependencies"?: string[];
	"manual-changelog"?: PkgMetaManualChangelog;
	"license-output"?: string;
	"embdded-libraries"?: string[];
	"tools-used"?: string[];
	"enable-nolib-creation"?: string;
}
const pkgMetaKeywords = {
	project: {
		projectRevision: '@project-revision@',
		projectHash: '@project-hash@',
		projectAbbreviatedHash: '@project-abbreviated-hash@',
		projectAuthor: '@project-author@',
		projectDateIso: '@project-date-iso@',
		projectDateInteger: '@project-date-integer@',
		projectTimestamp: '@project-timestamp@',
		projectVersion: '@project-version@',
	},
	file: {
		fileRevision: '@file-revision@',
		fileHash: '@file-hash@',
		fileAbbreviatedHash: '@file-abbreviated-hash@',
		fileAuthor: '@file-author@',
		fileDateIso: '@file-date-iso@',
		fileDateInteger: '@file-date-integer@',
		fileTimestamp: '@file-timestamp@',
	}
}

const gameFlavors = {
	retail: 'mainline',
	classic: 'classic',
	bcc: 'bcc'
}
const regExObj = {
	oldReposRegex: /(?:.*(?<type>(?:git|svn|hg))(?<path>\.(?:curseforge|wowace)\.com\/.+)\/mainline(?<end>\/trunk)?)/,
	svnCheckRegex: /^(?:svn|.+):\/{2}.+\..+(?:(?:.+)?\/trunk\/)/
}
export class WowPack {
	private _directives: {
		"package-as": string;
		"externals"?: PkgMetaExternal;
		"move-folders"?: PkgMetaMoveFolders;
		"ignore"?: string[];
		"required-dependencies"?: string[];
		"optional-dependencies"?: string[];
		"manual-changelog"?: PkgMetaManualChangelog;
		"license-output"?: string;
		"embdded-libraries"?: string[];
		"tools-used"?: string[];
		"enable-nolib-creation"?: string;
	}
	get directives() {
		return this._directives
	}

	private _packagerOptions: PackagerOptions = {
		createNoLib: false,
		curseId: undefined,
		gameVersion: undefined,
		keepExistingPackageDir: false,
		pgkMetaFile: undefined,
		releaseDirectory: undefined,
		skipCopy: false,
		skipExternalCheckout: false,
		skipLocalization: false,
		skipLocalizationUpload: false,
		skipUpload: false,
		skipZip: false,
		topLevelDirectory: undefined,
		unixLineEndings: false,
		wagoId: undefined,
		wowInterfaceId: undefined,
		zipFileName: `{package-name}-{project-version}{nolib}{classic}`,
		labelTemplate: `{project-version}{classic}{nolib}`,
		tokens: undefined
	}
	private _fileCache = new Map<Uri, Response>()

	async fetch(url: RequestInfo, init?: RequestInit | undefined) {
		const _url = typeof (url) === 'string' ? url : url.url;
		const uri = Uri.parse(_url)
		if (!this._fileCache.has(uri)) {
			const r = await fetch(_url);
			if (r.ok) {
				return this.addCachedFile(uri, r.clone())!
			} else {
				return r
			}
		} else {
			return this.getCachedFile(uri)!
		}
	}

	addCachedFile(url: Uri, fileContents: Response) {
		this._fileCache.set(url, fileContents)
		return this._fileCache.get(url)
	}

	getCachedFile(url: Uri): Response | undefined {
		return this._fileCache.get(url)
	}

	pkgMetaType: string
	constructor(
		public pkgMetaLocation: Uri,
		public readonly pkgMetaContent: string,
		options: PackagerOptions,
		private outputChannel: WatOutputChannel
	) {
		if (pkgMetaContent.length === 0) {
			this.pkgMetaType = 'error'
			this._directives = {
				"package-as": 'error'
			}
		} else {
			this._packagerOptions = { ...this._packagerOptions, ...options }
			this.pkgMetaType = pkgMetaLocation.toString().indexOf('.yaml') > -1 ? 'yaml' : 'dot'
			this._directives = YamlParse(pkgMetaContent, {
				reviver: (key, value: any) => {
					if (key === 'externals' && typeof (value) === 'object') {
						let externals: { [key: string]: { url: string } } = {}
						Object.keys(value).map(key => {
							let newExternal = {
								url: '',
								type: 'git'
							}
							if (typeof (value[key]) === 'string') {
								newExternal.url = value[key]
							} else {
								newExternal = Object.assign({}, value[key])
							};
							newExternal.url = newExternal.url + '/'
							const oldReposMatches = regExObj.oldReposRegex.exec(newExternal.url)?.groups;
							if (oldReposMatches && oldReposMatches.path && oldReposMatches.type) {
								newExternal.url = `https://repo${oldReposMatches.path}${oldReposMatches.end ? oldReposMatches.end : ''}`
								newExternal.type = oldReposMatches.type
							} else {
								if (newExternal.url.match(regExObj.svnCheckRegex)) {
									newExternal.type = 'svn'
								}
								//TODO: Check for mercurial repos.
							}

							externals[key] = newExternal
						})
						return externals
					} else {
						return value
					}
				},
			})
		}
	}
	//aid: 161023
	//cid: Iv1.910a222818df22ca
	//cis: 591bf8d877be01468f133f6cc94346eeeab40a2d
	async getGitFiles(external: PkgMetaExternalSub) {
		const shortRepo = external.url.substring(external.url.indexOf('github.com/') + 11)
		if (shortRepo) {
			await this.fetch(`https://api.github.com/repos/${shortRepo.substring(0, shortRepo.length - 1)}`, {}).then(async (res) => {
				if (res.ok) {
					const repoInfo = await res.json()

				} else {

				}
			})
		}
	}
	async crawlSvn(url: string): Promise<Map<Uri, { name: string, contents: Buffer }>> {
		const linkRex = /<li><a href="(?<href>.+)">(?<text>.+)<\/a><\/li>/gm;
		return await this.fetch(url).then(async (res: Response): Promise<Map<Uri, { name: string; contents: Buffer; }>> => {
			if (res.ok) {
				return [...(await res.text()).matchAll(linkRex)]
					.filter(v => typeof (v.groups) !== 'undefined' && typeof (v.groups.href) !== 'undefined')
					.reduce(async (_accumulator, current) => {
						const href = current.groups?.href;
						if (href && href !== '../') {
							let newUri = Uri.parse(path.join(url, href))
							if (href.substring(href.length - 1) === '/') {
								[...await this.crawlSvn(newUri.toString(true))].map(async (v) => {
									(await _accumulator).set(v[0], {
										name: path.join(href, v[1].name),
										contents: v[1].contents
									});
								})
							} else {
								(await _accumulator).set(newUri, {
									name: href,
									contents: await (await this.fetch(newUri.toString(true))).buffer()
								})
							}
						}
						return _accumulator
					}, Promise.resolve(new Map<Uri, { name: string, contents: Buffer }>()));
			} else {
				return Promise.resolve(new Map())
			}
		})
	}
	async getSvnFiles(url: Uri, installPath: Uri): Promise<BaseObj[]> {
		let rtnObj: BaseObj[] = []
		this.outputChannel.appendLine(`Installing ${url} at ${installPath.fsPath}`, 'packager.ts');
		return await Workspace.fs.createDirectory(Uri.file(installPath.fsPath)).then(async () => {
			let fileResults = await (this.crawlSvn(url.toString(true)))
			if (fileResults.size > 0) {
				for (let file of fileResults) {
					const filePath = Uri.file(path.join(installPath.fsPath, file[1].name))
					rtnObj.push({ [file[1].name]: `Write to ${filePath.fsPath}` })
					/* await Workspace.fs.writeFile(filePath, file[1].contents).then(() => {
						rtnObj.push({ [filePath.fsPath]: 'success' })
					}) */
				}
			}
			return rtnObj
		})
	}

	async installExternals(parentFolder: Uri) {
		if (this._directives.externals) {
			Object.keys(this._directives.externals).map(async installPath => {
				const currentExternal = this._directives.externals![installPath];
				if (currentExternal.type === 'svn') {
					const libraryInstallPath = Uri.file(path.join(parentFolder.fsPath, installPath, '/'))
					let externalInstallResult = await this.getSvnFiles(Uri.parse(currentExternal.url), libraryInstallPath)
				}
				if (currentExternal.type === 'git') {
					const libraryInstallPath = Uri.file(path.join(parentFolder.fsPath, installPath, '/'))
					let externalInstallResult = await this.getGitFiles(currentExternal)
				}
			})
		}
	}
}
export async function parsePkgMeta(pkgMetaLocation: Uri, options: PackagerOptions, outputChannel: WatOutputChannel): Promise<WowPack> {
	let pkgMetaContent = (await Workspace.fs.readFile(pkgMetaLocation).then(t => t.toString())).toString()

	if (!pkgMetaContent) {
		return new WowPack(pkgMetaLocation, '', options, outputChannel)
	} else {
		return new WowPack(pkgMetaLocation, pkgMetaContent, options, outputChannel)
	}
}