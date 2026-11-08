import {afterEach, describe, expect, it, vi} from 'vitest';

import {app} from 'scripts/app.js';
import {BUS_TYPE} from '../src/types/tojioo';
import {dynamicBusOverwrite} from '../src/settings';
import {connectInput, flushMicrotasks, installTestGlobals} from './helpers/factories';
import {makeBusContext} from './helpers/dynamic_bus_fixtures';

installTestGlobals();

const LG_INPUT = (globalThis as any).LiteGraph.INPUT;

let overwrite = false;

async function makeBusWithDuplicateType(): Promise<any>
{
	const ctx = await makeBusContext({in: 2, out: 2});
	const upstream = {id: 30, outputs: [{type: BUS_TYPE}], properties: {_busTypes: {0: "IMAGE"}}};
	const origin = {id: 31, outputs: [{type: "IMAGE"}]};
	ctx.nodes[upstream.id] = upstream;
	ctx.nodes[origin.id] = origin;
	connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 1, origin: upstream});
	const link = connectInput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 2, origin});
	ctx.nodeType.prototype.onConnectionsChange.call(ctx.node, LG_INPUT, 1, true, link, null);
	await flushMicrotasks();
	return ctx.node;
}

describe("dynamic_bus overwrite setting", () =>
{
	afterEach(() =>
	{
		delete app.rootGraph;
		delete app.rootGraphOrUndefined;
		vi.restoreAllMocks();
		delete app.extensionManager;
		overwrite = false;
	});

	it("re-syncs bus nodes in the root graph and in subgraphs", async () =>
	{
		app.extensionManager = {setting: {get: () => overwrite}};
		const rootBus = await makeBusWithDuplicateType();
		const subgraphBus = await makeBusWithDuplicateType();
		app.rootGraph = {_nodes: [rootBus], subgraphs: new Map([["sg", {_nodes: [subgraphBus]}]])};
		expect(rootBus.properties._busTypes).toEqual({0: "IMAGE", 1: "IMAGE"});

		overwrite = true;
		await dynamicBusOverwrite.onChange(true);

		for (const node of [rootBus, subgraphBus])
		{
			expect(node.widgets.find((w: any) => w.name === "_overwrite_mode")?.value).toBe("1");
			expect(node.properties._busTypes).toEqual({0: "IMAGE"});
		}
	});

	it("does not log an error when the setting loads before the graph exists", async () =>
	{
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		Object.defineProperty(app, "rootGraph", {configurable: true, get: () => console.error("ComfyApp graph accessed before initialization")});
		app.rootGraphOrUndefined = undefined;

		await dynamicBusOverwrite.onChange(false);

		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("does not log the overwrite mode on every sync", async () =>
	{
		const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

		await makeBusWithDuplicateType();

		const messages = debugSpy.mock.calls.flat().filter((arg) => typeof arg === "string");
		expect(messages.some((m) => m.includes("Overwrite is set to"))).toBe(false);
	});
});
