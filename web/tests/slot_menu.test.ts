import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {flushMicrotasks, installTestGlobals, makeGraph, makeNode} from './helpers/factories';

type Fixture = {
	canvas: { connecting_links: any[] | null; canvas: object; linkConnector?: { events: EventTarget } };
	frames: FrameRequestCallback[];
	menu: { open: boolean };
	app: any;
	handlers: typeof import('../src/handlers');
	utils: typeof import('../src/utils');
};

let fx: Fixture;

function step(): void
{
	const due = fx.frames.splice(0);
	for (const cb of due)
	{
		cb(0);
	}
}

// Like the frontend's LinkConnector.reset(): an extra listener may cancel it.
async function reset(cancelled: boolean): Promise<void>
{
	const events = fx.canvas.linkConnector!.events;
	const cancel = (e: Event) => e.preventDefault();
	if (cancelled)
	{
		events.addEventListener("reset", cancel, {once: true});
	}
	events.dispatchEvent(new CustomEvent("reset", {cancelable: true}));
	await flushMicrotasks();
}

function makeSource(id: number, nodes: Record<number, any>, graph: any): any
{
	const source = {
		id,
		graph,
		inputs: [{name: "image", type: "IMAGE", link: null as number | null}],
		outputs: [{name: "IMAGE", type: "IMAGE", links: [] as number[]}],
		connect: vi.fn(),
	};
	nodes[id] = source;
	return source;
}

async function addDynamicNode(configure: () => any, name: string, io: { in: number; out: number }, graph: any, nodes: Record<number, any>, id: number): Promise<any>
{
	const nodeType: any = function FakeNodeType()
	{
	};
	await configure().beforeRegisterNodeDef(nodeType, {name}, {} as any);
	const node = makeNode(io, graph, {id, graph, connect: vi.fn()});
	nodes[id] = node;
	return {nodeType, node};
}

async function addAnyNode(graph: any, nodes: Record<number, any>, id: number): Promise<any>
{
	return addDynamicNode(fx.handlers.configureDynamicAny, "PT_DynamicAny", {in: 1, out: 1}, graph, nodes, id);
}

async function runOnAdded(added: { nodeType: any; node: any }): Promise<void>
{
	added.nodeType.prototype.onAdded.call(added.node);
	await flushMicrotasks();
}

function startDrag(source: any, fromInput = false): void
{
	fx.canvas.connecting_links = [fromInput
		? {node: source, slot: 0, input: source.inputs[0], output: null}
		: {node: source, slot: 0, input: null, output: source.outputs[0]}];
	step();
}

// Assumption: like frontend 1.58.5, connecting_links is cleared on mouse up and the drag ends with one uncancelled reset.
async function dropOnSlot(source: any, graph: any, linkId: number): Promise<void>
{
	source.outputs[0].links.push(linkId);
	graph.links[linkId] = {id: linkId, origin_id: source.id, origin_slot: 0, target_id: 99, target_slot: 0};
	await dropWithoutMenu();
}

async function dropWithoutMenu(): Promise<void>
{
	fx.canvas.connecting_links = null;
	await reset(false);
	step();
}

// Assumption: like frontend 1.58.5, a drop on the canvas cancels the next reset while its menu stays open.
async function dropOnCanvasMenuOpen(): Promise<void>
{
	fx.canvas.connecting_links = null;
	await reset(true);
	step();
}

async function closeMenu(): Promise<void>
{
	await reset(false);
	step();
}

