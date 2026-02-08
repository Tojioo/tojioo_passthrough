import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {connectInput, installTestGlobals, makeGraph, makeNode} from './helpers/factories';

installTestGlobals();

describe("lifecycle utilities", () =>
{
	let lifecycle: typeof import('../src/utils/lifecycle');
	let originalRaf: typeof globalThis.requestAnimationFrame | undefined;

	beforeEach(async () =>
	{
		vi.resetModules();
		lifecycle = await import('../src/utils/lifecycle');

		originalRaf = globalThis.requestAnimationFrame;
		(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
		{
			cb(0);
			return 0;
		};
	});

	afterEach(() =>
	{
		if (originalRaf)
		{
			globalThis.requestAnimationFrame = originalRaf;
		}
	});
	it("InstallGraphLoadingHook toggles IsGraphLoading during load", async () =>
	{
		const app: any = {};
		let resolve!: () => void;
		const p = new Promise<void>((r) => (resolve = r));
		app.loadGraphData = vi.fn(() => p);

		lifecycle.InstallGraphLoadingHook(app);

		const call = app.loadGraphData();
		expect(lifecycle.IsGraphLoading()).toBe(true);

		resolve();
		await call;
		expect(lifecycle.IsGraphLoading()).toBe(false);
	});

	it("DeferMicrotask schedules callback in microtask queue", async () =>
	{
		let ran = false;
		lifecycle.DeferMicrotask(() =>
		{
			ran = true;
		});
		expect(ran).toBe(false);
		await Promise.resolve();
		expect(ran).toBe(true);
	});

	it("DeferMicrotask fallback via Promise when queueMicrotask is unavailable", async () =>
	{
		const original = (globalThis as any).queueMicrotask;
		(globalThis as any).queueMicrotask = undefined;
		try
		{
			let ran = false;
			lifecycle.DeferMicrotask(() =>
			{
				ran = true;
			});
			expect(ran).toBe(false);
			await Promise.resolve();
			expect(ran).toBe(true);
		}
		finally
		{
			(globalThis as any).queueMicrotask = original;
		}
	});

	it("DeriveDynamicPrefixFromNodeData handles numeric suffixes", () =>
	{
		const nodeData1: any = {input: {optional: {foo_1: {}, foo_2: {}}}};
		expect(lifecycle.DeriveDynamicPrefixFromNodeData(nodeData1)).toBe("foo");

		const nodeData2: any = {input: {optional: {bar2: {}, bar10: {}}}};
		expect(lifecycle.DeriveDynamicPrefixFromNodeData(nodeData2)).toBe("bar");

		const nodeData3: any = {input: {optional: {only: {}}}};
		expect(lifecycle.DeriveDynamicPrefixFromNodeData(nodeData3)).toBe("only");

		const nodeData4: any = {input: {optional: {}}};
		expect(lifecycle.DeriveDynamicPrefixFromNodeData(nodeData4)).toBeNull();

		expect(lifecycle.DeriveDynamicPrefixFromNodeData({} as any)).toBeNull();
	});

	it("ResolveInputType uses inferred or linked endpoint types", () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const node = makeNode({in: 1, out: 0}, graph, {id: 2});
		nodes[node.id] = node;

		const origin = {id: 1, outputs: [{type: "IMAGE"}]};
		nodes[origin.id] = origin;

		const link = connectInput({node, graph, index: 0, linkId: 7, origin});
		const t = lifecycle.ResolveInputType(node, 0);
		expect(t).toBe("IMAGE");

		graph.links[7].type = "MASK";
		origin.outputs[0].type = "*";
		expect(lifecycle.ResolveInputType(node, 0)).toBe("MASK");
		expect(link.type).toBe("MASK");
	});

	it("ScheduleCanvasUpdate marks the graph dirty once", () =>
	{
		const graph = makeGraph({}, {});
		const node = makeNode({in: 0, out: 0}, graph);
		lifecycle.ScheduleCanvasUpdate(node);
		expect(graph.setDirtyCanvas).toHaveBeenCalledWith(true, true);
	});

	it("ScheduleSizeUpdate applies UpdateNodeSizeImmediate", () =>
	{
		const graph = makeGraph({}, {});
		const node = makeNode({in: 0, out: 0}, graph);
		lifecycle.ScheduleSizeUpdate(node);
		expect(node.setSize).toHaveBeenCalled();
	});

	// Prone to be flaky
	it("ApplySwitchDynamicTypes sets input/output names and updates link types", () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const node = makeNode({in: 2, out: 1}, graph, {id: 2});
		nodes[node.id] = node;
		const origin = {id: 1, outputs: [{type: "TEXT"}]};
		nodes[origin.id] = origin;
		connectInput({node, graph, index: 0, linkId: 10, origin});

		lifecycle.ApplySwitchDynamicTypes(node, "image");

		expect(node.inputs[0].type).toBe("TEXT");
		expect(node.inputs[0].label).toBe("text");
		expect(node.outputs[0].type).toBe("TEXT");
		expect(graph.links[10].type).toBe("TEXT");
		expect(node.setSize).toHaveBeenCalled();
		expect(graph.setDirtyCanvas).toHaveBeenCalledWith(true, true);
	});

	it("UpdateNodeSizeImmediate respects preview expand-only default", () =>
	{
		const node: any = {
			type: "PT_DynamicPreview",
			size: [80, 20],
			computeSize: () => [60, 40],
			setSize: vi.fn(),
		};

		lifecycle.UpdateNodeSizeImmediate(node);
		expect(node.setSize).toHaveBeenCalledWith([80, 40]);
	});

	it("UpdateNodeSize skips when graph is loading", async () =>
	{
		const graph = makeGraph({}, {});
		const node = makeNode({in: 0, out: 0}, graph);

		const app: any = {
			loadGraphData: async () =>
			{
				lifecycle.UpdateNodeSize(node);
			},
		};

		lifecycle.InstallGraphLoadingHook(app);
		await app.loadGraphData();

		expect(node.setSize).not.toHaveBeenCalled();
	});

	it("UpdatePreviewNodeSize returns early when flagged to skip", () =>
	{
		const node: any = {
			__tojioo_skip_resize: true,
			size: [10, 10],
			computeSize: vi.fn(() => [20, 5]),
			setSize: vi.fn(),
		};
		lifecycle.UpdatePreviewNodeSize(node);
		expect(node.setSize).not.toHaveBeenCalled();
	});

	it("NormalizeInputs prunes trailing unconnected inputs", () =>
	{
		const graph = makeGraph({}, {});
		const node = makeNode({in: 4, out: 0}, graph);
		node.inputs[1].link = 1;
		lifecycle.NormalizeInputs(node);
		expect(node.inputs.length).toBe(3);
	});
});