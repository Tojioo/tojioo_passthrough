import {Graph, makeLink, makeNode} from './factories';

/** Records every read or write of a slot accessor that frontend 1.58.5 marks deprecated. */
export type DeprecationLog = string[];

function linksOf(graph: Graph): any[]
{
	return Object.values(graph.links);
}

// Needed: mirrors frontend 1.58.5, where input.link and output.links are prototype getters derived from the graph's link store.
function makeInputSlot(node: any, data: any, log: DeprecationLog): any
{
	const proto = {
		get link(): number | null
		{
			log.push("input.link");
			return node.getInputLink(node.inputs.indexOf(this))?.id ?? null;
		},
		set link(value: number | null)
		{
			log.push("set input.link");
			if (value === null)
			{
				node.disconnectInput(node.inputs.indexOf(this));
			}
		},
	};
	const {link: _link, ...rest} = data;
	return Object.assign(Object.create(proto), rest);
}

function makeOutputSlot(node: any, data: any, log: DeprecationLog): any
{
	const proto = {
		get links(): number[] | null
		{
			log.push("output.links");
			const index = node.outputs.indexOf(this);
			const ids = linksOf(node.graph).filter((l) => l.origin_id === node.id && l.origin_slot === index).map((l) => l.id);
			return ids.length ? ids : null;
		},
		set links(_value: number[] | null)
		{
			log.push("set output.links");
		},
	};
	const {links: _links, ...rest} = data;
	return Object.assign(Object.create(proto), rest);
}

export function makeModernNode(io: { in: number; out: number }, graph: Graph, log: DeprecationLog, overrides: Record<string, any> = {}): any
{
	const node = makeNode(io, graph, {graph, ...overrides});
	node.inputs = node.inputs.map((s: any) => makeInputSlot(node, s, log));
	node.outputs = node.outputs.map((s: any) => makeOutputSlot(node, s, log));

	node.addInput = (name: string, type: any) => node.inputs.push(makeInputSlot(node, {name, label: name, type}, log));
	node.addOutput = (name: string, type: any) => node.outputs.push(makeOutputSlot(node, {name, label: name, type}, log));
	node.getInputLink = (index: number) =>
		linksOf(graph).find((l) => l.target_id === node.id && l.target_slot === index) ?? null;
	node.isInputConnected = (index: number) => node.getInputLink(index) != null;
	node.isOutputConnected = (index: number) => linksOf(graph).some((l) => l.origin_id === node.id && l.origin_slot === index);
	node.disconnectInput = (index: number) =>
	{
		const link = node.getInputLink(index);
		if (link)
		{
			delete graph.links[link.id];
		}
	};
	return node;
}

/** Adds a link to the graph's link store only, as LGraphNode.connect does in frontend 1.58.5. */
export function addLink(graph: Graph, id: number, origin: any, originSlot: number, target: any, targetSlot: number): any
{
	const link = makeLink({id, origin_id: origin.id, origin_slot: originSlot, target_id: target.id, target_slot: targetSlot});
	graph.links[id] = link;
	return link;
}
