import {describe, expect, it} from 'vitest';

import {configureBatchSwitchNodes, configureDynamicAny, configureDynamicBus, configureDynamicPassthrough, configureDynamicPreview, configureSwitchNodes} from '../src/handlers';
import {ANY_TYPE, BUS_TYPE} from '../src/types/tojioo';

import {connectInput, connectOutput, disconnectInput, flushMicrotasks, HandlerContext, initializeLinks, installTestGlobals, makeGraph, makeNode, Step,} from './helpers/factories';

installTestGlobals();

const LG_INPUT = (globalThis as any).LiteGraph.INPUT;
const LG_OUTPUT = (globalThis as any).LiteGraph.OUTPUT;

async function makeHandlerContext(configure: () => any, nodeData: any, io: { in: number; out: number }): Promise<HandlerContext>
{
	const nodes: Record<number, any> = {};
	const graph = makeGraph({}, nodes);
	const node = makeNode(io, graph, {id: 2});
	nodes[node.id] = node;

	const nodeType: any = function FakeNodeType()
	{
	};
	const ext = configure();
	await ext.beforeRegisterNodeDef(nodeType, nodeData, {} as any);

	return {nodeType, node, graph, nodes};
}

async function applyInputChange(ctx: HandlerContext, index: number, isConnected: boolean, link: any): Promise<void>
{
	ctx.nodeType.prototype.onConnectionsChange.call(ctx.node, LG_INPUT, index, isConnected, link, null);
	await flushMicrotasks();
}

async function applyOutputChange(ctx: HandlerContext, index: number, isConnected: boolean, link: any): Promise<void>
{
	ctx.nodeType.prototype.onConnectionsChange.call(ctx.node, LG_OUTPUT, index, isConnected, link, null);
	await flushMicrotasks();
}

async function runSteps(steps: Step[]): Promise<void>
{
	for (const step of steps)
	{
		await step.act();
		step.assert();
	}
}

function makeDynamicAnyCases(): Array<{ name: string; steps: (ctx: HandlerContext) => Step[] }>
{
	return [
		{
			name: "connects typed input and resets on disconnect",
			steps: (ctx) =>
			{
				const origin = {id: 10, outputs: [{type: "STRING"}]};
				ctx.nodes[origin.id] = origin;

				const link = connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 1, origin});

				return [
					{
						act: () => applyInputChange(ctx, 0, true, link),
						assert: () =>
						{
							expect(ctx.node.inputs[0]).toMatchObject({type: "STRING", name: "string", label: "string"});
							expect(ctx.node.outputs[0]).toMatchObject({type: "STRING", name: "string", label: "string"});
							expect(ctx.graph.links[1].type).toBe("STRING");
						},
					},
					{
						act: () =>
						{
							disconnectInput(ctx.node, 0);
							return applyInputChange(ctx, 0, false, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs[0].type).toBe(ANY_TYPE);
							expect(ctx.node.inputs[0].name).toBe("input");
							expect(ctx.node.outputs[0].type).toBe(ANY_TYPE);
							expect(ctx.node.outputs[0].name).toBe("output");
						},
					},
				];
			},
		},
	];
}

function makeDynamicPassthroughCases(): Array<{ name: string; steps: (ctx: HandlerContext) => Step[] }>
{
	return [
		{
			name: "expands inputs and propagates types on connect",
			steps: (ctx) =>
			{
				const origin = {id: 11, outputs: [{type: "IMAGE"}]};
				ctx.nodes[origin.id] = origin;
				const link = connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 2, origin});

				return [
					{
						act: () => applyInputChange(ctx, 0, true, link),
						assert: () =>
						{
							expect(ctx.node.inputs.length).toBe(2);
							expect(ctx.node.outputs.length).toBe(2);
							expect(ctx.node.inputs[0].label).toBe("image");
							expect(ctx.node.outputs[0].label).toBe("image");
							expect(ctx.graph.links[2].type).toBe("IMAGE");
						},
					},
				];
			},
		},
		{
			name: "removes disconnected middle slot when later connections exist",
			steps: (ctx) =>
			{
				const originA = {id: 12, outputs: [{type: "IMAGE"}]};
				const originB = {id: 13, outputs: [{type: "MASK"}]};

				const links = initializeLinks(ctx, originA, originB);

				const removeOutput = ctx.node.removeOutput.bind(ctx.node);
				ctx.node.removeOutput = (...args: any[]) =>
				{
					ctx.node.__removedOut = args[0];
					return removeOutput(...args);
				};

				return [
					{
						act: async () =>
						{
							links.a = connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 3, origin: originA});
							await applyInputChange(ctx, 0, true, links.a);
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							links.b = connectInput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 4, origin: originB});
							await applyInputChange(ctx, 1, true, links.b);
						},
						assert: () =>
						{
							expect(ctx.node.inputs.length).toBeGreaterThanOrEqual(3);
						},
					},
					{
						act: () =>
						{
							disconnectInput(ctx.node, 0);
							return applyInputChange(ctx, 0, false, links.a);
						},
						assert: () =>
						{
							expect(ctx.node.__removed).toBe(0);
							expect(ctx.node.__removedOut).toBe(0);
						},
					},
				];
			},
		},
		{
			name: "infers types from output connections",
			steps: (ctx) =>
			{
				const target = {id: 14, inputs: [{type: "LATENT"}]};
				ctx.nodes[target.id] = target;
				const link = connectOutput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 5, target});

				return [
					{
						act: () => applyOutputChange(ctx, 0, true, link),
						assert: () =>
						{
							expect(ctx.node.outputs[0].type).toBe("LATENT");
							expect(ctx.node.inputs[0].type).toBe("LATENT");
						},
					},
				];
			},
		},
	];
}

