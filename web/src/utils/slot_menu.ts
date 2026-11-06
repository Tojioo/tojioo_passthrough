import {getLiteGraph, GetInputLinkId, IsInputLinked, IsOutputLinked} from './compat';
import {IsGraphLoading} from './lifecycle';
import {app} from 'scripts/app.js';

const _displayNameReverseMap = new Map<string, string>();
let _createNodePatched = false;
let _pollingStarted = false;
const _slotRegistrations: Array<[types: string[], nodeType: string, displayName: string]> = [];
let _slotDefaultsHooked = false;

type SlotMenuEntry = [nodeType: string, displayName: string];

export interface PendingConnection
{
	sourceNode: any;
	sourceSlot: number;
	type: string;
	fromInput: boolean;
}

let _pendingConnection: PendingConnection | null = null;
let _dragActive = false;
// Invariant: true only while a link-release menu opened by the captured drag is still open.
let _releaseMenuOpen = false;
const _hookedResetEvents = new WeakSet<object>();

export function consumePendingConnection(): PendingConnection | null
{
	const pending = _releaseMenuOpen ? _pendingConnection : null;
	clearPendingConnection();
	if (!pending || IsGraphLoading())
	{
		return null;
	}
	return pending;
}

function clearPendingConnection(): void
{
	_pendingConnection = null;
	_releaseMenuOpen = false;
}

export function connectPending(
	node: any,
	pending: PendingConnection | null,
	slotFilter?: (index: number, pendingType: string) => boolean
): void
{
	const graph = node.graph;
	if (!pending?.sourceNode || !graph || graph.getNodeById?.(pending.sourceNode.id) !== pending.sourceNode)
	{
		return;
	}

	if (pending.fromInput)
	{
		connectPendingToInput(node, pending, slotFilter);
		return;
	}

	if (!node.inputs?.length)
	{
		return;
	}

	const links = graph.links;
	if (links)
	{
		for (let i = 0; i < node.inputs.length; i++)
		{
			const linkId = GetInputLinkId(node, i);
			if (linkId == null)
			{
				continue;
			}
			const lnk = links[linkId];
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
		if (!IsInputLinked(node, i))
		{
			pending.sourceNode.connect(pending.sourceSlot, node, i);
			return;
		}
	}
}

function connectPendingToInput(
	node: any,
	pending: PendingConnection,
	slotFilter?: (index: number, pendingType: string) => boolean
): void
{
	const target = pending.sourceNode;
	const targetInput = target.inputs?.[pending.sourceSlot];
	if (!targetInput || !node.outputs?.length)
	{
		return;
	}

	const targetLinkId = GetInputLinkId(target, pending.sourceSlot);
	const existing = targetLinkId != null ? node.graph.links?.[targetLinkId] : null;
	if (existing && (existing.origin_id !== node.id || !slotFilter || slotFilter(existing.origin_slot, pending.type)))
	{
		return;
	}

	// Because the frontend may already have fed the input from an output the filter rejects (e.g. the bus output),
	// connecting a fitting output here replaces that link.
	for (let i = 0; i < node.outputs.length; i++)
	{
		if (slotFilter && !slotFilter(i, pending.type))
		{
			continue;
		}
		if (!IsOutputLinked(node, i))
		{
			node.connect(i, target, pending.sourceSlot);
			return;
		}
	}
}

function readDragSource(link: any): PendingConnection
{
	const fromInput = link.input != null && link.output == null;
	const slot = fromInput ? link.input : link.output;
	return {
		sourceNode: link.node,
		sourceSlot: link.slot ?? slot?.slot_index ?? 0,
		type: slot?.type ?? link.type ?? "*",
		fromInput
	};
}

// Because frontends with a LinkConnector cancel exactly one 'reset' when they hold a drop on the canvas open for their
// search box or context menu, and send an uncancelled one when that menu closes or the drag ends any other way.
function hookLinkConnectorReset(events: any): void
{
	if (_hookedResetEvents.has(events))
	{
		return;
	}
	_hookedResetEvents.add(events);

	events.addEventListener("reset", (e: Event) =>
	{
		// Needed: the frontend's own listener that cancels the reset may run after this one.
		queueMicrotask(() =>
		{
			if (e.defaultPrevented && _pendingConnection)
			{
				_releaseMenuOpen = true;
			}
			else if (!e.defaultPrevented)
			{
				clearPendingConnection();
			}
		});
	});
}

// Assumption: frontends without LinkConnector events open their litegraph menu synchronously on mouse up.
function isLegacyReleaseMenuOpen(): boolean
{
	return !!(globalThis as any).document?.querySelector?.(".litecontextmenu, .litesearchbox");
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
		const events = canvas?.linkConnector?.events;
		if (events)
		{
			hookLinkConnectorReset(events);
		}

		const links = canvas?.connecting_links;
		if (links?.length)
		{
			if (!_dragActive)
			{
				_dragActive = true;
				_releaseMenuOpen = false;
				_pendingConnection = readDragSource(links[0]);
			}
		}
		else if (_dragActive)
		{
			_dragActive = false;
			if (!events)
			{
				_releaseMenuOpen = isLegacyReleaseMenuOpen();
				if (!_releaseMenuOpen)
				{
					clearPendingConnection();
				}
			}
		}
		else if (!events && _releaseMenuOpen && !isLegacyReleaseMenuOpen())
		{
			clearPendingConnection();
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
		addSlotRegistration(typeList, entriesOrNodeType, displayName!);
		return;
	}

	const entryList: SlotMenuEntry[] = Array.isArray(entriesOrNodeType[0])
		? entriesOrNodeType as SlotMenuEntry[]
		: [entriesOrNodeType as SlotMenuEntry];

	for (const [nodeType, name] of entryList)
	{
		addSlotRegistration(typeList, nodeType, name);
	}
}

function addSlotRegistration(types: string[], nodeType: string, displayName: string): void
{
	_slotRegistrations.push([types, nodeType, displayName]);
	hookCoreSlotDefaults();
	registerSlotEntries(types, nodeType);
	registerDisplayName(nodeType, displayName);
}

// Because core Comfy.SlotDefaults replaces both registries whenever it rebuilds them, the pack's entries are added back afterwards.
function hookCoreSlotDefaults(): void
{
	if (_slotDefaultsHooked)
	{
		return;
	}
	const core = (app as any)?.extensions?.find?.((ext: any) => ext?.name === "Comfy.SlotDefaults");
	const original = core?.setDefaults;
	if (typeof original !== "function")
	{
		return;
	}
	_slotDefaultsHooked = true;

	core.setDefaults = function(this: any, ...args: any[])
	{
		const result = original.apply(this, args);
		for (const [types, nodeType, displayName] of _slotRegistrations)
		{
			registerSlotEntries(types, nodeType);
			registerDisplayName(nodeType, displayName);
		}
		return result;
	};
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