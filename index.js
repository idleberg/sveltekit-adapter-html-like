import path from 'node:path';
import { platforms } from './platforms.js';
import { transformFiles } from './adapter.js';

/** @type {import('./index.js').default} */
export default function (options) {
	return {
		name: 'sveltekit-adapter-html-like',
		/** @param {import('./internal.js').Builder2_0_0} builder */
		async adapt(builder) {
			if (!options?.fallback && builder.config.kit.router?.type !== 'hash') {
				const dynamic_routes = builder.routes.filter((route) => route.prerender !== true);
				if (dynamic_routes.length > 0 && options?.strict !== false) {
					const prefix = path.relative('.', builder.config.kit.files.routes);
					const has_param_routes = builder.routes.some((route) => route.id.includes('['));
					const config_option =
						has_param_routes || JSON.stringify(builder.config.kit.prerender.entries) !== '["*"]'
							? `  - adjust the \`prerender.entries\` config option ${
									has_param_routes
										? '(routes with parameters are not part of entry points by default)'
										: ''
								} — see https://svelte.dev/docs/kit/configuration#prerender for more info.`
							: '';

					builder.log.error(
						`sveltekit-adapter-html-like: all routes must be fully prerenderable, but found the following routes that are dynamic:
${dynamic_routes.map((route) => `  - ${path.posix.join(prefix, route.id)}`).join('\n')}

You have the following options:
  - set the \`fallback\` option — see https://svelte.dev/docs/kit/single-page-apps#usage for more info.
  - add \`export const prerender = true\` to your root \`+layout.js/.ts\` or \`+layout.server.js/.ts\` file. This will try to prerender all pages.
  - add \`export const prerender = true\` to any \`+server.js/ts\` files that are not fetched by page \`load\` functions.
${config_option}
  - pass \`strict: false\` to the adapter to ignore this error. Only do this if you are sure you don't need the routes in question in your final app, as they will be unavailable.

If this doesn't help, you may need to use a different adapter. This adapter can only be used for sites that don't need a server for dynamic rendering, and can run on just a static file server.
See https://svelte.dev/docs/kit/page-options#prerender for more details`
					);
					throw new Error('Encountered dynamic routes');
				}
			}

			const platform = platforms.find((platform) => platform.test());

			if (platform) {
				if (options) {
					builder.log.warn(
						`Detected ${platform.name}. Please remove adapter options to enable zero-config mode`
					);
				} else {
					builder.log.info(`Detected ${platform.name}, using zero-config mode`);
				}
			}

			const {
				pages = 'build',
				assets = pages,
				fallback,
				precompress
			} = options ?? platform?.defaults ?? /** @type {import('./index.js').AdapterOptions} */ ({});

			builder.rimraf(assets);
			builder.rimraf(pages);

			builder.generateEnvModule();
			builder.writeClient(assets);
			builder.writePrerendered(pages);

			if (fallback) {
				await builder.generateFallback(path.join(pages, fallback));
			}

			// Before compressing, not after: the compressed copies have to be made from the injected,
			// replaced and formatted markup, or a client sending `Accept-Encoding: gzip` is served the
			// untransformed page. This also renames pages to `targetExtension`, and `builder.compress`
			// only knows a fixed set of extensions (`.html`, `.js`, `.css`, …) — so a non-HTML
			// `targetExtension` leaves pages uncompressed, which is what you want for markup a server
			// is going to execute anyway.
			await transformFiles(builder, { ...options, pages });

			if (precompress) {
				builder.log.minor('Compressing assets and pages');
				if (pages === assets) {
					await builder.compress(assets);
				} else {
					await Promise.all([builder.compress(assets), builder.compress(pages)]);
				}
			}

			if (pages === assets) {
				builder.log(`Wrote site to "${pages}"`);
			} else {
				builder.log(`Wrote pages to "${pages}" and assets to "${assets}"`);
			}

			if (!options) platform?.done(builder);
		}
	};
}