function makeDynamicBusCases(): Array<{ name: string; steps: (ctx: HandlerContext) => Step[] }>
{
	return [
		{
			name: "initializes bus slots and widgets on add",
			steps: (ctx) =>
			{
				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
							expect(ctx.node.inputs[0]).toMatchObject({name: "bus", type: BUS_TYPE});
							expect(ctx.node.outputs[0]).toMatchObject({name: "bus", type: BUS_TYPE});
							expect(ctx.node.inputs.length).toBe(2);
							expect(ctx.node.outputs.length).toBe(2);
							const slotTypes = ctx.node.widgets.find((w: any) => w.name === "_slot_types");
							const outputHints = ctx.node.widgets.find((w: any) => w.name === "_output_hints");
							expect(slotTypes?.value).toBe("");
							expect(outputHints?.value).toBe("");
						},
					},
				];
			},
		},
		{
			name: "propagates input types and slot metadata",
			steps: (ctx) =>
			{
				const origin = {id: 20, outputs: [{type: "IMAGE"}]};
				ctx.nodes[origin.id] = origin;

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							const link = connectInput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 6, origin});
							await applyInputChange(ctx, 1, true, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs[1].type).toBe("IMAGE");
							expect(ctx.node.outputs[1].type).toBe("IMAGE");
							const slotTypes = ctx.node.widgets.find((w: any) => w.name === "_slot_types");
							expect(slotTypes?.value).toBe("1:IMAGE");
							expect(ctx.node.properties._busTypes).toEqual({0: "IMAGE"});
						},
					},
				];
			},
		},
		{
			name: "builds output hints from output-only connections",
			steps: (ctx) =>
			{
				const target = {id: 21, inputs: [{type: "MASK"}]};
				ctx.nodes[target.id] = target;

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							const link = connectOutput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 7, target});
							await applyOutputChange(ctx, 1, true, link);
						},
						assert: () =>
						{
							const outputHints = ctx.node.widgets.find((w: any) => w.name === "_output_hints");
							expect(outputHints?.value).toBe("1:MASK:0");
						},
					},
				];
			},
		},
		{
			name: "appends upstream bus types to local bus map",
			steps: (ctx) =>
			{
				const upstream = {id: 30, outputs: [{type: BUS_TYPE}], properties: {_busTypes: {0: "LATENT"}}};
				const origin = {id: 31, outputs: [{type: "IMAGE"}]};
				ctx.nodes[upstream.id] = upstream;
				ctx.nodes[origin.id] = origin;

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							const busLink = connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 8, origin: upstream});
							await applyInputChange(ctx, 0, true, busLink);
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							const inputLink = connectInput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 9, origin});
							await applyInputChange(ctx, 1, true, inputLink);
						},
						assert: () =>
						{
							expect(ctx.node.properties._busTypes).toEqual({0: "LATENT", 1: "IMAGE"});
						},
					},
				];
			},
		},
		{
			name: "resets when configure detects typed unconnected slots",
			steps: (ctx) =>
			{
				const info = {
					inputs: [{}, {type: "IMAGE", link: null}],
					outputs: [{}, {type: "IMAGE", links: []}],
				};

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.configure.call(ctx.node, info);
							return flushMicrotasks();
						},
						assert: () =>
						{
							expect(ctx.node.inputs[1].type).toBe(ANY_TYPE);
							expect(ctx.node.outputs[1].type).toBe(ANY_TYPE);
							const slotTypes = ctx.node.widgets.find((w: any) => w.name === "_slot_types");
							const outputHints = ctx.node.widgets.find((w: any) => w.name === "_output_hints");
							expect(slotTypes?.value).toBe("");
							expect(outputHints?.value).toBe("");
						},
					},
				];
			},
		},
		{
			name: "resets slot type when input is disconnected and no output exists",
			steps: (ctx) =>
			{
				const origin = {id: 20, outputs: [{type: "IMAGE"}]};
				ctx.nodes[origin.id] = origin;

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							const link = connectInput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 30, origin});
							await applyInputChange(ctx, 1, true, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs[1].type).toBe("IMAGE");
							expect(ctx.node.outputs[1].type).toBe("IMAGE");
							expect(ctx.node.inputs[1].label).toBe("image");
						},
					},
					{
						act: async () =>
						{
							const link = ctx.graph.links[30];
							disconnectInput(ctx.node, 1);
							await applyInputChange(ctx, 1, false, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs[1].type).toBe(ANY_TYPE);
							expect(ctx.node.outputs[1].type).toBe(ANY_TYPE);
							expect(ctx.node.inputs[1].label).toBe("input");
							expect(ctx.node.outputs[1].label).toBe("output");
						},
					},
				];
			},
		},
		{
			name: "resets slot type when output is disconnected from target side",
			steps: (ctx) =>
			{
				const target = {id: 22, inputs: [{type: "IMAGE", link: null as number | null}]};
				ctx.nodes[target.id] = target;

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							const link = connectOutput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 31, target});
							target.inputs[0].link = 31;
							await applyOutputChange(ctx, 1, true, link);
						},
						assert: () =>
						{
							expect(ctx.node.outputs[1].type).toBe("IMAGE");
							expect(ctx.node.inputs[1].type).toBe("IMAGE");
							expect(ctx.node.outputs[1].label).toBe("image");
						},
					},
					{
						act: async () =>
						{
							const link = ctx.graph.links[31];
							// Target disconnects: clears its input link and graph link
							target.inputs[0].link = null;
							delete ctx.graph.links[31];
							// Stale ID remains in output links array
							await applyOutputChange(ctx, 1, false, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs[1].type).toBe(ANY_TYPE);
							expect(ctx.node.outputs[1].type).toBe(ANY_TYPE);
							expect(ctx.node.inputs[1].label).toBe("input");
							expect(ctx.node.outputs[1].label).toBe("output");
						},
					},
				];
			},
		},
		{
			name: "preserves slot type when output disconnects but input remains",
			steps: (ctx) =>
			{
				const origin = {id: 23, outputs: [{type: "MASK"}]};
				const target = {id: 24, inputs: [{type: "MASK", link: null as number | null}]};
				ctx.nodes[origin.id] = origin;
				ctx.nodes[target.id] = target;

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							const link = connectInput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 32, origin});
							await applyInputChange(ctx, 1, true, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs[1].type).toBe("MASK");
						},
					},
					{
						act: async () =>
						{
							const link = connectOutput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 33, target});
							target.inputs[0].link = 33;
							await applyOutputChange(ctx, 1, true, link);
						},
						assert: () =>
						{
							expect(ctx.node.outputs[1].type).toBe("MASK");
						},
					},
					{
						act: async () =>
						{
							const link = ctx.graph.links[33];
							target.inputs[0].link = null;
							delete ctx.graph.links[33];
							await applyOutputChange(ctx, 1, false, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs[1].type).toBe("MASK");
							expect(ctx.node.outputs[1].type).toBe("MASK");
							expect(ctx.node.inputs[1].label).toBe("mask");
						},
					},
				];
			},
		},
		{
			name: "resets slot when stale link ID remains in output links array",
			steps: (ctx) =>
			{
				const target = {id: 25, inputs: [{type: "LATENT", link: null as number | null}]};
				ctx.nodes[target.id] = target;

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							const link = connectOutput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 34, target});
							target.inputs[0].link = 34;
							await applyOutputChange(ctx, 1, true, link);
						},
						assert: () =>
						{
							expect(ctx.node.outputs[1].type).toBe("LATENT");
						},
					},
					{
						act: async () =>
						{
							const link = ctx.graph.links[34];
							// Graph removes link but stale ID stays in output links array
							target.inputs[0].link = null;
							delete ctx.graph.links[34];
							// Do NOT clean node.outputs[1].links — simulates real timing
							expect(ctx.node.outputs[1].links).toContain(34);
							await applyOutputChange(ctx, 1, false, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs[1].type).toBe(ANY_TYPE);
							expect(ctx.node.outputs[1].type).toBe(ANY_TYPE);
						},
					},
				];
			},
		},
	];
}

