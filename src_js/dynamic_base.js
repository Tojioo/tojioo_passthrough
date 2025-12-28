// currently unused

import {updateLinkTypesForSlot} from "./utils/types";
import {getGraph} from "./utils/graph";
import {ANY_TYPE} from "./config/constants";

export function applyNodeLifecycleHooks(nodeType, normalizeIO, isGraphLoading = null) {
	const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange
	if (isGraphLoading) {
		nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
			if (isGraphLoading()) return
			if (prevOnConnectionsChange) prevOnConnectionsChange.call(this, type, index, connected, link_info)

			const node = this
			setTimeout(() => {
				normalizeIO(node)
				applyDynamicTypes(node)
			}, 50)
		}
	}

	const prevConfigure = nodeType.prototype.configure
	nodeType.prototype.configure = function (info) {
		if (prevConfigure) prevConfigure.call(this, info)
		normalizeIO(this)
		applyDynamicTypes(this)
	}

	const prevOnAdded = nodeType.prototype.onAdded
	nodeType.prototype.onAdded = function () {
		if (prevOnAdded) prevOnAdded.apply(this, arguments)
		normalizeIO(this)
		applyDynamicTypes(this)
	}
}

function applyDynamicTypes(node) {
	const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0)
	const types = []
	for (let i = 0; i < count; i++) types.push(resolvePairType(node, i))

	const inputNames = []
	const outputNames = []
	const typeCounters = {}

	for (let i = 0; i < count; i++) {
		const t = types[i]
		const isTyped = t && t !== ANY_TYPE

		if (isTyped) {
			const baseLabel = t.toLowerCase()
			if (typeCounters[t] === undefined) typeCounters[t] = 1
			const occurrence = typeCounters[t]
			typeCounters[t]++

			const name = occurrence === 1 ? baseLabel : `${baseLabel}_${occurrence}`
			inputNames.push(name)
			outputNames.push(name)
		} else {
			if (typeCounters["__untyped__"] === undefined) typeCounters["__untyped__"] = 1
			const occurrence = typeCounters["__untyped__"]
			typeCounters["__untyped__"]++

			inputNames.push(occurrence === 1 ? "input" : `input_${occurrence}`)
			outputNames.push(occurrence === 1 ? "output" : `output_${occurrence}`)
		}
	}

	for (let i = 0; i < count; i++) {
		const t = types[i]
		if (node.inputs?.[i]) {
			node.inputs[i].type = t
			node.inputs[i].name = inputNames[i]
		}
		if (node.outputs?.[i]) {
			node.outputs[i].type = t
			node.outputs[i].name = outputNames[i]
		}
		if (t && t !== ANY_TYPE) updateLinkTypesForSlot(node, i, t)
	}

	const g = getGraph(node)
	g?.setDirtyCanvas?.(true, true)
	node.setSize(node.computeSize())
}