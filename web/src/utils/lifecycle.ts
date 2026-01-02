import {ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {GetGraph, GetLinkTypeFromEndpoints, SetLinkType} from './graph.ts';

const ANY_TYPE: string = "*";

let _graphLoading = false;

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

	const g = GetGraph(node);

	for (let i = 0; i < node.inputs.length; i++)
	{
		const inp = node.inputs[i];
		const currentType = inputTypes[i];
		const effectiveType = (currentType !== ANY_TYPE) ? currentType : resolvedType;

		inp.type = effectiveType;

		if (effectiveType !== ANY_TYPE)
		{
			const baseLabel = effectiveType.toLowerCase();
			const n = i === 0 ? baseLabel : `${baseLabel}_${i + 1}`;
			inp.name = n;
			inp.label = n;
		}
		else
		{
			const n = i === 0 ? `${inputPrefix}` : `${inputPrefix}_${i + 1}`;
			inp.name = n;
			inp.label = n;
		}

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
				const n = resolvedType.toLowerCase();
				out.name = n;
				out.label = n;
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

	g?.setDirtyCanvas?.(true, true);
	UpdateNodeSize(node);
}

export function UpdateNodeSize(node: any): void
{
	if (IsGraphLoading())
	{
		return;
	}

	const size = node.computeSize();
	if (node.size)
	{
		size[0] = Math.max(size[0], node.size[0]);
		size[1] = Math.max(size[1], node.size[1]);
	}
	node.setSize(size);
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
		node.removeInput(node.inputs.length - 1);
	}

	UpdateNodeSize(node);
}