import { Response } from 'node-fetch';
import { Uri, workspace as Workspace } from 'vscode'
import { parse as YamlParse } from 'yaml'
import { fetchAgain } from './nodeFetchRetry';

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
}

export interface ApiTokens {
	curseforge?: string,
	wowinterface?: string,
	wago?: string,
	github?: string,
}

interface BaseObj { [key: string]: string; }
interface PkgMetaExternal {
	[key: string]: {
		url: string;
		tag?: number | string;
		branch?: string;
		commit?: string;
		type?: string;
	} | string
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

async function getSvnFiles(url: Uri): Promise<BaseObj[]> {
	const linkRex = /<li><a href="(?<href>.+)">(?<text>.+)<\/a><\/li>/gm;
	return await fetchAgain(url.toString(true)).then(async (res: Response) => {
		if (res.ok) {
			const pageText = await res.text();
			let rtnObj: BaseObj[] = [];
			return [...pageText.matchAll(linkRex)]
				.filter(v => v.groups)
				.reduce(async (pV, cV) => {
					const href = cV.groups?.href;
					if (href && href !== '../') {
						const nextUri = Uri.joinPath(url, href);
						if (href.substring(href.length - 1) === '/') {
							return (await pV).concat(await getSvnFiles(nextUri));
						} else {
							return fetchAgain(nextUri.toString(false)).then(async r => {
								(await pV).push({ [nextUri.toString(false)]: await r.text() });
								return await pV;
							});
						}
					} else {
						return pV;
					}
				}, Promise.resolve(rtnObj));
		} else {
			return [];
		}
	}).catch((reason) => {
		return []
	})
}

class WowPack {
	private tokens?: ApiTokens
	readonly packagerOptions: PackagerOptions = {
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
		labelTemplate: `{project-version}{classic}{nolib}`
	}
	pkgMetaType: string
	constructor(
		private readonly pkgMetaLocation: Uri,
		private readonly pkgMetaContent: string,
		options: PackagerOptions,
		tokens?: ApiTokens
	) {
		this.pkgMetaType = pkgMetaLocation.toString().indexOf('.yaml') ? 'yaml' : 'dot'
		let parsedPkgMeta: PkgMeta = YamlParse(pkgMetaContent)
		if (parsedPkgMeta.externals) {
			let external: keyof typeof parsedPkgMeta.externals;
			const oldGitRegex = /(?:.*(?<type>(?:git|svn|hg))(?<path>\.(?:curseforge|wowace)\.com\/.+)\/mainline(?<end>\/trunk)?)/;
			const svnCheckRegex = /^(?:svn|.+):\/{2}.+\..{3}(?:(?:.+)?\/trunk\/.+)/;
			for (external in parsedPkgMeta.externals) {
				let currentExternal = parsedPkgMeta.externals[external]
				let newUrl = ''
				let newType = 'git'

				if (typeof (currentExternal) === 'object') {
					newUrl = currentExternal.url
					newType = currentExternal.type || newType
				} else {
					newUrl = currentExternal
				}

				const matchRes = oldGitRegex.exec(newUrl)?.groups;
				if (matchRes && matchRes.path && matchRes.type) {
					newUrl = `https://repo${matchRes.path}${matchRes.end ? matchRes.end : ''}`
					newType = matchRes.type
				} else {
					if (newUrl.match(svnCheckRegex)) {
						newType = 'svn'
					} else if (true) {
						// check for hg
					}
				}

				if (typeof (currentExternal) === 'object') {
					currentExternal.url = newUrl
					currentExternal.type = newType
				} else {
					currentExternal = {
						url: newUrl,
						type: newType
					}
				}

				if (currentExternal.type === 'svn') {
					getSvnFiles(Uri.parse(newUrl));
				}
			}
		}
	}
}
export async function run(pkgMetaLocation: Uri, options: PackagerOptions, tokens?: ApiTokens): Promise<WowPack | Error> {
	let pkgMetaContent = (await Workspace.fs.readFile(pkgMetaLocation).then(t => t.toString())).toString()

	if (!pkgMetaContent) {
		return Error(`${pkgMetaLocation} cannot be accessed.`)
	}

	const rtnVal = new WowPack(pkgMetaLocation, pkgMetaContent, options, tokens)
	return rtnVal
}