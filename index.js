import { basename, dirname, join, relative } from 'node:path';
import { cosmiconfig, defaultLoaders } from 'cosmiconfig';
import { createReadStream, createWriteStream, promises as $fs, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { minify as minifier } from 'html-minifier-terser';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import glob from 'tiny-glob';
import JSON5 from 'json5';
import prettier from 'prettier';
import TOML from '@iarna/toml';
import zlib from 'node:zlib';

const { readFile, writeFile } = $fs;
const pipe = promisify(pipeline);

/** @type {import('.')} */
export default function ({
	pages = 'build',
	assets = pages,
	fallback,
	precompress = false,
	minify = false,
	injectTo = {},
	prettify = true,
	targetExtension = '.html',
	replace = []
} = {}) {
	return {
		name: 'sveltekit-adapter-html-like',

		async adapt(builder) {
			if (minify && prettify) {
				throw Error('You can not minify and prettify at the same time');
			}

			builder.rimraf(assets);
			builder.rimraf(pages);

			builder.writePrerendered(pages, { fallback });
			builder.writeClient(assets);

			if (precompress) {
				if (pages === assets) {
					builder.log.minor('Compressing assets and pages');
					await compress(assets);
				} else {
					builder.log.minor('Compressing assets');
					await compress(assets);

					builder.log.minor('Compressing pages');
					await compress(pages);
				}
			}

			if (pages === assets) {
				builder.log(`Wrote site to "${pages}"`);
			} else {
				builder.log(`Wrote pages to "${pages}" and assets to "${assets}"`);
			}

			const sessionUUID = crypto.randomUUID();
			const htmlFiles = await glob('**/*.html', {
				cwd: pages,
				dot: true,
				absolute: true,
				filesOnly: true
			});

			await Promise.all(
				htmlFiles.map(async (htmlFile) => {
					const htmlContents = await readFile(htmlFile, 'utf8');
					const dom = new JSDOM(htmlContents);

					const targetElements = Object.keys(injectTo);

					targetElements.map((targetElement) => {
						if (!['head', 'body'].includes(targetElement)) {
							builder.log.warn(`Skipping unsupported injection element: ${targetElement}`);
							return;
						}

						const injectToPositions = Object.keys(injectTo[targetElement]);

						injectToPositions.map((injectToPosition) => {
							if (
								!['beforebegin', 'afterbegin', 'beforeend', 'afterend'].includes(injectToPosition)
							) {
								builder.log.warn(
									`Skipping unsupported insertAdjacentHTML position: ${injectToPosition}`
								);
								return;
							}

							const injectToPositions = Array.isArray(injectTo[targetElement][injectToPosition])
								? injectTo[targetElement][injectToPosition]
								: Array(injectTo[targetElement][injectToPosition]);

							injectToPositions.map((injectToText) => {
								const injectToHash = crypto.createHash('sha256').update(injectToText).digest('hex');
								const injectToTag = `<!-- inject:${sessionUUID}:${injectToHash} -->`;

								if (!replace.some((item) => item.from === injectToTag)) {
									replace.push({
										from: injectToTag,
										to: injectToText
									});
								}

								builder.log.minor(`Injecting to ${injectToPosition}: '${injectToText}'`);
								dom.window.document[targetElement].insertAdjacentHTML(
									injectToPosition,
									injectToTag
								);
							});
						});
					});

					let outputHTML;

					try {
						outputHTML = minify
							? await minifier(dom.serialize(), {
									collapseWhitespace: true,
									minifyCSS: true,
									minifyJS: true,
									removeComments: false,
									removeRedundantAttributes: true,
									useShortDoctype: true
							  })
							: prettify
							? prettier.format(dom.serialize(), await getPrettierConfig())
							: dom.serialize();

						builder.log.minor('Formatting markup');
					} catch (err) {
						builder.log.error('Formatting markup failed');
						throw Error(err);
					}

					const outFile = `${basename(htmlFile, '.html')}${targetExtension}`;
					const outPath = join(dirname(htmlFile), outFile);

					const phpContents =
						replace && Object.values(replace)?.length
							? replace.reduce((previousValue, currentValue) => {
									const replacer = currentValue.many ? 'replaceAll' : 'replace';

									if (!currentValue.from.startsWith('<!-- inject:sessionUUID:')) {
										builder.log.minor(
											`Replacing ${currentValue.many ? 'all ' : ''}'${currentValue.from}' ??? '${
												currentValue.to
											}'`
										);
									}

									return previousValue[replacer](currentValue.from, currentValue.to);
							  }, outputHTML)
							: outputHTML;

					try {
						builder.log.minor(`Writing to ${relative(pages, outPath)}`);
						await writeFile(outPath, phpContents);

						if (outPath !== htmlFile) {
							builder.log.minor(`Deleting ${relative(pages, htmlFile)}`);
							builder.rimraf(htmlFile);
						}
					} catch (err) {
						throw Error(err);
					}
				})
			);
		}
	};
}

/**
 * @param {string} directory
 */
async function compress(directory) {
	const files = await glob('**/*.{html,js,json,css,svg,xml,wasm}', {
		cwd: directory,
		dot: true,
		absolute: true,
		filesOnly: true
	});

	await Promise.all(
		files.map((file) => Promise.all([compress_file(file, 'gz'), compress_file(file, 'br')]))
	);
}

/**
 * @param {string} file
 * @param {'gz' | 'br'} format
 */
async function compress_file(file, format = 'gz') {
	const compress =
		format == 'br'
			? zlib.createBrotliCompress({
					params: {
						[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
						[zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
						[zlib.constants.BROTLI_PARAM_SIZE_HINT]: statSync(file).size
					}
			  })
			: zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });

	const source = createReadStream(file);
	const destination = createWriteStream(`${file}.${format}`);

	await pipe(source, compress, destination);
}

async function getPrettierConfig() {
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
