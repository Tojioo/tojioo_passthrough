/// <reference types="vitest" />
import {fileURLToPath} from 'url';
import {dirname, resolve} from 'path';
import {readFileSync} from 'fs';
import {defineConfig} from 'vitest/config'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolves absolute path relative to module directory.
 *
 * @param {string} filePath - Relative path to resolve.
 * @returns {string} Absolute path.
 */
const resolvePath = (filePath: string): string => resolve(__dirname, filePath);

const version = readFileSync(resolve(__dirname, '../VERSION'), 'utf-8').trim();

export default defineConfig({
	define: {
		__VERSION__: JSON.stringify(version),
	},
	plugins: [
		cssInjectedByJsPlugin({styleId: 'tojioo-passthrough-styles'}),
	],
	resolve: {
		alias: {
			'@': resolvePath('src'),
			'tojioo': resolvePath('src/config/tojioo.ts'),
			'nodes': resolvePath('src/nodes'),
		},
	},
	build: {
		outDir: resolvePath('js'),
		emptyOutDir: true,
		lib: {
			entry: resolvePath('src/index.ts'),
			formats: ['es'],
			fileName: () => 'extension.js',
		},
		minify: false,
		rollupOptions: {
			external: [
				/^scripts\//,
				/^\/scripts\//,
			],
			output: {
				paths: (id) =>
				{
					if (id.startsWith("scripts/"))
					{
						return `../../${id}`;
					}
					return id;
				},
			},
		},
	},
	test: {
		globals: true,
		environment: "node",
	},
});