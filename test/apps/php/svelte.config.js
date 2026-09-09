import adapter from '../../../index.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			targetExtension: '.php',
			minify: true,
			injectTo: {
				head: {
					beforeend: '<?php wp_head(); ?>'
				},
				body: {
					beforeend: '<?php wp_footer(); ?>'
				}
			},
			replace: [
				{
					from: '<html lang="en">',
					to: '<html <?php language_attributes(); ?>>'
				}
			]
		})
	}
};

export default config;
