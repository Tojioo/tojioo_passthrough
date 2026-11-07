import {vi} from 'vitest';

import {InstallGraphLoadingHook} from '../../src/utils';
import {makeGraph, makeNode} from './factories';
import {installFrameQueue} from './animation_frames';

export const SLOT_HEIGHT = 20;
const TITLE_PADDING = 6;
export const CONSTRUCTOR_OUTPUTS = 32;

export type SizedNodeSpec = {
	type: string;
	width: number;
	constructorInputs: number;
};

export const DYNAMIC_BUS: SizedNodeSpec = {type: "PT_DynamicBus", width: 210, constructorInputs: 1};
export const DYNAMIC_PASSTHROUGH: SizedNodeSpec = {type: "PT_DynamicPassthrough", width: 185, constructorInputs: 0};

export type SizedHarness = {
	nodeType: any;
	node: any;
	nodes: Record<number, any>;
	flushFrames: () => void;
};

// Needed: deferred syncs queue further microtasks, and a macrotask boundary runs all of them.
export function settle(): Promise<void>
{
	return new Promise((r) => setTimeout(r, 0));
}

export function slotHeight(rows: number): number
{
	return Math.max(1, rows) * SLOT_HEIGHT + TITLE_PADDING;
}

// Needed: LiteGraph's configure clones saved slots into the constructor arrays by index, so constructor slots past the saved ones survive it.
function liteGraphConfigure(this: any, info: any): void
{
	for (const key of ["inputs", "outputs"])
	{
		for (const [i, slot] of (info[key] ?? []).entries())
		{
			this[key][i] = structuredClone(slot);
		}
	}
	if (info.size)
	{
		this.size[0] = info.size[0];
		this.size[1] = info.size[1];
	}
}

export async function makeSizedHarness(configure: () => any, spec: SizedNodeSpec): Promise<SizedHarness>
{
	const frames = installFrameQueue();
	const nodes: Record<number, any> = {};
	const graph = makeGraph({}, nodes);

	const nodeType: any = function FakeNodeType()
	{
	};
	nodeType.prototype.configure = liteGraphConfigure;
	await configure().beforeRegisterNodeDef(nodeType, {name: spec.type}, {} as any);

	const node = makeNode({in: spec.constructorInputs, out: CONSTRUCTOR_OUTPUTS}, graph, {
		id: 2,
		type: spec.type,
		size: [140, 60],
		computeSize(this: any): [number, number]
		{
			return [spec.width, slotHeight(Math.max(this.inputs.length, this.outputs.length))];
		},
		setSize: vi.fn(function(this: any, size: number[])
		{
			this.size = [size[0], size[1]];
		}),
	});
	Object.setPrototypeOf(node, nodeType.prototype);
	nodes[node.id] = node;

	// Assumption: mirrors ComfyUI's setInitialSize, which runs in the node constructor.
	node.setSize(node.computeSize());
	return {nodeType, node, nodes, flushFrames: frames.flush};
}

export async function addFreshNode(h: SizedHarness): Promise<void>
{
	h.node.onAdded();
	await settle();
	h.flushFrames();
}

export async function loadSavedNode(h: SizedHarness, info: any): Promise<void>
{
	const app: any = {};
	let finish: () => void = () => {};
	app.loadGraphData = async function()
	{
		h.node.onAdded();
		h.node.configure(info);

		const size = h.node.computeSize();
		h.node.setSize([Math.max(h.node.size[0], size[0]), Math.max(h.node.size[1], size[1])]);

		await new Promise<void>((r) => (finish = r));
	};
	InstallGraphLoadingHook(app);

	const load = app.loadGraphData();
	await settle();
	finish();
	await load;
	await settle();
	h.flushFrames();
}
