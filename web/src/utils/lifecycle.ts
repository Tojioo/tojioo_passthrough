import {ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {GetGraph, GetLinkTypeFromEndpoints, SetLinkType} from './graph';
import {getLgInput} from './compat';

const ANY_TYPE: string = "*";

let _graphLoading = false;
let _pendingCanvasUpdate: number | null = null;
let _pendingSizeUpdates = new Set<any>();
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
		_graphLoading = true;
		try
		{
			return await original.apply(this, args);
		}
		finally
		{
			_graphLoading = false;
		}
	};

	(wrapped as any).__tojioo_wrapped = true;
	app.loadGraphData = wrapped;
}

export function IsGraphLoading(): boolean
{
	return _graphLoading;
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

export function deriveDynamicPrefixFromNodeData(nodeData: ComfyNodeDef): string | null
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

export function resolveInputType(node: any, inputIndex: number): string
{
	const inp = node.inputs?.[inputIndex];
	if (!inp)
	{
		return ANY_TYPE;
	}

	const linkId = inp.link;
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

export function ScheduleSizeUpdate(node: any): void
{
	_pendingSizeUpdates.add(node);

	if (_sizeUpdateTimer !== null)
	{
		return;
	}

	_sizeUpdateTimer = requestAnimationFrame(() =>
	{
		_sizeUpdateTimer = null;
		const nodes = Array.from(_pendingSizeUpdates);
		_pendingSizeUpdates.clear();

		for (const n of nodes)
		{
			UpdateNodeSizeImmediate(n);
		}
	});
}

function UpdateNodeSizeImmediate(node: any, expandOnly?: boolean): void
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

export function applySwitchDynamicTypes(node: any, inputPrefix: string | null): void
{
	if (!node.inputs || node.inputs.length === 0)
	{
		return;
	}

	let resolvedType: string = ANY_TYPE;
	const inputTypes: string[] = [];

	for (let i = 0; i < node.inputs.length; i++)
	{
		const t = resolveInputType(node, i);
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

		inp.type = effectiveType;

		const label = (effectiveType !== ANY_TYPE)
			? (i === 0 ? effectiveType.toLowerCase() : `${effectiveType.toLowerCase()}_${i + 1}`)
			: (i === 0 ? `${inputPrefix}` : `${inputPrefix}_${i + 1}`);

		inp.name = `input_${i + 1}`;
		inp.label = label;

		const linkId = inp.link;
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
			out.type = resolvedType;

			if (resolvedType !== ANY_TYPE)
			{
				out.name = "output_1";
				out.label = resolvedType.toLowerCase();
			}

			const outLinks = out.links ?? [];
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
	ScheduleSizeUpdate(node);
}

export function UpdateNodeSize(node: any, expandOnly?: boolean): void
{
	if (IsGraphLoading())
	{
		return;
	}
	ScheduleSizeUpdate(node);
}

export function UpdatePreviewNodeSize(node: any): void
{
	if (IsGraphLoading() || (node as any).__tojioo_skip_resize)
	{
		return;
	}
	ScheduleSizeUpdate(node);
}

export function normalizeInputs(node: any): void
{
	if (!node.inputs)
	{
		return;
	}

	let lastConnectedIndex = -1;
	for (let i = node.inputs.length - 1; i >= 0; i--)
	{
		if (node.inputs[i]?.link != null)
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

	ScheduleSizeUpdate(node);
}

export function isInputConnectionChange(type: number): boolean
{
	return type === getLgInput();
}