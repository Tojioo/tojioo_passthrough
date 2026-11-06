import {describe, expect, it, vi} from 'vitest';

import {connectPending} from '../src/utils';
import {installTestGlobals, makeGraph, makeNode} from './helpers/factories';

installTestGlobals();

describe("pending connection from a wire dragged out of an input", () =>
{
	it("feeds the dragged input from the new node instead of linking back from it", () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const target = makeNode({in: 1, out: 1}, graph, {id: 10, graph, connect: vi.fn()});
		const node = makeNode({in: 1, out: 1}, graph, {id: 2, graph, connect: vi.fn()});
		nodes[10] = target;
		nodes[2] = node;

		connectPending(node, {sourceNode: target, sourceSlot: 0, type: "*", fromInput: true});

		expect(target.connect).not.toHaveBeenCalled();
		expect(node.connect).toHaveBeenCalledWith(0, target, 0);
	});

	it("does not throw when the drag started on a subgraph input node", () =>
	{
		const nodes: Record<number, any> = {};
		const graph = makeGraph({}, nodes);
		const node = makeNode({in: 1, out: 1}, graph, {id: 2, graph, connect: vi.fn()});
		nodes[2] = node;
		// Assumption: like frontend 1.58.5, a SubgraphInputNode has id -10, no connect() and is not in the graph's node list.
		const subgraphInputNode = {id: -10, outputs: [{type: "IMAGE", links: []}]};

		expect(() => connectPending(node, {sourceNode: subgraphInputNode, sourceSlot: 0, type: "IMAGE", fromInput: false})).not.toThrow();
		expect(node.connect).not.toHaveBeenCalled();
	});
});
