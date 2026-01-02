
const ANY_TYPE = "*";

export function GetGraph(node: any): LGraph | null
{
	return (node.rootGraph ?? node.graph) || (window as any).app?.graph;
}

export function GetLink(node: any, linkId: number | null): LLink | null
{
	if (linkId == null)
	{
		return null;
	}
	const g = GetGraph(node);
	if (!g || !g.links)
	{
		return null;
	}
	return g.links[linkId] ?? null;
}

export function GetInputLink(node: any, slotIndex: number): LLink | null
{
	if (!node.inputs || !node.inputs[slotIndex])
	{
		return null;
	}
	return GetLink(node, node.inputs[slotIndex].link);
}

export function GetOutputLinks(node: any, slotIndex: number): LLink[]
{
	if (!node.outputs || !node.outputs[slotIndex])
	{
		return [];
	}
	const linkIds = node.outputs[slotIndex].links || [];
	const links: LLink[] = [];
	for (const id of linkIds)
	{
		const link = GetLink(node, id);
		if (link)
		{
			links.push(link);
		}
	}
	return links;
}

export function GetNodeById(node: any, id: string | number): any | null
{
	const g = GetGraph(node);
	return g?.getNodeById?.(id as number) ?? null;
}

export function SetLinkType(node: any, linkId: number, type: string): void
{
	const g = GetGraph(node);
	const link = g?.links?.[linkId];
	if (!link)
	{
		return;
	}
	link.type = type;
}

export function GetLinkTypeFromEndpoints(node: any, link: any): string
{
	if (!link)
	{
		return ANY_TYPE;
	}

	const origin = GetNodeById(node, link.origin_id);
	const oSlot = origin?.outputs?.[link.origin_slot];
	if (oSlot?.type && oSlot.type !== ANY_TYPE && oSlot.type !== -1)
	{
		return oSlot.type as string;
	}

	const target = GetNodeById(node, link.target_id);
	const tSlot = target?.inputs?.[link.target_slot];
	if (tSlot?.type && tSlot.type !== ANY_TYPE && tSlot.type !== -1)
	{
		return tSlot.type as string;
	}

	const linkType = link.type;
	if (linkType && linkType !== ANY_TYPE && linkType !== -1)
	{
		return linkType as string;
	}

	return ANY_TYPE;
}