function makeDynamicPreviewCases(): Array<{ name: string; steps: (ctx: HandlerContext) => Step[] }>
{
	return [
		{
			name: "connects, labels inputs, and resets preview state when disconnected",
			steps: (ctx) =>
			{
				const origin = {id: 40, outputs: [{type: "IMAGE"}]};
				ctx.nodes[origin.id] = origin;
				const link = connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 10, origin});

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: () => applyInputChange(ctx, 0, true, link),
						assert: () =>
						{
							expect(ctx.node.inputs[0].type).toBe("IMAGE");
							expect(ctx.node.inputs.length).toBe(2);
						},
					},
					{
						act: () =>
						{
							ctx.node._previewItems = [{type: "image", element: {}}];
							ctx.node._totalImages = 1;
							ctx.node._currentImageIndex = 0;
							disconnectInput(ctx.node, 0);
							return applyInputChange(ctx, 0, false, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs.length).toBe(1);
							expect(ctx.node._totalImages).toBe(0);
							expect(ctx.node._previewItems.length).toBe(0);
						},
					},
				];
			},
		},
		{
			name: "handles preview execution with image list",
			steps: (ctx) =>
			{
				return [
					{
						act: () =>
						{
							ctx.node._currentImageIndex = 4;
							ctx.nodeType.prototype.onExecuted.call(ctx.node, {
								preview_data: [
									{filename: "a.png", subfolder: "", type: "temp", slot: 0},
									{filename: "b.png", subfolder: "", type: "temp", slot: 0},
								],
							});
						},
						assert: () =>
						{
							expect(ctx.node._totalImages).toBe(2);
							expect(ctx.node._currentImageIndex).toBe(1);
							expect(ctx.node._previewItems.length).toBe(2);
							expect(ctx.node._previewItems[0].type).toBe("image");
							expect(ctx.node._previewItems[1].type).toBe("image");
						},
					},
				];
			},
		},
		{
			name: "labels untyped slots as 'value'",
			steps: (ctx) =>
			{
				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
							expect(ctx.node.inputs[0].label).toBe("value");
						},
					},
				];
			},
		},
		{
			name: "labels typed slot by type, untyped as 'value'",
			steps: (ctx) =>
			{
				const origin = {id: 41, outputs: [{type: "IMAGE"}]};
				ctx.nodes[origin.id] = origin;

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							const link = connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 11, origin});
							await applyInputChange(ctx, 0, true, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs[0].label).toBe("image");
							expect(ctx.node.inputs[1].label).toBe("value");
						},
					},
				];
			},
		},
		{
			name: "handles text-only preview data",
			steps: (ctx) =>
			{
				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onExecuted.call(ctx.node, {
								preview_data: [],
								text_data: [
									{slot: 0, text: "Tensor: shape=[1, 64, 64], dtype=float32"},
								],
							});
						},
						assert: () =>
						{
							expect(ctx.node._previewItems.length).toBe(1);
							expect(ctx.node._previewItems[0].type).toBe("text");
							expect(ctx.node._previewItems[0].text).toContain("Tensor");
							expect(ctx.node._totalImages).toBe(1);
						},
					},
				];
			},
		},
		{
			name: "handles mixed image and text preview data",
			steps: (ctx) =>
			{
				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onExecuted.call(ctx.node, {
								preview_data: [
									{filename: "img.png", subfolder: "", type: "temp", slot: 0},
								],
								text_data: [
									{slot: 1, text: "Some string value"},
								],
							});
						},
						assert: () =>
						{
							expect(ctx.node._previewItems.length).toBe(2);
							expect(ctx.node._previewItems[0].type).toBe("image");
							expect(ctx.node._previewItems[1].type).toBe("text");
							expect(ctx.node._totalImages).toBe(2);
						},
					},
				];
			},
		},
		{
			name: "disconnect resets all preview state including text",
			steps: (ctx) =>
			{
				const origin = {id: 42, outputs: [{type: "STRING"}]};
				ctx.nodes[origin.id] = origin;
				const link = connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 12, origin});

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: () => applyInputChange(ctx, 0, true, link),
						assert: () =>
						{
							expect(ctx.node.inputs[0].type).toBe("STRING");
						},
					},
					{
						act: () =>
						{
							ctx.node._previewItems = [{type: "text", text: "hello"}];
							ctx.node._totalImages = 1;
							disconnectInput(ctx.node, 0);
							return applyInputChange(ctx, 0, false, link);
						},
						assert: () =>
						{
							expect(ctx.node._previewItems.length).toBe(0);
							expect(ctx.node._totalImages).toBe(0);
						},
					},
				];
			},
		},
		{
			name: "input.name stays input_N format on connect",
			steps: (ctx) =>
			{
				const origin = {id: 43, outputs: [{type: "IMAGE"}]};
				ctx.nodes[origin.id] = origin;

				return [
					{
						act: () =>
						{
							ctx.nodeType.prototype.onAdded.call(ctx.node);
							return flushMicrotasks();
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							const link = connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 13, origin});
							await applyInputChange(ctx, 0, true, link);
						},
						assert: () =>
						{
							expect(ctx.node.inputs[0].name).toBe("input_1");
							expect(ctx.node.inputs[0].label).toBe("image");
						},
					},
				];
			},
		},
	];
}

