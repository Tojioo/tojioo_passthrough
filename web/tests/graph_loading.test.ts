import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {configureBatchSwitchNodes, configureDynamicAny, configureDynamicBus, configureDynamicPassthrough, configureDynamicPreview, configureSwitchNodes} from '../src/handlers';
import {InstallGraphLoadingHook, IsGraphLoading} from '../src/utils';
import {connectInput, flushMicrotasks, installTestGlobals, makeGraph, makeNode} from './helpers/factories';

installTestGlobals();

const LG_INPUT = (globalThis as any).LiteGraph.INPUT;

type Load = { finish: () => Promise<void> };

function makeLoader(): () => Load
{
	const app: any = {};
	let resolveCurrent: () => void = () => {};
	app.loadGraphData = () => new Promise<void>((r) => (resolveCurrent = r));
	InstallGraphLoadingHook(app);

	return () =>
	{
		const call = app.loadGraphData();
		const resolve = resolveCurrent;
		return {
			finish: async () =>
			{
				resolve();
				await call;
			},
		};
	};
}

const handlers: Array<[string, () => any, any]> = [
	["Dynamic Any", configureDynamicAny, {name: "PT_DynamicAny"}],
	["Dynamic Passthrough", configureDynamicPassthrough, {name: "PT_DynamicPassthrough"}],
	["Dynamic Bus", configureDynamicBus, {name: "PT_DynamicBus"}],
	["Dynamic Preview", configureDynamicPreview, {name: "PT_DynamicPreview"}],
	["switch", configureSwitchNodes, {name: "PT_AnyImageSwitch", input: {optional: {image_1: ["IMAGE"]}}, output: ["IMAGE"]}],
	["batch switch", configureBatchSwitchNodes, {name: "PT_AnyImageBatchSwitch", input: {optional: {image_1: ["IMAGE"]}}, output: ["IMAGE"]}],
];

async function register(configure: () => any, nodeData: any, previous?: Record<string, any>): Promise<any>
{
	const nodeType: any = function FakeNodeType()
	{
	};
	Object.assign(nodeType.prototype, previous ?? {});
	await configure().beforeRegisterNodeDef(nodeType, nodeData, {} as any);
	return nodeType;
}

function makeContext(nodeType: any, nodeData: any, io: { in: number; out: number })
{
	const nodes: Record<number, any> = {};
	const graph = makeGraph({}, nodes);
	const node = makeNode(io, graph, {id: 2, graph, type: nodeData.name});
	Object.setPrototypeOf(node, nodeType.prototype);
	nodes[node.id] = node;
	return {node, graph, nodes};
}

describe("graph loading signal", () =>
{
	let startLoad: () => Load;

	beforeEach(() =>
	{
		vi.useFakeTimers({toFake: ["setTimeout"]});
		startLoad = makeLoader();
	});

	afterEach(() =>
	{
		vi.useRealTimers();
	});

	it("stays set until every overlapping load has finished", async () =>
	{
		const first = startLoad();
		const second = startLoad();

		await first.finish();
		expect(IsGraphLoading()).toBe(true);

		await second.finish();
		expect(IsGraphLoading()).toBe(false);
	});

	it.each(handlers)("%s calls the previous onConnectionsChange while a graph loads", async (_label, configure, nodeData) =>
	{
		const previous = vi.fn();
		const nodeType = await register(configure, nodeData, {onConnectionsChange: previous});
		const {node} = makeContext(nodeType, nodeData, {in: 2, out: 2});
		const load = startLoad();

		nodeType.prototype.onConnectionsChange.call(node, LG_INPUT, 0, true, null, null);
		expect(previous).toHaveBeenCalledWith(LG_INPUT, 0, true, null, null);

		await load.finish();
	});

	it.each([
		["Dynamic Any", configureDynamicAny, {name: "PT_DynamicAny"}, (node: any) => node.outputs[0].type],
		["Dynamic Passthrough", configureDynamicPassthrough, {name: "PT_DynamicPassthrough"}, (node: any) => node.outputs[0].type],
		["Dynamic Preview", configureDynamicPreview, {name: "PT_DynamicPreview"}, (node: any) => node.inputs[0].type],
	])("%s re-syncs when the load finishes, without a timer", async (_label, configure, nodeData, readType) =>
	{
		const nodeType = await register(configure, nodeData);
		const {node, graph, nodes} = makeContext(nodeType, nodeData, {in: 1, out: 1});
		const origin = {id: 10, outputs: [{type: "IMAGE"}]};
		const load = startLoad();

		node.configure({});
		await flushMicrotasks();
		nodes[origin.id] = origin;
		connectInput({node, graph, index: 0, linkId: 1, origin});

		await load.finish();

		expect(vi.getTimerCount()).toBe(0);
		expect(readType(node)).toBe("IMAGE");
	});

	it("Dynamic Bus re-syncs when the load finishes, without a timer", async () =>
	{
		const nodeData = {name: "PT_DynamicBus"};
		const nodeType = await register(configureDynamicBus, nodeData);
		const {node, graph, nodes} = makeContext(nodeType, nodeData, {in: 2, out: 2});
		const origin = {id: 10, outputs: [{type: "IMAGE"}]};
		const load = startLoad();

		node.configure({inputs: structuredClone(node.inputs), outputs: structuredClone(node.outputs)});
		await flushMicrotasks();
		nodes[origin.id] = origin;
		connectInput({node, graph, index: 1, linkId: 1, origin});
		node.inputs[1].type = "IMAGE";

		await load.finish();

		expect(vi.getTimerCount()).toBe(0);
		expect(node.widgets.find((w: any) => w.name === "_slot_types")?.value).toBe("1:IMAGE");
	});

	it("re-syncs a node configured outside a load in a microtask, without a timer", async () =>
	{
		const nodeData = {name: "PT_DynamicAny"};
		const nodeType = await register(configureDynamicAny, nodeData);
		const {node, graph, nodes} = makeContext(nodeType, nodeData, {in: 1, out: 1});
		const origin = {id: 10, outputs: [{type: "IMAGE"}]};
		nodes[origin.id] = origin;
		connectInput({node, graph, index: 0, linkId: 1, origin});

		node.configure({});
		await flushMicrotasks();

		expect(vi.getTimerCount()).toBe(0);
		expect(node.outputs[0].type).toBe("IMAGE");
	});
});
