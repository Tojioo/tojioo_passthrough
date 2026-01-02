import {fileURLToPath} from 'url';
import {dirname, resolve} from 'path';
import {defineConfig} from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

/** Resolves the absolute path for a given relative path.
 * @param {string} filePath The relative path to resolve.
 * @returns {string} The absolute path resolved from the provided relative path. */
const resolvePath = (filePath: string): string =>
{
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	return resolve(__dirname, filePath);
}

export default defineConfig({
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
});