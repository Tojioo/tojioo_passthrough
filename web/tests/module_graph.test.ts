import {describe, expect, it} from 'vitest';
import {existsSync, readdirSync, readFileSync, statSync} from 'fs';
import {dirname, join, relative, resolve} from 'path';

const SRC = resolve(__dirname, '../src');

function listSources(dir: string): string[]
{
	return readdirSync(dir).flatMap((name) =>
	{
		const path = join(dir, name);
		if (statSync(path).isDirectory())
		{
			return listSources(path);
		}
		return /\.ts$/.test(name) && !/\.d\.ts$/.test(name) ? [path] : [];
	});
}

function resolveImport(from: string, spec: string): string | null
{
	let base: string;
	if (spec.startsWith("@/"))
	{
		base = join(SRC, spec.slice(2));
	}
	else if (spec.startsWith("."))
	{
		base = resolve(dirname(from), spec);
	}
	else
	{
		return null;
	}
	for (const candidate of [`${base}.ts`, join(base, "index.ts"), base])
	{
		if (existsSync(candidate) && statSync(candidate).isFile())
		{
			return candidate;
		}
	}
	return null;
}

function importsOf(file: string): string[]
{
	const text = readFileSync(file, "utf-8");
	const specs = [...text.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
	return specs.map((s) => resolveImport(file, s)).filter((p): p is string => p !== null);
}

function findCycles(files: string[]): string[]
{
	const graph = new Map(files.map((f) => [f, importsOf(f)]));
	const cycles: string[] = [];
	const state = new Map<string, "visiting" | "done">();

	const visit = (file: string, stack: string[]) =>
	{
		if (state.get(file) === "done")
		{
			return;
		}
		if (state.get(file) === "visiting")
		{
			const loop = [...stack.slice(stack.indexOf(file)), file];
			cycles.push(loop.map((f) => relative(SRC, f)).join(" -> "));
			return;
		}
		state.set(file, "visiting");
		for (const dep of graph.get(file) ?? [])
		{
			visit(dep, [...stack, file]);
		}
		state.set(file, "done");
	};

	for (const file of files)
	{
		visit(file, []);
	}
	return cycles;
}

describe("web module graph", () =>
{
	const files = listSources(SRC);

	it("has no import cycles", () =>
	{
		expect(findCycles(files)).toEqual([]);
	});

	it("defines ANY_TYPE once", () =>
	{
		const definitions = files.filter((f) => /export const ANY_TYPE\b/.test(readFileSync(f, "utf-8")));
		expect(definitions.map((f) => relative(SRC, f))).toEqual([join("types", "tojioo.ts")]);
	});
});
