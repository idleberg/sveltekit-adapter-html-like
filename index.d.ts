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
	pages?: string;
	assets?: string;
	fallback?: string;
	precompress?: boolean;
	strict?: boolean;
}

export default function plugin(options?: AdapterOptions): Adapter;
