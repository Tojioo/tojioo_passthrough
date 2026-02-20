import {describe, expect, it} from 'vitest';

import {ApplyDynamicTypes, AssignTypeAndName, ProcessTypeNames, ResolveConnectedType, ResolvePairType, UpdateLinkTypesForSlot,} from '../src/utils';
import {connectInput, connectOutput, installTestGlobals, makeGraph, makeNode,} from './helpers/factories';

installTestGlobals();

describe("types utilities", () =>
{
	it("ResolvePairType returns * when no links", () =>
	{
		const graph = makeGraph({}, {});
		const node: any = makeNode({in: 1, out: 1}, graph);
		expect(ResolvePairType(node, 0)).toBe("*");
	});

	it("ResolvePairType can resolve from output target slot or link type", () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const node: any = makeNode({in: 1, out: 1}, graph, {id: 1});
		nodes[node.id] = node;

		const target: any = {id: 2, inputs: [{type: "AUDIO"}]};
		nodes[target.id] = target;
		const link = connectOutput({node, graph, index: 0, linkId: 5, target});
		expect(ResolvePairType(node, 0)).toBe("AUDIO");

		target.inputs[0].type = "*";
		graph.links[5].type = "IMAGE";
		expect(ResolvePairType(node, 0)).toBe("IMAGE");
		expect(link.type).toBe("IMAGE");
	});

	it("ResolvePairType can resolve from input link origin", () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const node: any = makeNode({in: 1, out: 1}, graph, {id: 1});
		nodes[node.id] = node;

		const origin: any = {id: 2, outputs: [{type: "TEXT"}]};
		nodes[origin.id] = origin;
		connectInput({node, graph, index: 0, linkId: 6, origin});
		expect(ResolvePairType(node, 0)).toBe("TEXT");
	});

	it("UpdateLinkTypesForSlot sets type on input link and output links", () =>
	{
		const other: any = {id: 2};
		const node: any = {id: 1, inputs: [{link: 7}], outputs: [{links: [8, 9]}], rootGraph: null};
		const linkIn = {id: 7, origin_id: 2, origin_slot: 0, target_id: 1, target_slot: 0};
		const linkOut1 = {id: 8, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0};
		const linkOut2 = {id: 9, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 1};
		const g = makeGraph({7: linkIn, 8: linkOut1, 9: linkOut2}, {1: node, 2: other});
		node.rootGraph = g;

		UpdateLinkTypesForSlot(node, 0, "IMAGE");
		expect(g.links[7].type).toBe("IMAGE");
		expect(g.links[8].type).toBe("IMAGE");
		expect(g.links[9].type).toBe("IMAGE");
	});

	it("ResolveConnectedType prioritizes link endpoint types, then slot types", () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const node: any = {id: 3, inputs: [{link: 20, type: "*"}], outputs: [{links: [21], type: "*"}], rootGraph: graph};
		nodes[node.id] = node;

		const origin: any = {id: 1, outputs: [{type: "TEXT"}]};
		const target: any = {id: 2, inputs: [{type: "IMAGE"}]};
		nodes[origin.id] = origin;
		nodes[target.id] = target;
		graph.links[20] = {id: 20, origin_id: 1, origin_slot: 0, target_id: 3, target_slot: 0};
		graph.links[21] = {id: 21, origin_id: 3, origin_slot: 0, target_id: 2, target_slot: 0};

		const t = ResolveConnectedType(node, node.inputs[0], node.outputs[0]);
		expect(t).toBe("TEXT");

		origin.outputs[0].type = "*";
		const t2 = ResolveConnectedType(node, node.inputs[0], node.outputs[0]);
		expect(t2).toBe("IMAGE");
	});

	it("ProcessTypeNames builds labels with counters for repeated and untyped types", () =>
	{
		const types = ["TEXT", "*", "TEXT", "IMAGE", "*"];
		const inputNames: string[] = [];
		const outputNames: string[] = [];
		const counters: Record<string, number> = {};

		for (let i = 0; i < types.length; i++)
		{
			ProcessTypeNames(types, i, counters, inputNames, outputNames);
		}

		expect(inputNames).toEqual(["text", "input", "text_2", "image", "input_2"]);
		expect(outputNames).toEqual(["text", "output", "text_2", "image", "output_2"]);
	});

	it("AssignTypeAndName applies types, names, and bus slot naming", () =>
	{
		const nodeBus: any = {type: "PT_DynamicBus", inputs: [{}, {}], outputs: [{}, {}]};
		const nodeOther: any = {type: "PT_DynamicAny", inputs: [{}, {}], outputs: [{}, {}]};
		const types = ["TEXT", "IMAGE"];
		const inputNames = ["text", "image"];
		const outputNames = ["text", "image"];

		const t0 = AssignTypeAndName(types, 0, nodeBus, inputNames, outputNames);
		expect(nodeBus.inputs[0]).toMatchObject({type: "TEXT", name: "bus", label: "text"});
		expect(nodeBus.outputs[0]).toMatchObject({type: "TEXT", name: "bus", label: "text"});
		expect(t0).toBe("TEXT");

		const t1 = AssignTypeAndName(types, 1, nodeOther, inputNames, outputNames);
		expect(nodeOther.inputs[1]).toMatchObject({type: "IMAGE", name: "input_2", label: "image"});
		expect(nodeOther.outputs[1]).toMatchObject({type: "IMAGE", name: "output_2", label: "image"});
		expect(t1).toBe("IMAGE");
	});

	it("ApplyDynamicTypes resolves per-pair types, updates link types, and resizes", () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);

		const node: any = makeNode({in: 3, out: 3}, graph, {id: 100, type: "PT_DynamicPreview"});
		nodes[node.id] = node;

		const producerText: any = {id: 1, outputs: [{type: "TEXT"}]};
		const consumerImage: any = {id: 2, inputs: [{type: "IMAGE"}]};
		nodes[producerText.id] = producerText;
		nodes[consumerImage.id] = consumerImage;

		connectInput({node, graph, index: 0, linkId: 30, origin: producerText});
		connectOutput({node, graph, index: 2, linkId: 31, target: consumerImage});

		ApplyDynamicTypes(node);

		expect(node.inputs[0].type).toBe("TEXT");
		expect(node.outputs[0].type).toBe("TEXT");
		expect(node.inputs[1].type).toBe("*");
		expect(node.outputs[1].type).toBe("*");
		expect(node.inputs[2].type).toBe("IMAGE");
		expect(node.outputs[2].type).toBe("IMAGE");
		expect(graph.links[31].type).toBe("IMAGE");
		expect(graph.setDirtyCanvas).toHaveBeenCalledWith(true, true);
		expect(node.setSize).toHaveBeenCalled();
	});
});