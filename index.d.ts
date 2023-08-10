import { Adapter } from '@sveltejs/kit';

export interface AdapterInjectTargets {
	[head?: string]: AdapterInjectPositions;
	[body?: string]: AdapterInjectPositions;
}

export interface AdapterInjectPositions {
	[beforebegin?: string]: string | string[];
	[afterbegin?: string]: string | string[];
	[beforeend?: string]: string | string[];
	[afterend?: string]: string | string[];
}

export interface AdapterReplace {
	from: string;
	to: string;
	many?: boolean;
}

export interface AdapterOptions {
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

export default function plugin(options?: AdapterOptions): Adapter;
