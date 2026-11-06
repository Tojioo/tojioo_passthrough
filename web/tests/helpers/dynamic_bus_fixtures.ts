import {readFileSync} from 'fs';
import {resolve} from 'path';
import {vi} from 'vitest';

import {configureDynamicBus} from '../../src/handlers';
import {Graph, HandlerContext, Link, makeGraph, makeNode} from './factories';

export const SUBGRAPH_INPUT_ID = -10;
export const SUBGRAPH_OUTPUT_ID = -20;

const EXAMPLE_WORKFLOW = resolve(__dirname, '../../../example_workflows/Tojioo Passthrough.json');

export async function registerDynamicBus(): Promise<any>
{
	const nodeType: any = function FakeNodeType()
	{
	};
	await configureDynamicBus().beforeRegisterNodeDef!(nodeType, {name: "PT_DynamicBus"} as any, {} as any);
	return nodeType;
}

export async function makeBusContext(io: { in: number; out: number } = {in: 1, out: 1}): Promise<HandlerContext>
{
	const nodes: Record<number, any> = {};
	const graph = makeGraph({}, nodes);
	const node = makeNode(io, graph, {id: 2, type: "PT_DynamicBus"});
	nodes[node.id] = node;
	const nodeType = await registerDynamicBus();
	Object.setPrototypeOf(node, nodeType.prototype);
	return {nodeType, node, graph, nodes};
}

/** Builds a bus node whose slots mirror a serialized node, like LGraphNode.configure does before the handler's configure runs. */
export function makeBusFromSerialized(nodeType: any, graph: Graph, info: any): any
{
	const node = makeNode({in: 0, out: 0}, graph, {id: info.id, type: "PT_DynamicBus"});
	node.inputs = structuredClone(info.inputs);
	node.outputs = structuredClone(info.outputs);
	node.properties = structuredClone(info.properties ?? {});
	Object.setPrototypeOf(node, nodeType.prototype);
	return node;
}

export type LoadedSubgraph = {
	graph: Graph;
	nodes: Record<string, any>;
	busInfos: any[];
};

/** Loads one subgraph of the example workflow as a flat graph; node ids become strings like in frontend 1.58.5. */
export function loadExampleSubgraph(name: string): LoadedSubgraph
{
	const workflow = JSON.parse(readFileSync(EXAMPLE_WORKFLOW, 'utf-8'));
	const subgraph = workflow.definitions.subgraphs.find((sg: any) => sg.name === name);
	if (!subgraph)
	{
		throw new Error(`Subgraph ${name} not found in example workflow`);
	}

	const links: Record<number, Link> = {};
	for (const raw of subgraph.links)
	{
		links[raw.id] = {
			id: raw.id,
			origin_id: String(raw.origin_id) as any,
			origin_slot: raw.origin_slot,
			target_id: String(raw.target_id) as any,
			target_slot: raw.target_slot,
			type: raw.type,
		};
	}

	const nodes: Record<string, any> = {};
	const graph = makeGraph(links, nodes);
	const busInfos: any[] = [];
	for (const info of subgraph.nodes)
	{
		const normalized = {...info, id: String(info.id)};
		if (info.type === "PT_DynamicBus")
		{
			busInfos.push(normalized);
			continue;
		}
		nodes[normalized.id] = {
			id: normalized.id,
			type: info.type,
			inputs: structuredClone(info.inputs ?? []),
			outputs: structuredClone(info.outputs ?? []),
		};
	}

	return {graph, nodes, busInfos};
}

/** Runs configure plus its deferred microtask and the 100 ms resync. */
export async function configureAndSettle(node: any, info: any): Promise<void>
{
	vi.useFakeTimers({toFake: ["setTimeout"]});
	try
	{
		node.configure(info);
		await Promise.resolve();
		await Promise.resolve();
		vi.advanceTimersByTime(150);
		await Promise.resolve();
	}
	finally
	{
		vi.useRealTimers();
	}
}
