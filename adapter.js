import { basename, dirname, join, relative } from 'node:path';
import { cosmiconfig, defaultLoaders } from 'cosmiconfig';
import { JSDOM } from 'jsdom';
import { minify as minifier } from 'html-minifier-terser';
import { promises as $fs } from 'node:fs';
import crypto from 'node:crypto';
import glob from 'tiny-glob';
import JSON5 from 'json5';
import prettier from 'prettier';
import TOML from '@iarna/toml';

const { readFile, writeFile } = $fs;

/** @type {import('./index').AdapterOptions} */
const defaultOptions = {
	pages: 'build',
	assets: 'build',
	fallback: '',
	precompress: false,
	minify: false,
	injectTo: {},
	prettify: true,
	strict: false,
	targetExtension: '.html',
	replace: []
};

export async function transformFiles(builder, userOptions) {
	const options = {
		...defaultOptions,
		...userOptions
	};

	const sessionUUID = crypto.randomUUID();
	const htmlFiles = await glob('**/*.html', {
		cwd: options.pages,
		dot: true,
		absolute: true,
		filesOnly: true
	});

	await Promise.all(
		htmlFiles.map(async (htmlFile) => {
			const htmlContents = await readFile(htmlFile, 'utf8');
			const dom = new JSDOM(htmlContents);

			const targetElements = options?.injectTo ? Object.keys(options.injectTo) : [];

			targetElements.map((targetElement) => {
				if (!['head', 'body'].includes(targetElement)) {
					builder.log.warn(`Skipping unsupported injection element: ${targetElement}`);
					return;
				}

				const injectToPositions = Object.keys(options.injectTo[targetElement]);

				injectToPositions.map((injectToPosition) => {
					if (!['beforebegin', 'afterbegin', 'beforeend', 'afterend'].includes(injectToPosition)) {
						builder.log.warn(
							`Skipping unsupported insertAdjacentHTML position: ${injectToPosition}`
						);
						return;
					}

					const injectToPositions = Array.isArray(options.injectTo[targetElement][injectToPosition])
						? options.injectTo[targetElement][injectToPosition]
						: Array(options.injectTo[targetElement][injectToPosition]);

					injectToPositions.map((injectToText) => {
						const injectToHash = crypto.createHash('sha256').update(injectToText).digest('hex');
						const injectToTag = `<!-- inject:${sessionUUID}:${injectToHash} -->`;

						if (!options.replace.some((item) => item.from === injectToTag)) {
							options.replace.push({
								from: injectToTag,
								to: injectToText
							});
						}

						builder.log.minor(`Injecting to ${injectToPosition}: '${injectToText}'`);
						dom.window.document[targetElement].insertAdjacentHTML(injectToPosition, injectToTag);
					});
				});
			});

			let outputHTML;

			try {
				outputHTML = options.minify
					? await minifier(dom.serialize(), {
							collapseWhitespace: true,
							minifyCSS: true,
							minifyJS: true,
							removeComments: false,
							removeRedundantAttributes: true,
							useShortDoctype: true
					  })
					: options.prettify
					? prettier.format(dom.serialize(), await getPrettierConfig())
					: dom.serialize();

				builder.log.minor('Formatting markup');
			} catch (err) {
				builder.log.error('Formatting markup failed');
				throw Error(err);
			}

			const outFile = `${basename(htmlFile, '.html')}${options.targetExtension}`;
			const outPath = join(dirname(htmlFile), outFile);

			const phpContents =
				options.replace && Object.values(options.replace)?.length
					? options.replace.reduce((previousValue, currentValue) => {
							const replacer = currentValue.many ? 'replaceAll' : 'replace';

							if (!currentValue.from.startsWith('<!-- inject:sessionUUID:')) {
								builder.log.minor(
									`Replacing ${currentValue.many ? 'all ' : ''}'${currentValue.from}' → '${
										currentValue.to
									}'`
								);
							}

							return previousValue[replacer](currentValue.from, currentValue.to);
					  }, outputHTML)
					: outputHTML;

			try {
				builder.log.minor(`Writing to ${relative(options.pages, outPath)}`);
				await writeFile(outPath, phpContents);

				if (outPath !== htmlFile) {
					builder.log.minor(`Deleting ${relative(options.pages, htmlFile)}`);
					builder.rimraf(htmlFile);
				}
			} catch (err) {
				throw Error(err);
			}
		})
	);
}

export async function getPrettierConfig() {
	const explorer = cosmiconfig('prettier', {
		searchPlaces: [
			'package.json',
			'.prettierrc',
			'.prettierrc.json',
			'.prettierrc.yaml',
			'.prettierrc.yml',
			'.prettierrc.json5',
			'.prettierrc.js',
			'.prettierrc.cjs',
			'prettier.config.js',
			'prettier.config.cjs',
			'.prettierrc.toml'
		],
		loaders: {
			'.toml': (filePath, content) => {
				try {
					return TOML.parse(content);
				} catch (error) {
					error.message = `TOML Error in ${filePath}:\n${error.message}`;
					throw error;
				}
			},
			'.json5': (filePath, content) => {
				try {
					return JSON5.parse(content);
				} catch (error) {
					error.message = `TOML Error in ${filePath}:\n${error.message}`;
					throw error;
				}
			},
			noExt: defaultLoaders['.json']
		}
	});

	let results = await explorer.search();

	if (results) {
		return results.config;
	}

	return {
		parser: 'html',
		printWidth: Infinity
	};
}
