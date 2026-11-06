import {existsSync, readFileSync} from 'fs';
import {createRequire} from 'module';
import {resolve} from 'path';
import {describe, expect, it} from 'vitest';

import viteConfig from '../vite.config.mts';

const webDir = resolve(__dirname, '..');
const repoDir = resolve(webDir, '..');

describe("repository tooling", () =>
{
	it("pyproject.toml is the only version source and feeds the bundle", () =>
	{
		const pyproject = readFileSync(resolve(repoDir, 'pyproject.toml'), 'utf-8');
		const version = pyproject.match(/^\[project\]\n(?:(?!\[).*\n)*?version = "([^"]+)"/m)?.[1];

		expect(version).toBeTruthy();
		expect((viteConfig as any).define.__VERSION__).toBe(JSON.stringify(version));
		expect(existsSync(resolve(repoDir, 'VERSION'))).toBe(false);
	});

	it("test:coverage has its coverage provider installed at the vitest version", () =>
	{
		const pkg = JSON.parse(readFileSync(resolve(webDir, 'package.json'), 'utf-8'));
		const require = createRequire(resolve(webDir, 'package.json'));

		expect(pkg.scripts["test:coverage"]).toContain("--coverage");
		expect(pkg.devDependencies["@vitest/coverage-v8"]).toBe(pkg.devDependencies.vitest);
		expect(require('@vitest/coverage-v8/package.json').version).toBe(require('vitest/package.json').version);
	});

	it("every Vite alias and tsconfig path points to an existing file", () =>
	{
		const aliases = (viteConfig as any).resolve.alias as Record<string, string>;
		const tsconfig = JSON.parse(readFileSync(resolve(webDir, 'tsconfig.json'), 'utf-8').replace(/^\uFEFF/, ''));
		const tsTargets = Object.values(tsconfig.compilerOptions.paths as Record<string, string[]>).flat();

		for (const target of Object.values(aliases))
		{
			expect(existsSync(target), target).toBe(true);
		}
		for (const target of tsTargets)
		{
			expect(existsSync(resolve(webDir, target.replace(/\/\*$/, ''))), target).toBe(true);
		}
	});
});
