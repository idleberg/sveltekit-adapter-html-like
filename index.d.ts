import { Adapter } from '@sveltejs/kit';

interface AdapterInjectTargets {
	[head?: string]: AdapterInjectPositions;
	[body?: string]: AdapterInjectPositions;
}

interface AdapterInjectPositions {
	[beforebegin?: string]: string | string[];
	[afterbegin?: string]: string | string[];
	[beforeend?: string]: string | string[];
	[afterend?: string]: string | string[];
}

interface AdapterReplace {
	from: string;
	to: string;
	many?: boolean;
}

interface AdapterOptions {
	assets?: string;
	fallback?: string;
	injectTo?: AdapterInjectTargets;
	minify?: boolean;
	pages?: string;
	precompress?: boolean;
	prettify?: boolean;
	replace?: AdapterReplace[];
	targetExtension?: string;
}

declare function plugin(options?: AdapterOptions): Adapter;
export = plugin;
