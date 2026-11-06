import {describe, expect, it} from 'vitest';

import {installTestGlobals, makeGraph, makeLink} from './helpers/factories';
import {configureAndSettle, makeBusFromSerialized, registerDynamicBus} from './helpers/dynamic_bus_fixtures';

installTestGlobals();

function serializedBus(inputs: Array<[string, number | null]>, outputs: Array<[string, number[] | null]>): any
{
	return {
		id: 2,
		inputs: [{name: "bus", label: "bus", type: "BUS", link: null}, ...inputs.map(([type, link], i) => ({name: `input_${i + 1}`, label: "input", type, link}))],
		outputs: [{name: "bus", label: "bus", type: "BUS", links: null}, ...outputs.map(([type, links], i) => ({name: `output_${i + 1}`, label: "output", type, links}))],
		properties: {},
	};
}

function slotTypes(node: any): string[]
{
	return [...node.inputs.map((s: any) => s.type), ...node.outputs.map((s: any) => s.type)];
}

describe("dynamic_bus load with a stale typed slot", () =>
{
	it("keeps a connected input and drops the stale type", async () =>
	{
		const nodes: Record<number, any> = {60: {id: 60, outputs: [{type: "IMAGE", links: [50]}]}};
		const graph = makeGraph({50: makeLink({id: 50, origin_id: 60, target_id: 2, target_slot: 1, type: "IMAGE"})}, nodes);
		const info = serializedBus([["IMAGE", 50], ["MASK", null], ["*", null]], [["IMAGE", []], ["MASK", null], ["*", null]]);
		const node = makeBusFromSerialized(await registerDynamicBus(), graph, info);
		nodes[2] = node;

		await configureAndSettle(node, info);

		expect(node.inputs[1].link).toBe(50);
		expect(node.inputs[1].type).toBe("IMAGE");
		expect(slotTypes(node)).not.toContain("MASK");
		expect(node.widgets.find((w: any) => w.name === "_slot_types")?.value).toBe("1:IMAGE");
	});

	it("keeps an output-only connection and drops the stale type", async () =>
	{
		const nodes: Record<number, any> = {61: {id: 61, inputs: [{type: "MASK", link: 51}]}};
		const graph = makeGraph({51: makeLink({id: 51, origin_id: 2, origin_slot: 1, target_id: 61, target_slot: 0, type: "MASK"})}, nodes);
		const info = serializedBus([["MASK", null], ["IMAGE", null], ["*", null]], [["MASK", [51]], ["IMAGE", null], ["*", null]]);
		const node = makeBusFromSerialized(await registerDynamicBus(), graph, info);
		nodes[2] = node;

		await configureAndSettle(node, info);

		expect(node.outputs[1].links).toEqual([51]);
		expect(node.outputs[1].type).toBe("MASK");
		expect(slotTypes(node)).not.toContain("IMAGE");
		expect(node.widgets.find((w: any) => w.name === "_output_hints")?.value).toBe("1:MASK:0");
	});

	it("keeps a fully unconnected node clean after the delayed resync", async () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const info = serializedBus([["IMAGE", null], ["MASK", null], ["*", null]], [["IMAGE", null], ["MASK", null], ["*", null]]);
		const node = makeBusFromSerialized(await registerDynamicBus(), graph, info);
		nodes[2] = node;

		await configureAndSettle(node, info);

		expect(node.inputs.length).toBe(2);
		expect(slotTypes(node)).toEqual(["BUS", "*", "BUS", "*"]);
	});
});
