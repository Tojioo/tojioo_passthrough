import {describe, expect, it} from 'vitest';

import {configureBatchSwitchNodes, configureSwitchNodes} from '../src/handlers';
import {connectInput, disconnectInput, installTestGlobals} from './helpers/factories';
import {makeHarness, notifyConnectionChange} from './helpers/handler_harness';

installTestGlobals();

const LG_INPUT = (globalThis as any).LiteGraph.INPUT;

describe.each([
	["switch", configureSwitchNodes, "PT_AnyImageSwitch"],
	["batch switch", configureBatchSwitchNodes, "PT_AnyImageBatchSwitch"],
])("typed %s slots", (_label, configure, name) =>
{
	const nodeData = {name, input: {required: {}, optional: {image_1: ["IMAGE"]}}, output: ["IMAGE"]};

	it("keep the declared type while nothing is connected", async () =>
	{
		const h = await makeHarness(configure, nodeData, {in: 1, out: 1});
		h.node.inputs[0].type = "IMAGE";
		h.node.outputs[0].type = "IMAGE";

		h.nodeType.prototype.onAdded.call(h.node);

		expect(h.node.inputs[0].type).toBe("IMAGE");
		expect(h.node.outputs[0].type).toBe("IMAGE");
	});

	it("return to the declared type after the last wire is removed", async () =>
	{
		const h = await makeHarness(configure, nodeData, {in: 1, out: 1});
		const origin = {id: 10, outputs: [{type: "*"}]};
		h.nodes[origin.id] = origin;
		const link = connectInput({node: h.node, graph: h.graph, index: 0, linkId: 1, origin});
		await notifyConnectionChange(h, LG_INPUT, 0, true, link);

		expect(h.node.inputs.map((i: any) => i.type)).toEqual(["IMAGE", "IMAGE"]);
		expect(h.node.outputs[0].type).toBe("IMAGE");

		disconnectInput(h.node, 0);
		await notifyConnectionChange(h, LG_INPUT, 0, false, link);

		expect(h.node.inputs.map((i: any) => i.type)).toEqual(["IMAGE"]);
		expect(h.node.outputs[0].type).toBe("IMAGE");
	});
});
