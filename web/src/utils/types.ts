import {ANY_TYPE} from '../types/tojioo';
import {GetGraph, GetLink, GetLinkTypeFromEndpoints, GetNodeById, SetLinkType} from './graph';
import {UpdateNodeSize} from './lifecycle';
import {GetInputLinkId, GetOutputLinkIds, IsInputLinked, IsOutputLinked} from './compat';

export function ResolvePairType(node: any, zeroBasedIndex: number): string
{
	const hasOutputLink = IsOutputLinked(node, zeroBasedIndex);
	const hasInputLink = IsInputLinked(node, zeroBasedIndex);

	if (!hasOutputLink && !hasInputLink)
	{
		return ANY_TYPE;
	}

	const outLinkId = GetOutputLinkIds(node, zeroBasedIndex)[0];
	const outLink = GetLink(node, outLinkId ?? null);
	if (outLink)
	{
		let outType = GetLinkTypeFromEndpoints(node, outLink);

		if (outType === ANY_TYPE)
		{
			const targetNode = GetNodeById(node, outLink.target_id);
			const targetSlot = targetNode?.inputs?.[outLink.target_slot];
			if (targetSlot?.type && targetSlot.type !== ANY_TYPE && targetSlot.type !== -1)
			{
				outType = targetSlot.type as string;
			}
		}

		if (outType && outType !== ANY_TYPE)
		{
			return outType;
		}
	}

	const inLinkId = GetInputLinkId(node, zeroBasedIndex);
	const inLink = GetLink(node, inLinkId ?? null);
	if (inLink)
	{
		let inType = GetLinkTypeFromEndpoints(node, inLink);

		if (inType === ANY_TYPE)
		{
			const sourceNode = GetNodeById(node, inLink.origin_id);
			const sourceSlot = sourceNode?.outputs?.[inLink.origin_slot];
			if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE && sourceSlot.type !== -1)
			{
				inType = sourceSlot.type as string;
			}
		}

		if (inType && inType !== ANY_TYPE)
		{
			return inType;
		}
	}

	return ANY_TYPE;
}

export function UpdateLinkTypesForSlot(node: any, zeroBasedIndex: number, type: string): void
{
	const inLinkId = GetInputLinkId(node, zeroBasedIndex);
	if (inLinkId != null)
	{
		SetLinkType(node, inLinkId, type);
	}

	const outLinks = GetOutputLinkIds(node, zeroBasedIndex);
	for (const linkId of outLinks)
	{
		if (linkId != null)
		{
			SetLinkType(node, linkId, type);
		}
	}
}

export function ResolveConnectedType(node: any, inp: any | undefined, out: any | undefined): string
{
	const isConcrete = (t: unknown): t is string => t != null && t !== ANY_TYPE && t !== -1;

	const inIndex = node.inputs?.indexOf(inp) ?? -1;
	const outIndex = node.outputs?.indexOf(out) ?? -1;
	const hasInputLink = IsInputLinked(node, inIndex);
	const hasOutputLink = IsOutputLinked(node, outIndex);

	if (!hasInputLink && !hasOutputLink)
	{
		return ANY_TYPE;
	}

	const tryFromLink = (linkId: number | null | undefined, peer: "origin" | "target"): string | undefined =>
	{
		if (linkId == null)
		{
			return;
		}

		const link = GetLink(node, linkId);
		if (!link)
		{
			return;
		}

		const endpointType = GetLinkTypeFromEndpoints(node, link);
		if (isConcrete(endpointType))
		{
			return endpointType;
		}

		if (peer === "origin")
		{
			const peerNode = GetNodeById(node, link.origin_id);
			const peerSlot = peerNode?.outputs?.[link.origin_slot];
			return isConcrete(peerSlot?.type) ? (peerSlot.type as string) : undefined;
		}

		const peerNode = GetNodeById(node, link.target_id);
		const peerSlot = peerNode?.inputs?.[link.target_slot];
		return isConcrete(peerSlot?.type) ? (peerSlot.type as string) : undefined;
	};

	const inType = tryFromLink(GetInputLinkId(node, inIndex), "origin");
	if (inType)
	{
		return inType;
	}

	const outType = tryFromLink(GetOutputLinkIds(node, outIndex)[0], "target");
	if (outType)
	{
		return outType;
	}

	if (hasInputLink && isConcrete(inp?.type))
	{
		return inp.type as string;
	}

	if (hasOutputLink && isConcrete(out?.type))
	{
		return out.type as string;
	}

	return ANY_TYPE;
}

export function ProcessTypeNames(
	types: string[],
	i: number,
	typeCounters: Record<string, number>,
	inputNames: string[],
	outputNames: string[]): void
{
	const t = types[i];
	const isTyped = t && t !== ANY_TYPE;

	if (isTyped)
	{
		const baseLabel = t.toLowerCase();
		if (typeCounters[t] === undefined)
		{
			typeCounters[t] = 1;
		}
		const occurrence = typeCounters[t];
		typeCounters[t]++;
		const name = occurrence === 1 ? baseLabel : `${baseLabel}_${occurrence}`;
		inputNames.push(name);
		outputNames.push(name);
	}
	else
	{
		if (typeCounters["__untyped__"] === undefined)
		{
			typeCounters["__untyped__"] = 1;
		}
		const occurrence = typeCounters["__untyped__"];
		typeCounters["__untyped__"]++;
		inputNames.push(occurrence === 1 ? "input" : `input_${occurrence}`);
		outputNames.push(occurrence === 1 ? "output" : `output_${occurrence}`);
	}
}

export function AssignTypeAndName(types: string[], i: number, node: any, inputNames: string[], outputNames: string[]): string
{
	const currentType = types[i];

	if (node.inputs?.[i])
	{
		node.inputs[i].type = currentType;
		node.inputs[i].name = `input_${i + 1}`;
		node.inputs[i].label = inputNames[i];
	}
	if (node.outputs?.[i])
	{
		node.outputs[i].type = currentType;
		node.outputs[i].name = `output_${i + 1}`;
		node.outputs[i].label = outputNames[i];
	}
	return currentType;
}

export function ApplyDynamicTypes(node: any): void
{
	const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
	const types: string[] = [];

	for (let i = 0; i < count; i++)
	{
		types.push(ResolvePairType(node, i));
	}

	const inputNames: string[] = [];
	const outputNames: string[] = [];
	const typeCounters: Record<string, number> = {};

	for (let i = 0; i < count; i++)
	{
		ProcessTypeNames(types, i, typeCounters, inputNames, outputNames);
	}

	for (let i = 0; i < count; i++)
	{
		const currentType = AssignTypeAndName(types, i, node, inputNames, outputNames);

		if (currentType && currentType !== ANY_TYPE)
		{
			UpdateLinkTypesForSlot(node, i, currentType);
		}
	}

	const g = GetGraph(node);
	g?.setDirtyCanvas?.(true, true);

	const isPreview = node.type === "PT_DynamicPreview";
	UpdateNodeSize(node, isPreview);
}