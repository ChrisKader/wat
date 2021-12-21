import { workspace as Workspace } from 'vscode'

export interface IPackagerOptions {
	skipCopy: boolean;                  // -c               Skip copying files into the package directory.
	skipUpload: boolean;                // -d               Skip uploading.
	skipExternalCheckout: boolean;      // -e               Skip checkout of external repositories.
	skipLocalization: boolean;          // -l               Skip @localization@ keyword replacement.
	skipLocalizationUpload: boolean;    // -L               Only do @localization@ keyword replacement (skip upload to CurseForge).
	keepExistingPackageDir: boolean;    // -o               Keep existing package directory, overwriting its contents.
	createNoLib: boolean;               // -s               Create a stripped-down "nolib" package.
	unixLineEndings: boolean;           // -u               Use Unix line-endings.
	skipZip: boolean;                   // -z               Skip zip file creation.
	topLevelDirectory: string;          // -t topdir        Set top-level directory of checkout.
	releaseDirectory: string;           // -r releasedir    Set directory containing the package directory. Defaults to "$topdir/.release".
	curseId: string;                    // -p curse-id      Set the project id used on CurseForge for localization and uploading. (Use 0 to unset the TOC value)
	wowInterfaceId: string;             // -w wowi-id       Set the addon id used on WoWInterface for uploading. (Use 0 to unset the TOC value)
	wagoId: string;                     // -a wago-id       Set the project id used on Wago Addons for uploading. (Use 0 to unset the TOC value)
	gameVersion: string;                // -g game-version  Set the game version to use for uploading.
	pgkMetaFile: string;                // -m pkgmeta.yaml  Set the pkgmeta file to use.
	zipFileName: string;                // -n "{template}"  Set the package zip file name and upload label. Use "-n help" for more info. */
}
class PackagerOptions {
	skipCopy = true;
	skipUpload = true;
	skipExternalCheckout = true;
	skipLocalization = true;
	skipLocalizationUpload = true;
	keepExistingPackageDir = true;
	createNoLib = true;
	unixLineEndings = true;
	skipZip = true;
	topLevelDirectory?: string = undefined;
	releaseDirectory?: string = undefined;
	curseId?: string = undefined;
	wowInterfaceId?: string = undefined;
	wagoId?: string = undefined;
	gameVersion?: string = undefined;
	pgkMetaFile?: string = undefined;
	zipFileName?: string = undefined;
	constructor(
		skipCopy?: boolean,
		skipUpload?: boolean,
		skipExternalCheckout?: boolean,
		skipLocalization?: boolean,
		skipLocalizationUpload?: boolean,
		keepExistingPackageDir?: boolean,
		createNoLib?: boolean,
		unixLineEndings?: boolean,
		skipZip?: boolean,
		topLevelDirectory?: string,
		releaseDirectory?: string,
		curseId?: string,
		wowInterfaceId?: string,
		wagoId?: string,
		gameVersion?: string,
		pgkMetaFile?: string,
		zipFileName?: string,
	) {
		if (topLevelDirectory) {
			Workspace.findFiles(topLevelDirectory).then((results) => {
				if (results.length > 0) {
					this.topLevelDirectory = topLevelDirectory
				}
			})
		}

		if (releaseDirectory) {
			Workspace.findFiles(releaseDirectory).then((results) => {
				if (results.length > 0) {
					this.releaseDirectory = releaseDirectory
				}
			})
		}
	}
}
function run(options: PackagerOptions) {

}