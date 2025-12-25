import {app} from "../../../scripts/app.js"

export function makeIsGraphLoading()
{
	return () => (new Error().stack ?? "").includes("loadGraphData")
}

function suffixNumberOrInfinity(s)
{
	const m = String(s).match(/(\d+)$/)
	return m ? Number(m[1]) : Number.POSITIVE_INFINITY
}

export function deriveDynamicPrefixFromNodeData(nodeData)
{
	const opt = nodeData?.input?.optional
	if (!opt) return null
	const keys = Object.keys(opt)
	if (keys.length === 0) return null
	keys.sort((a, b) => suffixNumberOrInfinity(a) - suffixNumberOrInfinity(b))
	const baseName = keys[0]
	return baseName.replace(/_\d+$/, "").replace(/\d+$/, "") // Handle "input_1" or "input1"
}

export function findWidgetByName(node, name)
{
	return node.widgets?.find(w => w.name === name) || null
}

function deferMicrotask(fn)
{
	if (typeof queueMicrotask === "function")
	{
		queueMicrotask(fn)
		return
	}
	Promise.resolve().then(fn)
}


export function applyDynamicInputs(nodeType, inputPrefix, isGraphLoading)
{
	function normalizeInputs(node)
	{
		if (!node.inputs) return

		let lastConnectedIndex = -1
		for (let i = node.inputs.length - 1; i >= 0; i--)
		{
			if (node.inputs[i]?.link != null)
			{
				lastConnectedIndex = i
				break
			}
		}

		const keepCount = Math.max(1, lastConnectedIndex + 2)
		while (node.inputs.length > keepCount) node.removeInput(node.inputs.length - 1)

		let slotNumber = 1
		for (let i = 0; i < node.inputs.length; i++)
		{
			const currentName = node.inputs[i].name

			if (i > 0 || currentName.includes("_"))
			{
				const expectedName = `${inputPrefix}_${slotNumber}`
				if (currentName !== expectedName) node.inputs[i].name = expectedName
			}

			slotNumber++
		}

		node.setSize(node.computeSize())
	}

	const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange
	nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info)
	{
		if (isGraphLoading()) return
		if (prevOnConnectionsChange) prevOnConnectionsChange.apply(this, arguments)

		if (!link_info) return
		if (type !== LiteGraph.INPUT) return

		if (!connected)
		{
			const node = this
			const disconnectedIndex = index

			deferMicrotask(() =>
			{
				if (!node.inputs || node.inputs.length === 0) return

				if (disconnectedIndex < 0 || disconnectedIndex >= node.inputs.length)
				{
					normalizeInputs(node)
					return
				}

				if (node.inputs[disconnectedIndex]?.link != null)
				{
					normalizeInputs(node)
					return
				}

				let hasConnectionsAfter = false
				for (let i = disconnectedIndex + 1; i < node.inputs.length; i++)
				{
					if (node.inputs[i]?.link != null)
					{
						hasConnectionsAfter = true
						break
					}
				}

				if (hasConnectionsAfter) node.removeInput(disconnectedIndex)

				normalizeInputs(node)
			})

			return
		}

		normalizeInputs(this)

		const lastIndex = this.inputs.length - 1
		if (index === lastIndex && this.inputs[lastIndex]?.link != null)
		{
			const socketType = this.inputs[0]?.type ?? this.inputs[lastIndex]?.type
			this.addInput(`${inputPrefix}_${this.inputs.length + 1}`, socketType)
			normalizeInputs(this)
		}
	}

	const prevConfigure = nodeType.prototype.configure
	nodeType.prototype.configure = function (info)
	{
		if (prevConfigure) prevConfigure.call(this, info)
		if (!this.inputs || this.inputs.length === 0) return
		normalizeInputs(this)
	}
}

export function makeDynamicInputsExtension(args)
{
	const { name, predicate } = args
	return {
		name,
		beforeRegisterNodeDef(nodeType, nodeData, app)
		{
			if (!predicate(nodeData)) return
			const isGraphLoading = makeIsGraphLoading()
			const prefix = deriveDynamicPrefixFromNodeData(nodeData)
			if (!prefix) return
			applyDynamicInputs(nodeType, prefix, isGraphLoading)
		}
	}
}

export function makeSingleNodeExtension(args)
{
	const { name, targetNodeName, apply } = args
	return {
		name,
		beforeRegisterNodeDef(nodeType, nodeData, app)
		{
			if (nodeData?.name !== targetNodeName) return
			const isGraphLoading = makeIsGraphLoading()
			apply(nodeType, app, isGraphLoading)
		}
	}
}

export function getGraph(node)
{
	return node.graph || app.graph
}

export function getLink(node, linkId)
{
	if (linkId == null) return null
	const g = getGraph(node)
	return g?.links?.[linkId] ?? null
}

export function getNodeById(node, id)
{
	const g = getGraph(node)
	return g?.getNodeById?.(id) ?? null
}

export function getLinkTypeFromEndpoints(node, link)
{
	const ANY_TYPE = "*"
	const origin = getNodeById(node, link?.origin_id)
	const oSlot = link?.origin_slot
	const originType = origin?.outputs?.[oSlot]?.type
	if (originType && originType !== ANY_TYPE) return originType

	const target = getNodeById(node, link?.target_id)
	const tSlot = link?.target_slot
	const targetType = target?.inputs?.[tSlot]?.type
	if (targetType && targetType !== ANY_TYPE) return targetType

	const linkType = link?.type
	if (linkType && linkType !== ANY_TYPE) return linkType

	return ANY_TYPE
}

