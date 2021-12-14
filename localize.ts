var nls = require('vscode-nls-dev');
const vscodeLanguages = [
	'zh-hans',
	'zh-hant',
	'ja',
	'ko',
	'de',
	'fr',
	'es',
	'ru',
	'it'
]; // languages an extension has to be translated to

const transifexApiHostname = 'www.transifex.com';
const transifexApiName = 'api';
const transifexApiToken = '1/73fabbd94ee59b2020ba67f7a7631f0d4393d8bb'; // token to talk to Transifex (to obtain it see https://docs.transifex.com/api/introduction#authentication)
const transifexProjectName = 'vscode-extensions'; // your project name in Transifex
const transifexExtensionName = 'vscode-node-debug'; // your resource name in Transifex

gulp.task('transifex-push', function() {
	return gulp.src('**/*.nls.json')
		.pipe(nls.prepareXlfFiles(transifexProjectName, transifexExtensionName))
		.pipe(nls.pushXlfFiles(transifexApiHostname, transifexApiName, transifexApiToken));
});

gulp.task('transifex-pull', function() {
	return nls.pullXlfFiles(transifexApiHostname, transifexApiName, transifexApiToken, vscodeLanguages, [{ name: transifexExtensionName, project: transifexProjectName }])
		.pipe(gulp.dest(`../${transifexExtensionName}-localization`));
});

gulp.task('i18n-import', function() {
	return gulp.src(`../${transifexExtensionName}-localization/**/*.xlf`)
		.pipe(nls.prepareJsonFiles())
		.pipe(gulp.dest('./i18n'));
});