import {getGraph, getLink, getNodeById, setLinkType} from "../utils/graph.js"
import {getLinkTypeFromEndpoints} from "../utils/types.js"
import {deferMicrotask, makeIsGraphLoading} from "../utils/lifecycle.js"
import {ANY_TYPE} from "../config/constants.js"

export function configureDynamicSingle() {
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicSingle",
		beforeRegisterNodeDef(nodeType, nodeData, app) {
			if (nodeData?.name !== "PT_DynamicSingle") return

			const isGraphLoading = makeIsGraphLoading()

			function resolveType(node) {
				const inp = node.inputs?.[0]
				const out = node.outputs?.[0]

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

				const hasLinks = (inLinkId != null) || (out?.links?.length > 0)
				if (hasLinks) {
					if (inp?.type && inp.type !== ANY_TYPE) return inp.type
					if (out?.type && out.type !== ANY_TYPE) return out.type
				}

				return ANY_TYPE
			}

			function applyType(node) {
				const t = resolveType(node)
				const isTyped = t && t !== ANY_TYPE
				const name = isTyped ? t.toLowerCase() : null

				if (node.inputs?.[0]) {
					node.inputs[0].type = t
					if (name) node.inputs[0].name = name
				}

				if (node.outputs?.[0]) {
					node.outputs[0].type = t
					if (name) node.outputs[0].name = name
				}

				if (isTyped) {
					const inLinkId = node.inputs?.[0]?.link
					if (inLinkId != null) setLinkType(node, inLinkId, t)

					const outLinks = node.outputs?.[0]?.links ?? []
					for (const linkId of outLinks) {
						if (linkId != null) setLinkType(node, linkId, t)
					}
				}

				const g = getGraph(node)
				g?.setDirtyCanvas?.(true, true)
			}

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange
			nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
				if (isGraphLoading()) return
				if (prevOnConnectionsChange) prevOnConnectionsChange.call(this, type, index, connected, link_info)

				deferMicrotask(() => applyType(this))
			}

			const prevConfigure = nodeType.prototype.configure
			nodeType.prototype.configure = function (info) {
				if (prevConfigure) prevConfigure.call(this, info)

				applyType(this)
				setTimeout(() => applyType(this), 100)
			}

			const prevOnAdded = nodeType.prototype.onAdded
			nodeType.prototype.onAdded = function () {
				if (prevOnAdded) prevOnAdded.apply(this, arguments)
				applyType(this)
			}
		}
	}
}