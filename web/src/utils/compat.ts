const LG_NODE_SLOT_HEIGHT = 20;
const LG_OUTPUT = 2;
const LG_INPUT = 1;

export function getLiteGraph(): any | null
{
	if (typeof LiteGraph !== "undefined")
	{
		return LiteGraph;
	}
	if (typeof window !== "undefined" && (window as any).LiteGraph)
	{
		return (window as any).LiteGraph;
	}
	return null;
}

export function GetLgInput(): number
{
	const lg = getLiteGraph();
	return lg?.INPUT ?? LG_INPUT;
}

export function GetLgOutput(): number
{
	const lg = getLiteGraph();
	return lg?.OUTPUT ?? LG_OUTPUT;
}

export function GetLgSlotHeight(): number
{
	const lg = getLiteGraph();
	return lg?.NODE_SLOT_HEIGHT ?? LG_NODE_SLOT_HEIGHT;
}


// Because frontend 1.58.5 turns slot.link and slot.links into deprecated getters, an own data property marks a frontend that still stores them.
function storesLinksOnSlot(slot: any, key: "link" | "links"): boolean
{
	const desc = Object.getOwnPropertyDescriptor(slot, key);
	return desc !== undefined && "value" in desc;
}

function linkValues(links: any): Iterable<any>
{
	return typeof links?.values === "function" ? links.values() : Object.values(links ?? {});
}

export function GetInputLinkId(node: any, index: number): number | null
{
	const slot = node?.inputs?.[index];
	if (!slot)
	{
		return null;
	}
	if (storesLinksOnSlot(slot, "link") || typeof node.isInputConnected !== "function")
	{
		return slot.link ?? null;
	}
	if (!node.graph || !node.isInputConnected(index))
	{
		return null;
	}
	// Because SubgraphNode overrides getInputLink to return an inner link, the id is read from the graph's link store.
	for (const link of linkValues(node.graph.links))
	{
		if (link && link.target_id === node.id && link.target_slot === index)
		{
			return link.id;
		}
	}
	return null;
}

export function GetOutputLinkIds(node: any, index: number): number[]
{
	const slot = node?.outputs?.[index];
	if (!slot)
	{
		return [];
	}
	if (storesLinksOnSlot(slot, "links") || typeof node.isOutputConnected !== "function")
	{
		return slot.links ?? [];
	}

	const ids: number[] = [];
	if (!node.graph || !node.isOutputConnected(index))
	{
		return ids;
	}
	for (const link of linkValues(node.graph.links))
	{
		if (link && link.origin_id === node.id && link.origin_slot === index)
		{
			ids.push(link.id);
		}
	}
	return ids;
}

export function IsInputLinked(node: any, index: number): boolean
{
	return GetInputLinkId(node, index) != null;
}

export function IsOutputLinked(node: any, index: number): boolean
{
	return GetOutputLinkIds(node, index).length > 0;
}

export function ClearInputLink(node: any, index: number): void
{
	const slot = node?.inputs?.[index];
	if (!slot)
	{
		return;
	}
	if (storesLinksOnSlot(slot, "link") || typeof node.disconnectInput !== "function")
	{
		slot.link = null;
		return;
	}
	node.disconnectInput(index);
}
