/* eslint-disable */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['svelte3'],
	overrides: [{ files: ['*.svelte'], processor: 'svelte3/svelte3' }],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:json/recommended',
  ],
  parserOptions: {
			sourceType: 'module',
			ecmaVersion: 2020
		},
		env: {
			browser: true,
			es2017: true,
			node: true
		}
};
