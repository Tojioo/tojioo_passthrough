import {getGraph, getLink, getNodeById, setLinkType} from "./graph.js"
import {getLinkTypeFromEndpoints} from "./types.js"
import {ANY_TYPE} from "../config/constants.js"

export function makeIsGraphLoading()
{
	return () => (new Error().stack ?? "").includes("loadGraphData")
}

export function deferMicrotask(fn)
{
	if (typeof queueMicrotask === "function")
	{
		queueMicrotask(fn)
		return
	}
	Promise.resolve().then(fn)
}

export function deriveDynamicPrefixFromNodeData(nodeData) {
	const opt = nodeData?.input?.optional
	if (!opt) return null
	const keys = Object.keys(opt)
	if (keys.length === 0) return null

	const suffixNumberOrInfinity = (s) => {
		const m = String(s).match(/(\d+)$/)
		return m ? Number(m[1]) : Number.POSITIVE_INFINITY
	}

	keys.sort((a, b) => suffixNumberOrInfinity(a) - suffixNumberOrInfinity(b))
	const baseName = keys[0]
	return baseName.replace(/_\d+$/, "").replace(/\d+$/, "")
}

function resolveInputType(node, inputIndex) {
	const inp = node.inputs?.[inputIndex]
	if (!inp) return ANY_TYPE

	const linkId = inp.link
	if (linkId == null) return ANY_TYPE

	const link = getLink(node, linkId)
	if (!link) return ANY_TYPE

	const inferredType = getLinkTypeFromEndpoints(node, link)
	if (inferredType && inferredType !== ANY_TYPE) return inferredType

	const sourceNode = getNodeById(node, link.origin_id)
	const sourceSlot = sourceNode?.outputs?.[link.origin_slot]
	if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE)
	{
		return sourceSlot.type
	}

	return ANY_TYPE
}

/**
 * Applies uniform type across all inputs for Switch nodes.
 * All inputs converge to the first resolved type.
 */
function applySwitchDynamicTypes(node, inputPrefix) {
	if (!node.inputs || node.inputs.length === 0) return

	let resolvedType = ANY_TYPE
	const inputTypes = []

	for (let i = 0; i < node.inputs.length; i++) {
		const t = resolveInputType(node, i)
		inputTypes.push(t)
		if (t && t !== ANY_TYPE && resolvedType === ANY_TYPE) {
			resolvedType = t
		}
	}

	const g = getGraph(node)

	for (let i = 0; i < node.inputs.length; i++) {
		const inp = node.inputs[i]
		const currentType = inputTypes[i]
		const effectiveType = (currentType !== ANY_TYPE) ? currentType : resolvedType

		inp.type = effectiveType

		if (effectiveType !== ANY_TYPE) {
			const baseLabel = effectiveType.toLowerCase()
			inp.name = i === 0 ? baseLabel : `${baseLabel}_${i + 1}`
		} else {
			inp.name = i === 0 ? `${inputPrefix}` : `${inputPrefix}_${i + 1}`
		}

		const linkId = inp.link
		if (linkId != null && effectiveType !== ANY_TYPE) {
			setLinkType(node, linkId, effectiveType)
		}
	}

	if (node.outputs && node.outputs.length > 0) {
		for (let i = 0; i < node.outputs.length; i++) {
			const out = node.outputs[i]
			out.type = resolvedType

			if (resolvedType !== ANY_TYPE) {
				out.name = resolvedType.toLowerCase()
			}

			const outLinks = out.links ?? []
			for (const linkId of outLinks) {
				if (linkId != null && resolvedType !== ANY_TYPE) {
					setLinkType(node, linkId, resolvedType)
				}
			}
		}
	}

	g?.setDirtyCanvas?.(true, true)
	node.setSize(node.computeSize())
}

/**
 * Applies dynamic input behavior to Switch nodes.
 * Handles slot addition/removal and type propagation.
 */
export function applyDynamicInputs(nodeType, inputPrefix, isGraphLoading)
{
	function normalizeInputs(node) {
		if (!node.inputs) return

		let lastConnectedIndex = -1
		for (let i = node.inputs.length - 1; i >= 0; i--) {
			if (node.inputs[i]?.link != null) {
				lastConnectedIndex = i
				break
			}
		}

		const keepCount = Math.max(1, lastConnectedIndex + 2)
		while (node.inputs.length > keepCount) node.removeInput(node.inputs.length - 1)

		node.setSize(node.computeSize())
	}

	const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange
	nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
		if (prevOnConnectionsChange) prevOnConnectionsChange.apply(this, arguments)

		if (!link_info) return
		if (type !== LiteGraph.INPUT) return

		if (!connected) {
			const node = this
			const disconnectedIndex = index

			deferMicrotask(() => {
				if (!node.inputs || node.inputs.length === 0) return

				if (disconnectedIndex < 0 || disconnectedIndex >= node.inputs.length) {
					normalizeInputs(node)
					applySwitchDynamicTypes(node, inputPrefix)
					return
				}

				if (node.inputs[disconnectedIndex]?.link != null) {
					normalizeInputs(node)
					applySwitchDynamicTypes(node, inputPrefix)
					return
				}

				let hasConnectionsAfter = false
				for (let i = disconnectedIndex + 1; i < node.inputs.length; i++) {
					if (node.inputs[i]?.link != null) {
						hasConnectionsAfter = true
						break
					}
				}

				if (hasConnectionsAfter) node.removeInput(disconnectedIndex)

				normalizeInputs(node)
				applySwitchDynamicTypes(node, inputPrefix)
			})

			return
		}

		normalizeInputs(this)
		applySwitchDynamicTypes(this, inputPrefix)

		const lastIndex = this.inputs.length - 1
		if (index === lastIndex && this.inputs[lastIndex]?.link != null) {
			const resolvedType = resolveInputType(this, lastIndex)
			const socketType = resolvedType !== ANY_TYPE ? resolvedType : (this.inputs[0]?.type ?? ANY_TYPE)
			this.addInput(`${inputPrefix}_${this.inputs.length + 1}`, socketType)
			normalizeInputs(this)
			applySwitchDynamicTypes(this, inputPrefix)
		}
	}

	const prevConfigure = nodeType.prototype.configure
	nodeType.prototype.configure = function (info) {
		if (prevConfigure) prevConfigure.call(this, info)
		if (!this.inputs || this.inputs.length === 0) return
		normalizeInputs(this)
		applySwitchDynamicTypes(this, inputPrefix)
	}

	const prevOnAdded = nodeType.prototype.onAdded
	nodeType.prototype.onAdded = function () {
		if (prevOnAdded) prevOnAdded.apply(this, arguments)
		normalizeInputs(this)
		applySwitchDynamicTypes(this, inputPrefix)
	}
}