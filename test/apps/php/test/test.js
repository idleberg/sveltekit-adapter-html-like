import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';

const build = `${process.cwd()}/build`;
const index = readFileSync(`${build}/index.php`, 'utf8');

test('writes pages using targetExtension', () => {
	assert.ok(existsSync(`${build}/index.php`));
	assert.ok(existsSync(`${build}/nested.php`));
});

test('removes the original HTML files, at any depth', () => {
	const html = readdirSync(build, { recursive: true }).filter(
		(file) => typeof file === 'string' && file.endsWith('.html')
	);

	assert.deepEqual(html, []);
});

test('leaves no precompressed copies of the untransformed pages behind', () => {
	// `precompress` used to run before the transform, leaving `index.html.gz` orphans holding the
	// original markup next to the `.php` file that actually gets served
	const orphans = readdirSync(build, { recursive: true }).filter(
		(file) => typeof file === 'string' && /\.html\.(gz|br)$/.test(file)
	);

	assert.deepEqual(orphans, []);
});

test('leaves non-HTML assets alone', () => {
	assert.ok(existsSync(`${build}/_app`));
});

test('injects into head and body', () => {
	assert.ok(index.includes('<?php wp_head(); ?></head>'));
	assert.ok(index.includes('<?php wp_footer(); ?></body>'));
});

test('leaves no injection placeholders behind', () => {
	assert.doesNotMatch(index, /<!-- inject:/);
});

test('replaces strings', () => {
	assert.ok(index.includes('<html <?php language_attributes(); ?>>'));
});

test('minifies the output', () => {
	// minified output is a single line and has no indentation
	assert.doesNotMatch(index, /\n\s+</);
});