function makeSwitchCases(): Array<{ name: string; steps: (ctx: HandlerContext) => Step[] }>
{
	return [
		{
			name: "adds new input when last is connected",
			steps: (ctx) =>
			{
				const origin = {id: 50, outputs: [{type: "IMAGE"}]};
				ctx.nodes[origin.id] = origin;
				const link = connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 20, origin});

				return [
					{
						act: () => applyInputChange(ctx, 0, true, link),
						assert: () =>
						{
							expect(ctx.node.inputs.length).toBe(2);
							expect(ctx.node.inputs[0].label).toBe("image");
						},
					},
				];
			},
		},
		{
			name: "removes disconnected input when later links exist",
			steps: (ctx) =>
			{
				const originA = {id: 51, outputs: [{type: "IMAGE"}]};
				const originB = {id: 52, outputs: [{type: "MASK"}]};

				const links = initializeLinks(ctx, originA, originB);

				return [
					{
						act: async () =>
						{
							links.a = connectInput({node: ctx.node, graph: ctx.graph, index: 0, linkId: 21, origin: originA});
							await applyInputChange(ctx, 0, true, links.a);
						},
						assert: () =>
						{
						},
					},
					{
						act: async () =>
						{
							links.b = connectInput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 22, origin: originB});
							await applyInputChange(ctx, 1, true, links.b);
						},
						assert: () =>
						{
						},
					},
					{
						act: () =>
						{
							disconnectInput(ctx.node, 0);
							return applyInputChange(ctx, 0, false, links.a);
						},
						assert: () =>
						{
							expect(ctx.node.__removed).toBe(0);
						},
					},
				];
			},
		},
	];
}

