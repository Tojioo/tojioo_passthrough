import {describe, expect, it} from 'vitest';

import {configureDynamicPassthrough} from '../src/handlers';
import {connectInput, connectOutput, disconnectInput, disconnectOutput, installTestGlobals} from './helpers/factories';
import {makeHarness, notifyConnectionChange} from './helpers/handler_harness';

installTestGlobals();

const LG_INPUT = (globalThis as any).LiteGraph.INPUT;
const LG_OUTPUT = (globalThis as any).LiteGraph.OUTPUT;

async function makePassthroughWithThreeSlots()
{
	const h = await makeHarness(configureDynamicPassthrough, {name: "PT_DynamicPassthrough"}, {in: 3, out: 3});
	const a = {id: 10, outputs: [{type: "IMAGE"}]};
	const b = {id: 11, inputs: [{type: "IMAGE"}, {type: "IMAGE"}]};
	const c = {id: 12, outputs: [{type: "MASK"}]};
	h.nodes[a.id] = a;
	h.nodes[b.id] = b;
	h.nodes[c.id] = c;
	connectInput({node: h.node, graph: h.graph, index: 1, linkId: 3, origin: c});
	return {h, a, b};
}

describe("dynamic passthrough slot removal", () =>
{
	it("keeps a slot whose output is still linked when its input is disconnected", async () =>
	{
		const {h, a, b} = await makePassthroughWithThreeSlots();
		const inLink = connectInput({node: h.node, graph: h.graph, index: 0, linkId: 1, origin: a});
		connectOutput({node: h.node, graph: h.graph, index: 0, linkId: 2, target: b});

		disconnectInput(h.node, 0);
		await notifyConnectionChange(h, LG_INPUT, 0, false, inLink);

		expect(h.node.outputs[0].links).toEqual([2]);
		expect(h.node.inputs[1].link).toBe(3);
	});

	it("keeps an output-only slot that still has a link after losing another one", async () =>
	{
		const {h, b} = await makePassthroughWithThreeSlots();
		const first = connectOutput({node: h.node, graph: h.graph, index: 0, linkId: 4, target: b});
		connectOutput({node: h.node, graph: h.graph, index: 0, linkId: 5, target: b, targetSlot: 1});

		disconnectOutput(h.node, 0, 4);
		await notifyConnectionChange(h, LG_OUTPUT, 0, false, first);

		expect(h.node.outputs[0].links).toEqual([5]);
		expect(h.node.inputs[1].link).toBe(3);
	});
});
