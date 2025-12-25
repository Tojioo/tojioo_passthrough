import {getGraph, getLink, getNodeById, setLinkType} from "../utils/graph.js"
import {getLinkTypeFromEndpoints} from "../utils/types.js"
import {deferMicrotask, makeIsGraphLoading} from "../utils/lifecycle.js"
import {ANY_TYPE, BUS_TYPE, MAX_SOCKETS} from "../config/constants.js"

export function configureDynamicBus() {
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicBus",
		beforeRegisterNodeDef(nodeType, nodeData, app) {
			if (nodeData?.name !== "PT_DynamicBus") return

			const isGraphLoading = makeIsGraphLoading()

			function getSourceBusTypes(node) {
				const busInput = node.inputs?.[0]
				if (!busInput || busInput.link == null) return null

				const link = getLink(node, busInput.link)
				if (!link) return null

				const sourceNode = getNodeById(node, link.origin_id)
				return sourceNode?.properties?._bus_slot_types ?? null
			}

			function resolveSlotType(node, slotIndex, busTypes) {
				const inp = node.inputs?.[slotIndex]
				const out = node.outputs?.[slotIndex]

				const inLinkId = inp?.link
				if (inLinkId != null) {
					const inLink = getLink(node, inLinkId)
					if (inLink) {
						const t = getLinkTypeFromEndpoints(node, inLink)
						if (t && t !== ANY_TYPE) return t

						const sourceNode = getNodeById(node, inLink.origin_id)
						const sourceSlot = sourceNode?.outputs?.[inLink.origin_slot]
						if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE) return sourceSlot.type
					}
				}

				const outLinkId = out?.links?.[0]
				if (outLinkId != null) {
					const outLink = getLink(node, outLinkId)
					if (outLink) {
						const t = getLinkTypeFromEndpoints(node, outLink)
						if (t && t !== ANY_TYPE) return t

						const targetNode = getNodeById(node, outLink.target_id)
						const targetSlot = targetNode?.inputs?.[outLink.target_slot]
						if (targetSlot?.type && targetSlot.type !== ANY_TYPE) return targetSlot.type
					}
				}

				const busIndex = slotIndex - 1
				if (busTypes && busTypes[busIndex] !== undefined) {
					return busTypes[busIndex]
				}

				return ANY_TYPE
			}

			function normalizeIO(node) {
				if (!node.inputs) node.inputs = []
				if (!node.outputs) node.outputs = []

				if (node.inputs.length === 0) {
					node.addInput("bus", BUS_TYPE)
				} else {
					node.inputs[0].name = "bus"
					node.inputs[0].type = BUS_TYPE
				}

				if (node.outputs.length === 0) {
					node.addOutput("bus", BUS_TYPE)
				} else {
					node.outputs[0].name = "bus"
					node.outputs[0].type = BUS_TYPE
				}

				let lastConnectedInput = 0
				for (let i = node.inputs.length - 1; i >= 1; i--) {
					if (node.inputs[i]?.link != null) {
						lastConnectedInput = i
						break
					}
				}

				let lastConnectedOutput = 0
				for (let i = node.outputs.length - 1; i >= 1; i--) {
					if ((node.outputs[i]?.links?.length ?? 0) > 0) {
						lastConnectedOutput = i
						break
					}
				}

				const busTypes = getSourceBusTypes(node)
				const busSlotCount = busTypes ? Math.max(...Object.keys(busTypes).map(Number), -1) + 1 : 0

				const lastConnected = Math.max(lastConnectedInput, lastConnectedOutput)
				const desiredCount = Math.min(MAX_SOCKETS, Math.max(2, lastConnected + 2, busSlotCount + 2))

				while (node.inputs.length > desiredCount) node.removeInput(node.inputs.length - 1)
				while (node.inputs.length < desiredCount) node.addInput("input", ANY_TYPE)

				while (node.outputs.length > desiredCount) node.removeOutput(node.outputs.length - 1)
				while (node.outputs.length < desiredCount) node.addOutput("output", ANY_TYPE)

				node.setSize(node.computeSize())
			}

			function applyBusDynamicTypes(node) {
				const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0)
				const busTypes = getSourceBusTypes(node)

				const types = [BUS_TYPE]
				for (let i = 1; i < count; i++) {
					types.push(resolveSlotType(node, i, busTypes))
				}

				const typeCounters = {}
				const slotNames = ["bus"]

				for (let i = 1; i < count; i++) {
					const t = types[i]
					const isTyped = t && t !== ANY_TYPE

					if (isTyped) {
						const baseLabel = t.toLowerCase()
						if (typeCounters[t] === undefined) typeCounters[t] = 1
						const occurrence = typeCounters[t]
						typeCounters[t]++
						slotNames.push(occurrence === 1 ? baseLabel : `${baseLabel}_${occurrence}`)
					} else {
						if (typeCounters["__untyped__"] === undefined) typeCounters["__untyped__"] = 1
						const occurrence = typeCounters["__untyped__"]
						typeCounters["__untyped__"]++
						slotNames.push(occurrence === 1 ? "input" : `input_${occurrence}`)
					}
				}

				for (let i = 0; i < count; i++) {
					const t = types[i]
					const name = slotNames[i]

					if (node.inputs?.[i]) {
						node.inputs[i].type = t
						node.inputs[i].name = name
					}
					if (node.outputs?.[i]) {
						node.outputs[i].type = t
						node.outputs[i].name = name
					}

					if (i > 0 && t && t !== ANY_TYPE) {
						const inLinkId = node.inputs?.[i]?.link
						if (inLinkId != null) setLinkType(node, inLinkId, t)

						const outLinks = node.outputs?.[i]?.links ?? []
						for (const linkId of outLinks) {
							if (linkId != null) setLinkType(node, linkId, t)
						}
					}
				}

				if (!node.properties) node.properties = {}
				node.properties._bus_slot_types = {}

				if (busTypes) {
					for (const [idx, t] of Object.entries(busTypes)) {
						node.properties._bus_slot_types[idx] = t
					}
				}

				for (let i = 1; i < count; i++) {
					const t = types[i]
					if (t && t !== ANY_TYPE) {
						node.properties._bus_slot_types[i - 1] = t
					}
				}

				const g = getGraph(node)
				g?.setDirtyCanvas?.(true, true)
				node.setSize(node.computeSize())
			}

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange
			nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
				if (isGraphLoading()) return
				if (prevOnConnectionsChange) prevOnConnectionsChange.call(this, type, index, connected, link_info)

				const node = this

				if (!connected && index > 0) {
					const disconnectedIndex = index
					const isInput = type === LiteGraph.INPUT

					deferMicrotask(() => {
						const slotStillConnected = isInput
							? node.inputs?.[disconnectedIndex]?.link != null
							: (node.outputs?.[disconnectedIndex]?.links?.length ?? 0) > 0

						if (slotStillConnected) {
							normalizeIO(node)
							applyBusDynamicTypes(node)
							return
						}

						const pairConnected = isInput
							? (node.outputs?.[disconnectedIndex]?.links?.length ?? 0) > 0
							: node.inputs?.[disconnectedIndex]?.link != null

						let hasConnectionsAfter = false
						const maxLen = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0)
						for (let i = disconnectedIndex + 1; i < maxLen; i++) {
							if (node.inputs?.[i]?.link != null || (node.outputs?.[i]?.links?.length ?? 0) > 0) {
								hasConnectionsAfter = true
								break
							}
						}

						if (hasConnectionsAfter && !pairConnected) {
							node.removeInput(disconnectedIndex)
							node.removeOutput(disconnectedIndex)
						}

						normalizeIO(node)
						applyBusDynamicTypes(node)
					})
					return
				}

				setTimeout(() => {
					normalizeIO(node)
					applyBusDynamicTypes(node)
				}, 50)
			}

			const prevConfigure = nodeType.prototype.configure
			nodeType.prototype.configure = function (info) {
				if (prevConfigure) prevConfigure.call(this, info)
				normalizeIO(this)
				applyBusDynamicTypes(this)
			}

			const prevOnAdded = nodeType.prototype.onAdded
			nodeType.prototype.onAdded = function () {
				if (prevOnAdded) prevOnAdded.apply(this, arguments)
				normalizeIO(this)
				applyBusDynamicTypes(this)
			}
		}
	}
}