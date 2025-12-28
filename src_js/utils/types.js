import {getGraph, getLink, getNodeById, setLinkType} from "./graph.js";
import {ANY_TYPE} from "../config/constants.js";

export function getLinkTypeFromEndpoints(node, link)
{
	const origin = getNodeById(node, link?.origin_id);
	const oSlot = link?.origin_slot;
	const originType = origin?.outputs?.[oSlot]?.type;

	if (originType && originType !== ANY_TYPE) return originType;

	const target = getNodeById(node, link?.target_id);
	const tSlot = link?.target_slot;
	const targetType = target?.inputs?.[tSlot]?.type;

	if (targetType && targetType !== ANY_TYPE) return targetType;

	const linkType = link?.type;

	if (linkType && linkType !== ANY_TYPE) return linkType;

	return ANY_TYPE;
}

export function resolvePairType(node, zeroBasedIndex)
{
	const out = node.outputs?.[zeroBasedIndex];
	const inp = node.inputs?.[zeroBasedIndex];

	const outLinkId = out?.links?.[0];
	const outLink = getLink(node, outLinkId);
	let outType = outLink ? getLinkTypeFromEndpoints(node, outLink) : ANY_TYPE;

	if (outType === ANY_TYPE && outLink)
	{
		const targetNode = node.graph?.getNodeById?.(outLink.target_id);
		const targetSlot = targetNode?.inputs?.[outLink.target_slot];

		if (targetSlot?.type && targetSlot.type !== ANY_TYPE)
		{
			outType = targetSlot.type;
		}
	}

	if (outType && outType !== ANY_TYPE) return outType;

	const inLinkId = inp?.link;
	const inLink = getLink(node, inLinkId);
	let inType = inLink ? getLinkTypeFromEndpoints(node, inLink) : ANY_TYPE;

	if (inType === ANY_TYPE && inLink)
	{
		const sourceNode = node.graph?.getNodeById?.(inLink.origin_id);
		const sourceSlot = sourceNode?.outputs?.[inLink.origin_slot];

		if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE)
		{
			inType = sourceSlot.type;
		}
	}

	if (inType && inType !== ANY_TYPE) return inType;

	const tryDeriveFromName = (slot) =>
	{
		if (!slot || !slot.name) return null;
		
		const baseName = String(slot.name).replace(/_\d+$/, "");
		const lower = baseName.toLowerCase();
		
		if (lower === "input" || lower === "output") return null;
		
		if (lower.startsWith("input_" ) || lower.startsWith("output_")) return null;
		
		return baseName.toUpperCase();
	};

	const derivedFromOut = tryDeriveFromName(out);
	if (derivedFromOut) return derivedFromOut;
	const derivedFromIn = tryDeriveFromName(inp);
	if (derivedFromIn) return derivedFromIn;

	return ANY_TYPE;
}

export function updateLinkTypesForSlot(node, zeroBasedIndex, type)
{
	const inLinkId = node.inputs?.[zeroBasedIndex]?.link;
	if (inLinkId != null) setLinkType(node, inLinkId, type);
	const outLinks = node.outputs?.[zeroBasedIndex]?.links ?? [];
	for (const linkId of outLinks)
	{
		if (linkId != null) setLinkType(node, linkId, type);
	}
}

/**
 * Applies dynamic types to paired input/output slots.
 * Each slot pair (input[i], output[i]) shares a resolved type.
 * Typed slots get type-based names, untyped get "input"/"output".
 */
export function applyDynamicTypes(node)
{
	const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
	const types = [];
	for (let i = 0; i < count; i++) types.push(resolvePairType(node, i));
	const inputNames = [];
	const outputNames = [];
	const typeCounters = {};
	for (let i = 0; i < count; i++)
	{
		const t = types[i];
		const isTyped = t && t !== ANY_TYPE;
		if (isTyped)
		{
			const baseLabel = t.toLowerCase();
			if (typeCounters[t] === undefined) typeCounters[t] = 1;
			const occurrence = typeCounters[t];
			typeCounters[t]++;
			const name = occurrence === 1 ? baseLabel : `${baseLabel}_${occurrence}`;
			inputNames.push(name);
			outputNames.push(name);
		}
		else
		{
			if (typeCounters["__untyped__"] === undefined) typeCounters["__untyped__"] = 1;
			const occurrence = typeCounters["__untyped__"];
			typeCounters["__untyped__"]++;
			inputNames.push(occurrence === 1 ? "input" : `input_${occurrence}`);
			outputNames.push(occurrence === 1 ? "output" : `output_${occurrence}`);
		}
	}

	for (let i = 0; i < count; i++)
	{
		const t = types[i];
		if (node.inputs?.[i])
		{
			node.inputs[i].type = t;
			node.inputs[i].name = inputNames[i];
		}
		if (node.outputs?.[i])
		{
			node.outputs[i].type = t;
			node.outputs[i].name = outputNames[i];
		}
		if (t && t !== ANY_TYPE) updateLinkTypesForSlot(node, i, t);
	}
	const g = getGraph(node);
	g?.setDirtyCanvas?.(true, true);
	node.setSize(node.computeSize());
}

export function applyDynamicTypesLazy(node) {
	const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
	const types = [];
	for (let i = 0; i < count; i++) types.push(resolvePairType(node, i));

	for (let i = 0; i < count; i++) {
		const t = types[i];
		const isTyped = t && t !== ANY_TYPE;

		if (node.inputs?.[i]) node.inputs[i].type = t;
		if (node.outputs?.[i]) node.outputs[i].type = t;
		if (isTyped) updateLinkTypesForSlot(node, i, t);

		if (isTyped) {
			const base = t.toLowerCase();
			node.inputs[i].name = base;
			node.outputs[i].name = base;
		}
	}
	getGraph(node)?.setDirtyCanvas?.(true, true);
	node.setSize(node.computeSize());
}
