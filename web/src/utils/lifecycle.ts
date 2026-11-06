import {GetGraph, GetLinkTypeFromEndpoints, SetLinkType, ANY_TYPE} from '../utils';
import {ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {GetInputLinkId, GetOutputLinkIds, IsInputLinked} from './compat';

let _graphLoadDepth = 0;
let _afterLoadCallbacks: Array<() => void> = [];
let _pendingCanvasUpdate: number | null = null;
let _pendingSizeUpdates = new Map<any, boolean>();
let _sizeUpdateTimer: number | null = null;

export function InstallGraphLoadingHook(app: any): void
{
	const original = app?.loadGraphData;
	if (typeof original !== "function")
	{
		return;
	}
	if ((original as any).__tojioo_wrapped)
	{
		return;
	}

	const wrapped = async function(this: any, ...args: any[])
	{
		_graphLoadDepth++;
		try
		{
			return await original.apply(this, args);
		}
		finally
		{
			_graphLoadDepth--;
			if (_graphLoadDepth === 0)
			{
				runAfterLoadCallbacks();
			}
		}
	};

	(wrapped as any).__tojioo_wrapped = true;
	app.loadGraphData = wrapped;
}

export function IsGraphLoading(): boolean
{
	return _graphLoadDepth > 0;
}

export function AfterGraphLoaded(fn: () => void): void
{
	// Assumption: outside a load (paste, subgraph conversion) links are wired synchronously, so the caller's microtask resync already sees them.
	if (IsGraphLoading())
	{
		_afterLoadCallbacks.push(fn);
	}
}

function runAfterLoadCallbacks(): void
{
	const callbacks = _afterLoadCallbacks;
	_afterLoadCallbacks = [];
	for (const fn of callbacks)
	{
		try
		{
			fn();
		}
		catch
		{
		}
	}
}

export function DeferMicrotask(fn: () => void): void
{
	if (typeof queueMicrotask === "function")
	{
		queueMicrotask(fn);
		return;
	}
	Promise.resolve().then(fn);
}

export function DeriveDynamicPrefixFromNodeData(nodeData: ComfyNodeDef): string | null
{
	const opt = nodeData?.input?.optional;
	if (!opt)
	{
		return null;
	}
	const keys = Object.keys(opt);
	if (keys.length === 0)
	{
		return null;
	}

	const suffixNumberOrInfinity = (s: string) =>
	{
		const m = String(s).match(/(\d+)$/);
		return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
	};

	keys.sort((a, b) => suffixNumberOrInfinity(a) - suffixNumberOrInfinity(b));
	const baseName = keys[0];
	return baseName.replace(/_\d+$/, "").replace(/\d+$/, "");
}

export function DeriveSwitchTypeFromNodeData(nodeData: ComfyNodeDef): string
{
	const declared = nodeData?.output?.[0];
	return typeof declared === "string" && declared !== "" ? declared : ANY_TYPE;
}

export function ResolveInputType(node: any, inputIndex: number): string
{
	const inp = node.inputs?.[inputIndex];
	if (!inp)
	{
		return ANY_TYPE;
	}

	const linkId = GetInputLinkId(node, inputIndex);
	if (linkId == null)
	{
		return ANY_TYPE;
	}

	const g = GetGraph(node);
	const link = g?.links?.[linkId];
	if (!link)
	{
		return ANY_TYPE;
	}

	const inferredType = GetLinkTypeFromEndpoints(node, link);
	if (inferredType && inferredType !== ANY_TYPE)
	{
		return inferredType;
	}

	const sourceNode = g?.getNodeById?.(link.origin_id);
	const sourceSlot = sourceNode?.outputs?.[link.origin_slot];
	if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE && sourceSlot.type !== -1)
	{
		return sourceSlot.type as string;
	}

	return ANY_TYPE;
}

export function ScheduleCanvasUpdate(node: any): void
{
	if (_pendingCanvasUpdate !== null)
	{
		return;
	}

	_pendingCanvasUpdate = requestAnimationFrame(() =>
	{
		_pendingCanvasUpdate = null;
		const g = GetGraph(node);
		g?.setDirtyCanvas?.(true, true);
	});
}

