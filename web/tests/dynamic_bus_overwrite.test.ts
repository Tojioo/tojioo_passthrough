import {afterEach, describe, expect, it} from 'vitest';

import {app} from 'scripts/app.js';
import {connectInput, flushMicrotasks, installTestGlobals} from './helpers/factories';
import {makeBusContext} from './helpers/dynamic_bus_fixtures';

installTestGlobals();

const LG_INPUT = (globalThis as any).LiteGraph.INPUT;

describe("dynamic_bus overwrite mode", () =>
{
	afterEach(() =>
	{
		delete app.extensionManager;
	});

	it("keeps two local inputs of the same type when the upstream bus has none", async () =>
	{
		app.extensionManager = {setting: {get: () => true}};
		const ctx = await makeBusContext({in: 3, out: 3});
		const originA = {id: 31, outputs: [{type: "IMAGE"}]};
		const originB = {id: 32, outputs: [{type: "IMAGE"}]};
		ctx.nodes[originA.id] = originA;
		ctx.nodes[originB.id] = originB;

		const linkA = connectInput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 1, origin: originA});
		ctx.nodeType.prototype.onConnectionsChange.call(ctx.node, LG_INPUT, 1, true, linkA, null);
		await flushMicrotasks();
		const linkB = connectInput({node: ctx.node, graph: ctx.graph, index: 2, linkId: 2, origin: originB});
		ctx.nodeType.prototype.onConnectionsChange.call(ctx.node, LG_INPUT, 2, true, linkB, null);
		await flushMicrotasks();

		expect(ctx.node.properties._busTypes).toEqual({0: "IMAGE", 1: "IMAGE"});
	});
});
