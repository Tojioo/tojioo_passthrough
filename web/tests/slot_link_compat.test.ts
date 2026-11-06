import {describe, expect, it} from 'vitest';

import {configureBatchSwitchNodes, configureDynamicAny, configureDynamicBus, configureDynamicPassthrough, configureDynamicPreview, configureSwitchNodes} from '../src/handlers';
import {BUS_TYPE} from '../src/types/tojioo';
import {GetInputLink} from '../src/utils';
import {flushMicrotasks, installTestGlobals, makeGraph, makeLink, makeNode} from './helpers/factories';
import {addLink, DeprecationLog, makeModernNode} from './helpers/modern_slots';

installTestGlobals();

const LG_INPUT = (globalThis as any).LiteGraph.INPUT;
const LG_OUTPUT = (globalThis as any).LiteGraph.OUTPUT;

async function setup(configure: () => any, nodeData: any, io: { in: number; out: number })
{
	const nodeType: any = function FakeNodeType()
	{
	};
	await configure().beforeRegisterNodeDef(nodeType, nodeData, {} as any);

	const log: DeprecationLog = [];
	const nodes: Record<number, any> = {};
	const graph = makeGraph({}, nodes);
	const node = makeModernNode(io, graph, log, {id: 2, type: nodeData.name});
	Object.setPrototypeOf(node, Object.assign(Object.create(nodeType.prototype), {}));
	nodes[node.id] = node;
	const source = {id: 10, outputs: [{type: "IMAGE"}]};
	const target = {id: 11, inputs: [{type: "IMAGE"}]};
	nodes[source.id] = source;
	nodes[target.id] = target;
	return {nodeType, node, graph, nodes, log, source, target};
}

async function notify(ctx: any, kind: number, index: number, link: any): Promise<void>
{
	ctx.nodeType.prototype.onConnectionsChange.call(ctx.node, kind, index, true, link, null);
	await flushMicrotasks();
	await flushMicrotasks();
}

describe("slot link accessors on frontends that deprecate them", () =>
{
	it.each([
		["Dynamic Any", configureDynamicAny, {name: "PT_DynamicAny"}],
		["Dynamic Passthrough", configureDynamicPassthrough, {name: "PT_DynamicPassthrough"}],
	])("%s types its slots without reading input.link or output.links", async (_label, configure, nodeData) =>
	{
		const ctx = await setup(configure, nodeData, {in: 1, out: 1});
		const inLink = addLink(ctx.graph, 1, ctx.source, 0, ctx.node, 0);
		const outLink = addLink(ctx.graph, 2, ctx.node, 0, ctx.target, 0);

		await notify(ctx, LG_INPUT, 0, inLink);
		await notify(ctx, LG_OUTPUT, 0, outLink);
		ctx.node.configure({});
		await flushMicrotasks();

		expect(ctx.log).toEqual([]);
		expect(ctx.node.outputs[0].type).toBe("IMAGE");
		expect(ctx.graph.links[2].type).toBe("IMAGE");
	});

	it("Dynamic Preview types its inputs without reading input.link", async () =>
	{
		const ctx = await setup(configureDynamicPreview, {name: "PT_DynamicPreview"}, {in: 1, out: 0});
		const link = addLink(ctx.graph, 1, ctx.source, 0, ctx.node, 0);

		await notify(ctx, LG_INPUT, 0, link);

		expect(ctx.log).toEqual([]);
		expect(ctx.node.inputs.map((i: any) => i.type)).toEqual(["IMAGE", "*"]);
	});

	it.each([
		["switch", configureSwitchNodes, "PT_AnyImageSwitch"],
		["batch switch", configureBatchSwitchNodes, "PT_AnyImageBatchSwitch"],
	])("%s grows and types without reading input.link or output.links", async (_label, configure, name) =>
	{
		const nodeData = {name, input: {optional: {image_1: ["IMAGE"]}}, output: ["IMAGE"]};
		const ctx = await setup(configure, nodeData, {in: 1, out: 1});
		const link = addLink(ctx.graph, 1, ctx.source, 0, ctx.node, 0);

		await notify(ctx, LG_INPUT, 0, link);

		expect(ctx.log).toEqual([]);
		expect(ctx.node.inputs.length).toBe(2);
	});

	it("Dynamic Bus syncs and drops a stale input link without the deprecated accessors", async () =>
	{
		const ctx = await setup(configureDynamicBus, {name: "PT_DynamicBus"}, {in: 2, out: 2});
		const upstream = {id: 30, outputs: [{type: BUS_TYPE}], properties: {_busTypes: {0: "LATENT"}}};
		ctx.nodes[upstream.id] = upstream;
		addLink(ctx.graph, 1, upstream, 0, ctx.node, 0);
		const dataLink = addLink(ctx.graph, 2, ctx.source, 0, ctx.node, 1);
		addLink(ctx.graph, 3, ctx.node, 1, ctx.target, 0);

		await notify(ctx, LG_INPUT, 1, dataLink);
		expect(ctx.node.properties._busTypes).toEqual({0: "LATENT", 1: "IMAGE"});

		delete ctx.nodes[upstream.id];
		ctx.node.configure({inputs: [], outputs: []});
		await flushMicrotasks();

		expect(ctx.log).toEqual([]);
		expect(ctx.graph.links[1]).toBeUndefined();
		expect(ctx.node.outputs[1].type).toBe("IMAGE");
	});

	it("looks links up in the node's own graph before its root graph", () =>
	{
		const root = makeGraph();
		const subgraph = makeGraph({5: makeLink({id: 5, origin_id: 10, target_id: 2})});
		const node = makeNode({in: 1, out: 0}, root, {id: 2, graph: subgraph, rootGraph: root});
		node.inputs[0].link = 5;

		expect(GetInputLink(node, 0)?.id).toBe(5);
	});
});
