import {flushMicrotasks, makeGraph, makeNode} from './factories';

export type Harness = {
	nodeType: any;
	node: any;
	graph: ReturnType<typeof makeGraph>;
	nodes: Record<number, any>;
};

export async function makeHarness(configure: () => any, nodeData: any, io: { in: number; out: number }, overrides: Record<string, any> = {}): Promise<Harness>
{
	const nodes: Record<number, any> = {};
	const graph = makeGraph({}, nodes);
	const node = makeNode(io, graph, {id: 2, graph, ...overrides});
	nodes[node.id] = node;

	const nodeType: any = function FakeNodeType()
	{
	};
	await configure().beforeRegisterNodeDef(nodeType, nodeData, {} as any);
	return {nodeType, node, graph, nodes};
}

export async function notifyConnectionChange(h: Harness, slotKind: number, index: number, isConnected: boolean, link: any): Promise<void>
{
	h.nodeType.prototype.onConnectionsChange.call(h.node, slotKind, index, isConnected, link, null);
	await flushMicrotasks();
}