async function setup(withLinkConnector: boolean): Promise<void>
{
	vi.resetModules();
	const frames: FrameRequestCallback[] = [];
	const menu = {open: false};
	const canvas: Fixture["canvas"] = {connecting_links: null, canvas: {}};
	if (withLinkConnector)
	{
		canvas.linkConnector = {events: new EventTarget()};
	}
	const app = {canvas};
	(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
	{
		frames.push(cb);
		return frames.length;
	};
	(globalThis as any).window = {app};
	(globalThis as any).document = {querySelector: () => menu.open ? {} : null};
	(globalThis as any).LiteGraph = {INPUT: 1, OUTPUT: 2, createNode: vi.fn()};
	installTestGlobals();

	const utils = await import('../src/utils');
	const handlers = await import('../src/handlers');
	utils.configureSlotMenu(["IMAGE"], ["PT_DynamicAny", "Dynamic Any"]);
	fx = {canvas, frames, menu, app, handlers, utils};
	step();
}

beforeEach(() => setup(true));

afterEach(() =>
{
	delete (globalThis as any).document;
	vi.useRealTimers();
});

describe("pending wire-release connection", () =>
{
	it("is not applied to a node pasted after a slot-to-slot drag", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);

		startDrag(source);
		await dropOnSlot(source, graph, 1);
		await runOnAdded(await addAnyNode(graph, nodes, 2));

		expect(source.connect).not.toHaveBeenCalled();
	});

	it("is not applied to a node pasted after a drop that made no link", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);

		startDrag(source);
		await dropWithoutMenu();
		await runOnAdded(await addAnyNode(graph, nodes, 2));

		expect(source.connect).not.toHaveBeenCalled();
	});

	it("is not applied to a node added while the wire is still being dragged", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);

		startDrag(source);
		await runOnAdded(await addAnyNode(graph, nodes, 2));

		expect(source.connect).not.toHaveBeenCalled();
	});

	it("is not applied to nodes added while a graph loads", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);
		const added = await addAnyNode(graph, nodes, 2);

		const app: any = {loadGraphData: () => runOnAdded(added)};
		fx.utils.InstallGraphLoadingHook(app);

		startDrag(source);
		await dropOnCanvasMenuOpen();
		await app.loadGraphData();

		expect(source.connect).not.toHaveBeenCalled();
	});

	it("is not applied after the link-release menu was closed without a pick", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);

		startDrag(source);
		await dropOnCanvasMenuOpen();
		await closeMenu();
		await runOnAdded(await addAnyNode(graph, nodes, 2));

		expect(source.connect).not.toHaveBeenCalled();
	});

	it("connects a node picked from the link-release menu exactly once", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);
		const first = await addAnyNode(graph, nodes, 2);
		const second = await addAnyNode(graph, nodes, 3);

		startDrag(source);
		await dropOnCanvasMenuOpen();
		await runOnAdded(first);
		await closeMenu();
		await runOnAdded(second);

		expect(source.connect).toHaveBeenCalledTimes(1);
		expect(source.connect).toHaveBeenCalledWith(0, first.node, 0);
	});

	it("connects a node picked long after the release while the menu stays open", async () =>
	{
		vi.useFakeTimers({toFake: ["Date"]});
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);

		startDrag(source);
		await dropOnCanvasMenuOpen();
		vi.setSystemTime(Date.now() + 60000);
		for (let i = 0; i < 10; i++)
		{
			step();
		}
		const added = await addAnyNode(graph, nodes, 2);
		await runOnAdded(added);

		expect(source.connect).toHaveBeenCalledTimes(1);
		expect(source.connect).toHaveBeenCalledWith(0, added.node, 0);
	});

	it("is not applied when the drag source has left the graph", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);

		startDrag(source);
		await dropOnCanvasMenuOpen();
		delete nodes[10];
		await runOnAdded(await addAnyNode(graph, nodes, 2));

		expect(source.connect).not.toHaveBeenCalled();
	});

	it("adds no link when the frontend already connected the source output", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);
		const {nodeType, node} = await addAnyNode(graph, nodes, 2);

		startDrag(source);
		await dropOnCanvasMenuOpen();
		nodeType.prototype.onAdded.call(node);
		graph.links[5] = {id: 5, origin_id: source.id, origin_slot: 0, target_id: node.id, target_slot: 0};
		node.inputs[0].link = 5;
		await flushMicrotasks();

		expect(source.connect).not.toHaveBeenCalled();
		expect(node.connect).not.toHaveBeenCalled();
	});

	it("adds no reverse link when the frontend already fed the dragged input", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const target = makeSource(10, nodes, graph);
		const {nodeType, node} = await addAnyNode(graph, nodes, 2);

		startDrag(target, true);
		await dropOnCanvasMenuOpen();
		nodeType.prototype.onAdded.call(node);
		graph.links[5] = {id: 5, origin_id: node.id, origin_slot: 0, target_id: target.id, target_slot: 0};
		target.inputs[0].link = 5;
		node.outputs[0].links.push(5);
		await flushMicrotasks();

		expect(target.connect).not.toHaveBeenCalled();
		expect(node.connect).not.toHaveBeenCalled();
	});

	it("moves a dragged data input off the bus output of a new Dynamic Bus", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const target = makeSource(10, nodes, graph);
		const {nodeType, node} = await addDynamicNode(fx.handlers.configureDynamicBus, "PT_DynamicBus", {in: 1, out: 1}, graph, nodes, 2);

		startDrag(target, true);
		await dropOnCanvasMenuOpen();
		nodeType.prototype.onAdded.call(node);
		graph.links[5] = {id: 5, origin_id: node.id, origin_slot: 0, target_id: target.id, target_slot: 0};
		target.inputs[0].link = 5;
		node.outputs[0].links.push(5);
		await flushMicrotasks();

		expect(target.connect).not.toHaveBeenCalled();
		expect(node.connect).toHaveBeenCalledTimes(1);
		expect(node.connect).toHaveBeenCalledWith(1, target, 0);
	});
});

describe("pending wire-release connection without LinkConnector events", () =>
{
	beforeEach(() => setup(false));

	function dropAndOpenLegacyMenu(): void
	{
		fx.menu.open = true;
		fx.canvas.connecting_links = null;
		step();
	}

	it("connects a node picked from a menu opened after connecting_links was cleared", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);

		startDrag(source);
		dropAndOpenLegacyMenu();
		const added = await addAnyNode(graph, nodes, 2);
		await runOnAdded(added);

		expect(source.connect).toHaveBeenCalledTimes(1);
		expect(source.connect).toHaveBeenCalledWith(0, added.node, 0);
	});

	it("is not applied after that menu was closed without a pick", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);

		startDrag(source);
		dropAndOpenLegacyMenu();
		fx.menu.open = false;
		step();
		await runOnAdded(await addAnyNode(graph, nodes, 2));

		expect(source.connect).not.toHaveBeenCalled();
	});

	it("is not applied after a drop that opened no menu", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const source = makeSource(10, nodes, graph);

		startDrag(source);
		fx.canvas.connecting_links = null;
		step();
		await runOnAdded(await addAnyNode(graph, nodes, 2));

		expect(source.connect).not.toHaveBeenCalled();
	});
});