export function ScheduleSizeUpdate(node: any, expandOnly?: boolean): void
{
	// Because several callers may resize one node in the same frame, a single request to keep its size wins.
	_pendingSizeUpdates.set(node, (_pendingSizeUpdates.get(node) ?? false) || expandOnly === true);

	if (_sizeUpdateTimer !== null)
	{
		return;
	}

	_sizeUpdateTimer = requestAnimationFrame(() =>
	{
		_sizeUpdateTimer = null;
		const nodes = Array.from(_pendingSizeUpdates);
		_pendingSizeUpdates.clear();

		for (const [n, expandOnly] of nodes)
		{
			UpdateNodeSizeImmediate(n, expandOnly || undefined);
		}
	});
}

export function UpdateNodeSizeImmediate(node: any, expandOnly?: boolean): void
{
	try
	{
		if (typeof node.computeSize !== "function" || typeof node.setSize !== "function")
		{
			return;
		}

		const isPreview = node.type === "PT_DynamicPreview";
		const useExpandOnly = expandOnly !== undefined ? expandOnly : isPreview;

		const size = node.computeSize();
		if (useExpandOnly && node.size)
		{
			size[0] = Math.max(size[0], node.size[0]);
			size[1] = Math.max(size[1], node.size[1]);
		}
		node.setSize(size);
	}
	catch
	{
	}
}

export function ApplySwitchDynamicTypes(node: any, inputPrefix: string | null, declaredType: string = ANY_TYPE): void
{
	if (!node.inputs || node.inputs.length === 0)
	{
		return;
	}

	let resolvedType: string = ANY_TYPE;
	const inputTypes: string[] = [];

	for (let i = 0; i < node.inputs.length; i++)
	{
		const t = ResolveInputType(node, i);
		inputTypes.push(t);
		if (t && t !== ANY_TYPE && resolvedType === ANY_TYPE)
		{
			resolvedType = t;
		}
	}

	for (let i = 0; i < node.inputs.length; i++)
	{
		const inp = node.inputs[i];
		const currentType = inputTypes[i];
		const effectiveType = (currentType !== ANY_TYPE) ? currentType : resolvedType;

		inp.type = effectiveType !== ANY_TYPE ? effectiveType : declaredType;

		const label = (effectiveType !== ANY_TYPE)
			? (i === 0 ? effectiveType.toLowerCase() : `${effectiveType.toLowerCase()}_${i + 1}`)
			: (i === 0 ? `${inputPrefix}` : `${inputPrefix}_${i + 1}`);

		inp.name = `input_${i + 1}`;
		inp.label = label;

		const linkId = GetInputLinkId(node, i);
		if (linkId != null && effectiveType !== ANY_TYPE)
		{
			SetLinkType(node, linkId, effectiveType);
		}
	}

	if (node.outputs && node.outputs.length > 0)
	{
		for (let i = 0; i < node.outputs.length; i++)
		{
			const out = node.outputs[i];
			out.type = resolvedType !== ANY_TYPE ? resolvedType : declaredType;

			if (resolvedType !== ANY_TYPE)
			{
				out.name = "output_1";
				out.label = resolvedType.toLowerCase();
			}

			const outLinks = GetOutputLinkIds(node, i);
			for (const linkId of outLinks)
			{
				if (linkId != null && resolvedType !== ANY_TYPE)
				{
					SetLinkType(node, linkId, resolvedType);
				}
			}
		}
	}

	ScheduleCanvasUpdate(node);
	ScheduleSizeUpdate(node, true);
}

export function UpdateNodeSize(node: any, expandOnly?: boolean, force?: boolean): void
{
	if (!force && IsGraphLoading())
	{
		return;
	}
	ScheduleSizeUpdate(node, expandOnly);
}

export function UpdatePreviewNodeSize(node: any): void
{
	if (IsGraphLoading() || (node as any).__tojioo_skip_resize)
	{
		return;
	}
	ScheduleSizeUpdate(node);
}

export function NormalizeInputs(node: any): void
{
	if (!node.inputs)
	{
		return;
	}

	let lastConnectedIndex = -1;
	for (let i = node.inputs.length - 1; i >= 0; i--)
	{
		if (IsInputLinked(node, i))
		{
			lastConnectedIndex = i;
			break;
		}
	}

	const keepCount = Math.max(1, lastConnectedIndex + 2);
	while (node.inputs.length > keepCount)
	{
		if (typeof node.removeInput === "function")
		{
			node.removeInput(node.inputs.length - 1);
		}
		else
		{
			break;
		}
	}

	ScheduleSizeUpdate(node, true);
}