import * as fs from 'node:fs';
import process from 'node:process';
import { gunzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

const cwd = process.cwd();
const read = (/** @type {string} */ file) => fs.readFileSync(`${cwd}/build/${file}`, 'utf8');

// inherited from @sveltejs/adapter-static

test('generates HTML files', () => {
	expect(fs.existsSync(`${cwd}/build/index.html`)).toBeTruthy();
});

test('prerenders a page', async ({ page }) => {
	await page.goto('/');
	expect(await page.textContent('h1')).toEqual('This page was prerendered');
	expect(await page.textContent('p')).toEqual('answer: 42');
});

test('prerenders an unreferenced endpoint with explicit `prerender` setting', async () => {
	expect(fs.existsSync(`${cwd}/build/endpoint/explicit.json`)).toBeTruthy();
});

test('prerenders a referenced endpoint with implicit `prerender` setting', async () => {
	expect(fs.existsSync(`${cwd}/build/endpoint/implicit.json`)).toBeTruthy();
});

test('exposes public env vars to the client', async ({ page }) => {
	await page.goto('/public-env');
	expect(await page.textContent('h1')).toEqual('The answer is 42');
	expect(await page.textContent('h2')).toEqual('The dynamic answer is 42');
});

// specific to sveltekit-adapter-html-like

test('injects markup into the head', async ({ page }) => {
	await page.goto('/');
	expect(await page.locator('head meta[name=injected]').getAttribute('content')).toEqual(
		'head-beforeend'
	);
});

test('injects markup into the body, in order', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('#body-afterbegin')).toHaveText('injected');
	await expect(page.locator('#body-beforeend')).toHaveText('injected');

	const ids = await page
		.locator('body [id^=body-]')
		.evaluateAll((nodes) => nodes.map((node) => node.id));
	expect(ids).toEqual(['body-afterbegin', 'body-beforeend']);
});

test('injects markup that is not valid HTML', () => {
	expect(read('index.html')).toContain('<?php body_open(); ?>');
});

test('leaves no injection placeholders behind', () => {
	expect(read('index.html')).not.toMatch(/<!-- inject:/);
});

test('replaces the first occurrence of a string', () => {
	expect(read('index.html')).toContain('<html lang="en" data-replaced="once">');
});

test('replaces every occurrence of a string when `many` is set', () => {
	const contents = read('index.html');
	expect(contents).not.toContain('replace-me');
	// both the class name and the text content are rewritten
	expect(contents).toContain('class="replaced"');
	expect(contents).toContain('>replaced<');
});

test('precompresses the transformed page, not the original', () => {
	// the compressed copy is what a client sending `Accept-Encoding: gzip` actually receives, so it
	// has to carry the injections and replacements too
	const gzipped = gunzipSync(fs.readFileSync(`${cwd}/build/index.html.gz`)).toString('utf8');

	expect(gzipped).toEqual(read('index.html'));
	expect(gzipped).toContain('<?php body_open(); ?>');
	expect(gzipped).toContain('<html lang="en" data-replaced="once">');
	expect(gzipped).not.toContain('replace-me');
});

test('prettifies the output by default', () => {
	// prettier indents the document; the unformatted DOM serialization does not
	expect(read('index.html')).toMatch(/\n\t+<head>/);
});
