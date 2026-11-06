import {beforeEach, describe, expect, it} from 'vitest';

import {configureDynamicPassthrough, configureSwitchNodes} from '../src/handlers';
import {UpdateNodeSize} from '../src/utils';
import {connectInput, flushMicrotasks, installTestGlobals, makeGraph, makeNode} from './helpers/factories';
import {makeHarness, notifyConnectionChange} from './helpers/handler_harness';

installTestGlobals();

const LG_INPUT = (globalThis as any).LiteGraph.INPUT;
let frames: FrameRequestCallback[] = [];

// Needed: browsers run animation frames after the current task, which is what lets size requests batch up.
function runFrames(): void
{
	for (const cb of frames.splice(0))
	{
		cb(0);
	}
}

beforeEach(() =>
{
	frames = [];
	(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
	{
		frames.push(cb);
		return frames.length;
	};
});

function lastSize(node: any): number[]
{
	return node.setSize.mock.calls.at(-1)[0];
}

describe("node size updates", () =>
{
	it("only grows a node when expandOnly is requested", () =>
	{
		const node = makeNode({in: 1, out: 1}, makeGraph(), {type: "PT_DynamicPassthrough", size: [300, 200]});

		UpdateNodeSize(node, true);
		runFrames();

		expect(lastSize(node)).toEqual([300, 200]);
	});

	it("keeps a manually resized Dynamic Passthrough when a wire is connected", async () =>
	{
		const h = await makeHarness(configureDynamicPassthrough, {name: "PT_DynamicPassthrough"}, {in: 1, out: 1}, {type: "PT_DynamicPassthrough"});
		h.nodeType.prototype.onAdded.call(h.node);
		await flushMicrotasks();
		runFrames();
		h.node.size = [300, 200];

		const origin = {id: 10, outputs: [{type: "IMAGE"}]};
		h.nodes[origin.id] = origin;
		const link = connectInput({node: h.node, graph: h.graph, index: 0, linkId: 1, origin});
		await notifyConnectionChange(h, LG_INPUT, 0, true, link);
		runFrames();

		expect(lastSize(h.node)).toEqual([300, 200]);
	});

	it("keeps a manually resized switch when a wire is connected", async () =>
	{
		const h = await makeHarness(configureSwitchNodes, {name: "PT_AnyImageSwitch", input: {optional: {image_1: ["IMAGE"]}}}, {in: 1, out: 1}, {type: "PT_AnyImageSwitch", size: [300, 200]});

		const origin = {id: 10, outputs: [{type: "IMAGE"}]};
		h.nodes[origin.id] = origin;
		const link = connectInput({node: h.node, graph: h.graph, index: 0, linkId: 1, origin});
		await notifyConnectionChange(h, LG_INPUT, 0, true, link);
		runFrames();

		expect(lastSize(h.node)).toEqual([300, 200]);
	});
});
