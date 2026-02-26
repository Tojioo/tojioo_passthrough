import {getLiteGraph} from './compat';

const _displayNameReverseMap = new Map<string, string>();
let _createNodePatched = false;
let _pollingStarted = false;

type SlotMenuEntry = [nodeType: string, displayName: string];

export interface PendingConnection
{
	sourceNode: any;
	sourceSlot: number;
	type: string;
}

let _pendingConnection: PendingConnection | null = null;

export function consumePendingConnection(): PendingConnection | null
{
	const pending = _pendingConnection;
	_pendingConnection = null;
	return pending;
}

export function connectPending(
	node: any,
	pending: PendingConnection | null,
	slotFilter?: (index: number, pendingType: string) => boolean
): void
{
	if (!pending?.sourceNode || !node.inputs?.length)
	{
		return;
	}

	const links = node.graph?.links;
	if (links)
	{
		for (const inp of node.inputs)
		{
			if (inp?.link == null)
			{
				continue;
			}
			const lnk = links[inp.link];
			if (lnk?.origin_id === pending.sourceNode.id && lnk?.origin_slot === pending.sourceSlot)
			{
				return;
			}
		}
	}

	const type = pending.type;
	for (let i = 0; i < node.inputs.length; i++)
	{
		if (slotFilter && !slotFilter(i, type))
		{
			continue;
		}
		if (node.inputs[i]?.link == null)
		{
			pending.sourceNode.connect(pending.sourceSlot, node, i);
			return;
		}
	}
}

function startConnectionPolling(): void
{
	if (_pollingStarted)
	{
		return;
	}
	_pollingStarted = true;

	// Captures connecting_links during drag, before the frontend clears it on mouse up
	function poll(): void
	{
		const canvas = (window as any).app?.canvas;
		const links = canvas?.connecting_links;
		if (links?.length)
		{
			const link = links[0];
			_pendingConnection = {
				sourceNode: link.node,
				sourceSlot: link.slot ?? link.output?.slot_index ?? 0,
				type: link.output?.type ?? link.type ?? "*"
			};
		}
		requestAnimationFrame(poll);
	}

	requestAnimationFrame(poll);
}

export function configureSlotMenu(types: string | string[], entries: SlotMenuEntry | SlotMenuEntry[]): void;
export function configureSlotMenu(types: string | string[], nodeType: string, displayName: string): void;
export function configureSlotMenu(types: string | string[], entriesOrNodeType: SlotMenuEntry | SlotMenuEntry[] | string, displayName?: string): void
{
	const typeList = Array.isArray(types) ? types : [types];

	if (typeof entriesOrNodeType === "string")
	{
		registerSlotEntries(typeList, entriesOrNodeType);
		registerDisplayName(entriesOrNodeType, displayName!);
		return;
	}

	const entryList: SlotMenuEntry[] = Array.isArray(entriesOrNodeType[0])
		? entriesOrNodeType as SlotMenuEntry[]
		: [entriesOrNodeType as SlotMenuEntry];

	for (const [nodeType, name] of entryList)
	{
		registerSlotEntries(typeList, nodeType);
		registerDisplayName(nodeType, name);
	}
}

function registerSlotEntries(types: string[], nodeType: string): void
{
	const lg = getLiteGraph();
	if (!lg)
	{
		return;
	}

	lg.slot_types_default_out ??= {};
	lg.slot_types_default_in ??= {};

	for (const type of types)
	{
		for (const registry of [lg.slot_types_default_out, lg.slot_types_default_in])
		{
			registry[type] ??= [];
			if (!registry[type].includes(nodeType))
			{
				registry[type].push(nodeType);
			}
		}
	}
}

function registerDisplayName(nodeType: string, displayName: string): void
{
	const lg = getLiteGraph();
	if (!lg)
	{
		return;
	}

	_displayNameReverseMap.set(displayName, nodeType);

	for (const registry of [lg.slot_types_default_out, lg.slot_types_default_in])
	{
		if (!registry)
		{
			continue;
		}
		for (const entries of Object.values(registry) as string[][])
		{
			for (let i = 0; i < entries.length; i++)
			{
				if (entries[i] === nodeType)
				{
					entries[i] = displayName;
				}
			}
		}
	}

	if (_createNodePatched)
	{
		return;
	}
	_createNodePatched = true;

	startConnectionPolling();

	const originalCreateNode = lg.createNode;
	if (!originalCreateNode)
	{
		return;
	}

	lg.createNode = function(this: any, type: string, ...args: any[])
	{
		const resolved = _displayNameReverseMap.get(type) ?? type;
		return originalCreateNode.call(this, resolved, ...args);
	};
}