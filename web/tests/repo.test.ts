import {existsSync, readFileSync} from 'fs';
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
});
