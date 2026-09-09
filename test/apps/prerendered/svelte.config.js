import adapter from '../../../index.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			precompress: true,
			injectTo: {
				head: {
					// a single string, not an array
					beforeend: '<meta name="injected" content="head-beforeend" />'
				},
				body: {
					// markup that is deliberately not valid HTML, to prove it survives
					// serialization, formatting and minification untouched
					afterbegin: ['<?php body_open(); ?>', '<div id="body-afterbegin">injected</div>'],
					beforeend: '<div id="body-beforeend">injected</div>'
				}
			},
			replace: [
				{
					from: '<html lang="en">',
					to: '<html lang="en" data-replaced="once">'
				},
				{
					from: 'replace-me',
					to: 'replaced',
					many: true
				}
			]
		})
	}
};

export default config;