describe("handlers", () =>
{
	describe("dynamic_any", () =>
	{
		for (const testCase of makeDynamicAnyCases())
		{
			it(testCase.name, async () =>
			{
				const ctx = await makeHandlerContext(configureDynamicAny, {name: "PT_DynamicAny"}, {in: 1, out: 1});
				await runSteps(testCase.steps(ctx));
			});
		}
	});

	describe("dynamic_passthrough", () =>
	{
		for (const testCase of makeDynamicPassthroughCases())
		{
			it(testCase.name, async () =>
			{
				const ctx = await makeHandlerContext(configureDynamicPassthrough, {name: "PT_DynamicPassthrough"}, {in: 1, out: 1});
				await runSteps(testCase.steps(ctx));
			});
		}
	});

	describe("dynamic_bus", () =>
	{
		for (const testCase of makeDynamicBusCases())
		{
			it(testCase.name, async () =>
			{
				const ctx = await makeHandlerContext(configureDynamicBus, {name: "PT_DynamicBus"}, {in: 1, out: 1});
				await runSteps(testCase.steps(ctx));
			});
		}
	});

	describe("dynamic_preview", () =>
	{
		for (const testCase of makeDynamicPreviewCases())
		{
			it(testCase.name, async () =>
			{
				const ctx = await makeHandlerContext(configureDynamicPreview, {name: "PT_DynamicPreview"}, {in: 1, out: 0});
				await runSteps(testCase.steps(ctx));
			});
		}
	});

	describe.each([
		["switch", configureSwitchNodes, "PT_AnyImageSwitch"],
		["batch_switch", configureBatchSwitchNodes, "PT_AnyImageBatchSwitch"],
	])("%s handlers", (_label, configure, name) =>
	{
		for (const testCase of makeSwitchCases())
		{
			it(testCase.name, async () =>
			{
				const ctx = await makeHandlerContext(
					configure,
					{name, input: {optional: {image_1: {}, image_2: {}}}},
					{in: 1, out: 1},
				);
				await runSteps(testCase.steps(ctx));
			});
		}
	});
});