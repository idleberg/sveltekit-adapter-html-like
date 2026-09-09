import { Adapter } from '@sveltejs/kit';

export interface AdapterInjectPositions {
	beforebegin?: string | string[];
	afterbegin?: string | string[];
	beforeend?: string | string[];
	afterend?: string | string[];
}

export interface AdapterInjectTargets {
	head?: AdapterInjectPositions;
	body?: AdapterInjectPositions;
}

export interface AdapterReplace {
	from: string;
	to: string;
	many?: boolean;
}

export interface AdapterOptions {
	pages?: string;
	assets?: string;
	fallback?: string;
	precompress?: boolean;
	strict?: boolean;

	/** Markup injected into `<head>` or `<body>`, keyed by `insertAdjacentHTML` position. */
	injectTo?: AdapterInjectTargets;
	/** Minify the output instead of prettifying it. */
	minify?: boolean;
	/** Prettify the output. Ignored when `minify` is `true`. Defaults to `true`. */
	prettify?: boolean;
	/** String replacements run on every page, after formatting. */
	replace?: AdapterReplace[];
	/** Extension of the written files, e.g. `.php`. Defaults to `.html`. */
	targetExtension?: string;
}

export default function plugin(options?: AdapterOptions): Adapter;
