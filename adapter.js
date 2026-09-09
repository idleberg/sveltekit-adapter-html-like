import { basename, dirname, join, relative } from 'node:path';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { minify as minifier } from 'html-minifier-terser';
import prettier from 'prettier';

/** @type {Required<Pick<import('./index.js').AdapterOptions, 'pages' | 'minify' | 'injectTo' | 'prettify' | 'targetExtension' | 'replace'>>} */
const defaultOptions = {
	pages: 'build',
	minify: false,
	injectTo: {},
	prettify: true,
	targetExtension: '.html',
	replace: []
};

const INJECT_POSITIONS = ['beforebegin', 'afterbegin', 'beforeend', 'afterend'];

/**
 * @param {import('./internal.js').Builder2_0_0} builder
 * @param {import('./index.js').AdapterOptions} [userOptions]
 */
export async function transformFiles(builder, userOptions) {
	const options = { ...defaultOptions, ...userOptions };

	const sessionUUID = randomUUID();
	const injectPrefix = `<!-- inject:${sessionUUID}:`;

	/** @type {import('./index.js').AdapterReplace[]} */
	const replacements = [...options.replace];

	await Promise.all(
		(await findHtmlFiles(options.pages)).map(async (htmlFile) => {
			const dom = new JSDOM(await readFile(htmlFile, 'utf8'));

			for (const [targetElement, positions] of Object.entries(options.injectTo)) {
				if (!['head', 'body'].includes(targetElement)) {
					builder.log.warn(`Skipping unsupported injection element: ${targetElement}`);
					continue;
				}

				for (const [position, value] of Object.entries(positions ?? {})) {
					if (!INJECT_POSITIONS.includes(position)) {
						builder.log.warn(`Skipping unsupported insertAdjacentHTML position: ${position}`);
						continue;
					}

					for (const injectToText of Array.isArray(value) ? value : [value]) {
						const injectToHash = createHash('sha256').update(injectToText).digest('hex');
						const injectToTag = `${injectPrefix}${injectToHash} -->`;

						if (!replacements.some((item) => item.from === injectToTag)) {
							replacements.push({ from: injectToTag, to: injectToText });
						}

						builder.log.minor(`Injecting to ${position}: '${injectToText}'`);
						dom.window.document[/** @type {'head' | 'body'} */ (targetElement)].insertAdjacentHTML(
							/** @type {InsertPosition} */ (position),
							injectToTag
						);
					}
				}
			}

			let outputHTML;

			try {
				if (options.minify) {
					outputHTML = await minifier(dom.serialize(), {
						collapseWhitespace: true,
						minifyCSS: true,
						minifyJS: true,
						// injection placeholders are comments, so they must survive
						removeComments: false,
						removeRedundantAttributes: true,
						useShortDoctype: true
					});
				} else if (options.prettify) {
					outputHTML = await prettier.format(dom.serialize(), await getPrettierConfig(htmlFile));
				} else {
					outputHTML = dom.serialize();
				}

				builder.log.minor('Formatting markup');
			} catch (err) {
				builder.log.error('Formatting markup failed');
				throw err;
			}

			const outFile = `${basename(htmlFile, '.html')}${options.targetExtension}`;
			const outPath = join(dirname(htmlFile), outFile);

			const contents = replacements.reduce((previousValue, { from, to, many }) => {
				if (!from.startsWith(injectPrefix)) {
					builder.log.minor(`Replacing ${many ? 'all ' : ''}'${from}' → '${to}'`);
				}

				return previousValue[many ? 'replaceAll' : 'replace'](from, to);
			}, outputHTML);

			builder.log.minor(`Writing to ${relative(options.pages, outPath)}`);
			await writeFile(outPath, contents);

			if (outPath !== htmlFile) {
				builder.log.minor(`Deleting ${relative(options.pages, htmlFile)}`);
				builder.rimraf(htmlFile);
			}
		})
	);
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function findHtmlFiles(dir) {
	const entries = await readdir(dir, { recursive: true, withFileTypes: true });

	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
		.map((entry) => join(entry.parentPath, entry.name));
}

/**
 * Resolves the user's Prettier config, falling back to unwrapped HTML.
 *
 * @param {string} filePath
 * @returns {Promise<import('prettier').Options>}
 */
export async function getPrettierConfig(filePath) {
	const config = await prettier.resolveConfig(filePath, { editorconfig: true });

	return {
		printWidth: Number.MAX_SAFE_INTEGER,
		...config,
		// the input is a serialized DOM, so the parser is never inferable from `filePath`
		parser: 'html'
	};
}
