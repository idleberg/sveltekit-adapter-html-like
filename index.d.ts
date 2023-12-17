import { Adapter } from '@sveltejs/kit';

export interface AdapterInjectTargets {
	head?: AdapterInjectPositions;
	body?: AdapterInjectPositions;
}

export interface AdapterInjectPositions {
	beforebegin?: string | string[];
	afterbegin?: string | string[];
	beforeend?: string | string[];
	afterend?: string | string[];
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
	strict?: boolean;
	targetExtension?: string;
}

export default function plugin(options?: AdapterOptions): Adapter;
