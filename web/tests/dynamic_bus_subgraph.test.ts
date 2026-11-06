import {describe, expect, it} from 'vitest';

import {connectInput, flushMicrotasks, installTestGlobals} from './helpers/factories';
import {configureAndSettle, loadExampleSubgraph, makeBusContext, makeBusFromSerialized, registerDynamicBus, SUBGRAPH_INPUT_ID} from './helpers/dynamic_bus_fixtures';

installTestGlobals();

const LG_INPUT = (globalThis as any).LiteGraph.INPUT;

describe("dynamic_bus inside subgraphs", () =>
{
	it.each([
		["Upscaler Pass", "85", 208],
		["KSampler", "78", 194],
	])("keeps the bus input from the subgraph input node when loading %s", async (subgraphName, busId, linkId) =>
	{
		const {graph, nodes, busInfos} = loadExampleSubgraph(subgraphName);
		const info = busInfos.find((i) => i.id === busId);
		const nodeType = await registerDynamicBus();
		const node = makeBusFromSerialized(nodeType, graph, info);
		nodes[node.id] = node;

		await configureAndSettle(node, info);

		expect(node.inputs[0].link).toBe(linkId);
	});

	it("keeps a data input from the subgraph input node on resync", async () =>
	{
		const ctx = await makeBusContext({in: 2, out: 2});
		const subgraphInput = {id: SUBGRAPH_INPUT_ID, outputs: [{type: "IMAGE"}]};
		const link = connectInput({node: ctx.node, graph: ctx.graph, index: 1, linkId: 300, origin: subgraphInput, type: "IMAGE"});

		ctx.nodeType.prototype.onConnectionsChange.call(ctx.node, LG_INPUT, 1, true, link, null);
		await flushMicrotasks();

		expect(ctx.node.inputs[1].link).toBe(300);
		expect(ctx.node.widgets.find((w: any) => w.name === "_slot_types")?.value).toBe("1:*");
	});
});