export function resolvePairType(node, zeroBasedIndex)
{
	const ANY_TYPE = "*"
	const out = node.outputs?.[zeroBasedIndex]
	const inp = node.inputs?.[zeroBasedIndex]

	const outLinkId = out?.links?.[0]
	const outLink = getLink(node, outLinkId)
	let outType = outLink ? getLinkTypeFromEndpoints(node, outLink) : ANY_TYPE
	
	// If outType is still wildcard, try to get it from the target node's input type
	if (outType === ANY_TYPE && outLink)
	{
		const targetNode = node.graph?.getNodeById?.(outLink.target_id)
		const targetSlot = targetNode?.inputs?.[outLink.target_slot]
		if (targetSlot?.type && targetSlot.type !== ANY_TYPE)
		{
			outType = targetSlot.type
		}
	}
	
	if (outType && outType !== ANY_TYPE) return outType

	const inLinkId = inp?.link
	const inLink = getLink(node, inLinkId)
	let inType = inLink ? getLinkTypeFromEndpoints(node, inLink) : ANY_TYPE
	
	// If inType is still wildcard, try to get it from the source node's output type
	if (inType === ANY_TYPE && inLink)
	{
		const sourceNode = node.graph?.getNodeById?.(inLink.origin_id)
		const sourceSlot = sourceNode?.outputs?.[inLink.origin_slot]
		if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE)
		{
			inType = sourceSlot.type
		}
	}
	
	if (inType && inType !== ANY_TYPE) return inType

	return ANY_TYPE
}

export function setLinkType(node, linkId, t)
{
	const g = getGraph(node)
	const link = g?.links?.[linkId]
	if (!link) return
	link.type = t
}

export function updateLinkTypesForSlot(node, zeroBasedIndex, t)
{
	const inLinkId = node.inputs?.[zeroBasedIndex]?.link
	if (inLinkId != null) setLinkType(node, inLinkId, t)

	const outLinks = node.outputs?.[zeroBasedIndex]?.links ?? []
	for (const linkId of outLinks)
	{
		if (linkId != null) setLinkType(node, linkId, t)
	}
}

export function applyDynamicTypes(node)
{
	const ANY_TYPE = "*"
	const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0)
	const types = []
	for (let i = 0; i < count; i++) types.push(resolvePairType(node, i))

	// Build names: typed slots get type-based names, untyped slots get sequential input/output names
	const inputNames = []
	const outputNames = []

	// Count occurrences for each type (including untyped)
	const typeCounters = {}

	for (let i = 0; i < count; i++)
	{
		const t = types[i]
		const isTyped = t && t !== ANY_TYPE

		if (isTyped)
		{
			// Typed slot: use type name (e.g., "model", "clip", "model_2")
			const baseLabel = t.toLowerCase()
			if (typeCounters[t] === undefined) typeCounters[t] = 1
			const occurrence = typeCounters[t]
			typeCounters[t]++

			const name = occurrence === 1 ? baseLabel : `${baseLabel}_${occurrence}`
			inputNames.push(name)
			outputNames.push(name)
		}
		else
		{
			// Untyped slot: use "input" / "output" with sequential numbering
			if (typeCounters["__untyped__"] === undefined) typeCounters["__untyped__"] = 1
			const occurrence = typeCounters["__untyped__"]
			typeCounters["__untyped__"]++

			inputNames.push(occurrence === 1 ? "input" : `input_${occurrence}`)
			outputNames.push(occurrence === 1 ? "output" : `output_${occurrence}`)
		}
	}

	// Apply types and names
	for (let i = 0; i < count; i++)
	{
		const t = types[i]
		if (node.inputs?.[i])
		{
			node.inputs[i].type = t
			node.inputs[i].name = inputNames[i]
		}
		if (node.outputs?.[i])
		{
			node.outputs[i].type = t
			node.outputs[i].name = outputNames[i]
		}
		if (t && t !== ANY_TYPE) updateLinkTypesForSlot(node, i, t)
	}

	const g = getGraph(node)
	g?.setDirtyCanvas?.(true, true)
	node.setSize(node.computeSize())
}

export function applyNodeLifecycleHooks(nodeType, normalizeIO, isGraphLoading = null)
{
	const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange
	if (isGraphLoading) {
		nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info)
		{
			if (isGraphLoading()) return
			if (prevOnConnectionsChange) prevOnConnectionsChange.call(this, type, index, connected, link_info)

			const node = this
			setTimeout(() =>
			{
				normalizeIO(node)
				applyDynamicTypes(node)
			}, 50)
		}
	}

	const prevConfigure = nodeType.prototype.configure
	nodeType.prototype.configure = function (info)
	{
		if (prevConfigure) prevConfigure.call(this, info)
		normalizeIO(this)
		applyDynamicTypes(this)
	}

	const prevOnAdded = nodeType.prototype.onAdded
	nodeType.prototype.onAdded = function ()
	{
		if (prevOnAdded) prevOnAdded.apply(this, arguments)
		normalizeIO(this)
		applyDynamicTypes(this)
	}
}