import {afterEach, describe, expect, it, vi} from 'vitest';
import {existsSync} from 'fs';
import {resolve} from 'path';

import {configureDynamicPreview} from '../src/handlers';
import {loggerInstance} from '../src/logger_internal';
import * as utils from '../src/utils';
import {AssignTypeAndName} from '../src/utils';
import {installTestGlobals} from './helpers/factories';
import {makeHarness} from './helpers/handler_harness';

installTestGlobals();

describe("dead and duplicated code", () =>
{
	const originalObserver = globalThis.ResizeObserver;

	afterEach(() =>
	{
		globalThis.ResizeObserver = originalObserver;
		vi.restoreAllMocks();
	});

	it("has no unused Nodes 2.0 detection helper", () =>
	{
		expect("IsNodes2Mode" in utils).toBe(false);
	});

	it("switch and batch switch share one handler module", () =>
	{
		expect(existsSync(resolve(__dirname, '../src/handlers/batch_switch.ts'))).toBe(false);
	});

	it("AssignTypeAndName names a node typed PT_DynamicBus like any other node", () =>
	{
		const node: any = {type: "PT_DynamicBus", inputs: [{}], outputs: [{}]};

		AssignTypeAndName(["IMAGE"], 0, node, ["image"], ["image"]);

		expect(node.inputs[0]).toMatchObject({type: "IMAGE", name: "input_1", label: "image"});
		expect(node.outputs[0]).toMatchObject({type: "IMAGE", name: "output_1", label: "image"});
	});

	it.each(["log", "info", "warn", "error", "debug"] as const)("a scoped logger shows its scope on %s", (method) =>
	{
		const spy = vi.spyOn(console, method).mockImplementation(() => {});

		loggerInstance("Scope")[method]("message");

		expect(String(spy.mock.calls[0][0])).toContain("Scope:");
	});

	it("Dynamic Preview keeps its preview state on each node, not on the prototype", async () =>
	{
		const h = await makeHarness(configureDynamicPreview, {name: "PT_DynamicPreview"}, {in: 1, out: 0});

		h.nodeType.prototype.onAdded.call(h.node);

		for (const key of ["_currentImageIndex", "_previewItems", "_totalImages"])
		{
			expect(Object.hasOwn(h.nodeType.prototype, key)).toBe(false);
		}
		expect(h.node).toMatchObject({_currentImageIndex: 0, _previewItems: [], _totalImages: 0});
	});

	it("Dynamic Preview disconnects its tab bar ResizeObserver when removed", async () =>
	{
		const disconnect = vi.fn();
		(globalThis as any).ResizeObserver = class
		{
			observe() {}
			disconnect = disconnect;
		};
		const h = await makeHarness(configureDynamicPreview, {name: "PT_DynamicPreview"}, {in: 1, out: 0});

		h.nodeType.prototype.onAdded.call(h.node);
		h.nodeType.prototype.onRemoved.call(h.node);

		expect(disconnect).toHaveBeenCalledTimes(1);
	});
});
