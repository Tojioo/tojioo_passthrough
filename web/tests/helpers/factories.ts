import {vi} from 'vitest';

export type Link = {
	id: number;
	origin_id: number;
	origin_slot: number;
	target_id: number;
	target_slot: number;
	type?: string;
};

export type Graph = {
	links: Record<number, Link>;
	getNodeById: (id: number) => any | null;
	setDirtyCanvas: ReturnType<typeof vi.fn>;
};

export type NodeIO = {
	name: string;
	label: string;
	type: any;
	link?: number | null;
	links?: number[];
};

export type HandlerContext = {
	nodeType: any;
	node: any;
	graph: ReturnType<typeof makeGraph>;
	nodes: Record<number, any>;
};

export type Step = {
	act: () => Promise<void> | void;
	assert: () => void;
};

const DEFAULT_LITEGRAPH = {INPUT: 1, OUTPUT: 2};

export function installTestGlobals(): void
{
	if (!(globalThis as any).LiteGraph)
	{
		(globalThis as any).LiteGraph = DEFAULT_LITEGRAPH;
	}

	if (!(globalThis as any).requestAnimationFrame)
	{
		(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
		{
			cb(0);
			return 0;
		};
	}

	if (!(globalThis as any).cancelAnimationFrame)
	{
		(globalThis as any).cancelAnimationFrame = () =>
		{
		};
	}

	if (!(globalThis as any).Image)
	{
		// noinspection JSUnusedGlobalSymbols -> We're mocking, so IDE can shut up.
		class ImageMock
		{
			complete = true;
			naturalWidth = 64;
			naturalHeight = 64;
			width = 64;
			height = 64;
			src = "";
		}

		(globalThis as any).Image = ImageMock;
	}
}

export function makeGraph(links: Record<number, Link> = {}, nodes: Record<number, any> = {}): Graph
{
	return {
		links,
		getNodeById: (id: number) => nodes[id] ?? null,
		setDirtyCanvas: vi.fn(),
	};
}

export function makeNode(
	io: { in: number; out: number },
	graph: Graph,
	overrides: Record<string, any> = {},
): any
{
	const inputs: NodeIO[] = Array.from({length: io.in}, (_v, idx) => ({
		name: `input_${idx + 1}`,
		label: "input",
		type: "*",
		link: null,
	}));
	const outputs: NodeIO[] = Array.from({length: io.out}, (_v, idx) => ({
		name: `output_${idx + 1}`,
		label: "output",
		type: "*",
		links: [],
	}));

	return {
		id: overrides.id ?? Math.floor(Math.random() * 10000),
		inputs,
		outputs,
		addInput(name: string, type: any)
		{
			this.inputs.push({name, label: name, type, link: null});
		},
		removeInput(index: number)
		{
			this.inputs.splice(index, 1);
		},
		addOutput(name: string, type: any)
		{
			this.outputs.push({name, label: name, type, links: []});
		},
		removeOutput(index: number)
		{
			this.outputs.splice(index, 1);
		},
		computeSize: () => [120, 40] as [number, number],
		setSize: vi.fn(),
		rootGraph: graph,
		properties: {},
		widgets: [],
		...overrides,
	};
}

export function makeLink(params: Partial<Link> & Pick<Link, "id">): Link
{
	return {
		id: params.id,
		origin_id: params.origin_id ?? 0,
		origin_slot: params.origin_slot ?? 0,
		target_id: params.target_id ?? 0,
		target_slot: params.target_slot ?? 0,
		type: params.type,
	};
}

export function connectInput(params: {
	node: any;
	graph: Graph;
	index: number;
	linkId: number;
	origin: any;
	originSlot?: number;
	type?: string;
}): Link
{
	const link = makeLink({
		id: params.linkId,
		origin_id: params.origin.id,
		origin_slot: params.originSlot ?? 0,
		target_id: params.node.id,
		target_slot: params.index,
		type: params.type,
	});
	params.graph.links[params.linkId] = link;
	params.node.inputs[params.index].link = params.linkId;
	return link;
}

export function connectOutput(params: {
	node: any;
	graph: Graph;
	index: number;
	linkId: number;
	target: any;
	targetSlot?: number;
	type?: string;
}): Link
{
	const link = makeLink({
		id: params.linkId,
		origin_id: params.node.id,
		origin_slot: params.index,
		target_id: params.target.id,
		target_slot: params.targetSlot ?? 0,
		type: params.type,
	});
	params.graph.links[params.linkId] = link;
	params.node.outputs[params.index].links = params.node.outputs[params.index].links ?? [];
	params.node.outputs[params.index].links.push(params.linkId);
	return link;
}

export function disconnectInput(node: any, index: number): void
{
	if (node.inputs?.[index])
	{
		node.inputs[index].link = null;
	}
}

// Todo: Add to tests -> disconnecting output when no input is connected behavior
// noinspection JSUnusedGlobalSymbols -> Todo above.
export function disconnectOutput(node: any, index: number, linkId: number): void
{
	const links = node.outputs?.[index]?.links ?? [];
	node.outputs[index].links = links.filter((id: number) => id !== linkId);
}

export async function flushMicrotasks(): Promise<void>
{
	await Promise.resolve();
}

export const initializeLinks = (ctx: HandlerContext, originA: { id: number; outputs: { type: string }[] }, originB: { id: number; outputs: { type: string }[] }) =>
{
	ctx.nodes[originA.id] = originA;
	ctx.nodes[originB.id] = originB;
	const links: Record<string, any> = {};

	const removeInput = ctx.node.removeInput.bind(ctx.node);
	ctx.node.removeInput = (...args: any[]) =>
	{
		ctx.node.__removed = args[0];
		return removeInput(...args);
	};
	return links;
}