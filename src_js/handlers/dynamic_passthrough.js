import {getGraph, getLink} from "../utils/graph.js"
import {applyDynamicTypes, getLinkTypeFromEndpoints} from "../utils/types.js"
import {deferMicrotask, makeIsGraphLoading} from "../utils/lifecycle.js"
import {ANY_TYPE, MAX_SOCKETS} from "../config/constants.js"

export function configureDynamicPassthrough() {
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicPassthrough",
		beforeRegisterNodeDef(nodeType, nodeData, app) {
			if (nodeData?.name !== "PT_DynamicPassthrough") return

			const isGraphLoading = makeIsGraphLoading()

			function normalizeIO(node) {
				if (!node.inputs) node.inputs = []
				if (!node.outputs) node.outputs = []

				if (!node.__tojioo_dynamic_io_rebuilt) {
					node.__tojioo_dynamic_io_rebuilt = true

					const hasAnyLinks =
						(node.inputs?.some(i => i?.link != null)) ||
						(node.outputs?.some(o => (o?.links?.length ?? 0) > 0))

					if (!hasAnyLinks) {
						while (node.inputs.length) node.removeInput(node.inputs.length - 1)
						while (node.outputs.length) node.removeOutput(node.outputs.length - 1)
					}
				}

				let lastConnectedInput = -1
				for (let i = node.inputs.length - 1; i >= 0; i--) {
					if (node.inputs[i]?.link != null) {
						lastConnectedInput = i
						break
					}
				}

				let lastConnectedOutput = -1
				for (let i = node.outputs.length - 1; i >= 0; i--) {
					const links = node.outputs[i]?.links
					if (links && links.length > 0) {
						lastConnectedOutput = i
						break
					}
				}

				const lastConnected = Math.max(lastConnectedInput, lastConnectedOutput)
				const desiredCount = Math.min(MAX_SOCKETS, Math.max(1, lastConnected + 2))

				while (node.inputs.length > desiredCount) node.removeInput(node.inputs.length - 1)
				while (node.outputs.length > desiredCount) node.removeOutput(node.outputs.length - 1)

				while (node.inputs.length < desiredCount) node.addInput("input", ANY_TYPE)
				while (node.outputs.length < desiredCount) node.addOutput("output", ANY_TYPE)

				node.setSize(node.computeSize())
			}

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange
			nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
				if (isGraphLoading()) return
				if (prevOnConnectionsChange) prevOnConnectionsChange.call(this, type, index, connected, link_info)

				const node = this

				if (type === LiteGraph.INPUT && connected) {
					try {
						const g = getGraph(node)
						const linkId = link_info?.id ?? node.inputs?.[index]?.link
						const linkObj = link_info ?? (linkId != null ? getLink(node, linkId) : null)
						const inferredType = getLinkTypeFromEndpoints(node, linkObj)
						if (linkId != null && g?.links?.[linkId] && inferredType && inferredType !== ANY_TYPE) {
							g.links[linkId].type = inferredType

							if (node.outputs?.[index])
							{
								node.outputs[index].type = inferredType
							}
						}
					}
					catch (e) {}

					deferMicrotask(() => {
						normalizeIO(node)
						applyDynamicTypes(node)
					})
					return
				}

				if (!connected && type === LiteGraph.INPUT) {
					const disconnectedIndex = index

					deferMicrotask(() => {
						if (!node.inputs || node.inputs.length === 0) return
						if (disconnectedIndex < 0 || disconnectedIndex >= node.inputs.length) return

						if (node.inputs[disconnectedIndex]?.link != null) {
							normalizeIO(node)
							applyDynamicTypes(node)
							return
						}

						const pairConnected = (node.outputs?.[disconnectedIndex]?.links?.length ?? 0) > 0
						if (pairConnected) {
							normalizeIO(node)
							applyDynamicTypes(node)
							return
						}

						let hasConnectionsAfter = false
						for (let i = disconnectedIndex + 1; i < node.inputs.length; i++) {
							if (node.inputs[i]?.link != null) {
								hasConnectionsAfter = true
								break
							}
						}

						if (!hasConnectionsAfter) {
							for (let i = disconnectedIndex + 1; i < (node.outputs?.length ?? 0); i++) {
								const outLinks = node.outputs[i]?.links
								if (outLinks && outLinks.length > 0) {
									hasConnectionsAfter = true
									break
								}
							}
						}

						if (hasConnectionsAfter) {
							node.removeInput(disconnectedIndex)
							node.removeOutput(disconnectedIndex)
						}

						normalizeIO(node)
						applyDynamicTypes(node)
					})

					return
				}

				if (!connected && type === LiteGraph.OUTPUT) {
					const disconnectedIndex = index

					deferMicrotask(() => {
						if (!node.outputs || node.outputs.length === 0) return
						if (disconnectedIndex < 0 || disconnectedIndex >= node.outputs.length) return

						const outLinks = node.outputs[disconnectedIndex]?.links
						if (outLinks && outLinks.length > 0) {
							normalizeIO(node)
							applyDynamicTypes(node)
							return
						}

						const pairConnected = node.inputs?.[disconnectedIndex]?.link != null
						if (pairConnected) {
							normalizeIO(node)
							applyDynamicTypes(node)
							return
						}

						let hasConnectionsAfter = false
						for (let i = disconnectedIndex + 1; i < node.outputs.length; i++) {
							const links = node.outputs[i]?.links
							if (links && links.length > 0) {
								hasConnectionsAfter = true
								break
							}
						}

						if (!hasConnectionsAfter) {
							for (let i = disconnectedIndex + 1; i < (node.inputs?.length ?? 0); i++) {
								if (node.inputs[i]?.link != null) {
									hasConnectionsAfter = true
									break
								}
							}
						}

						if (hasConnectionsAfter) {
							node.removeInput(disconnectedIndex)
							node.removeOutput(disconnectedIndex)
						}

						normalizeIO(node)
						applyDynamicTypes(node)
					})

					return
				}

				deferMicrotask(() => {
					normalizeIO(node)
					applyDynamicTypes(node)
				})
			}

			const prevConfigure = nodeType.prototype.configure
			nodeType.prototype.configure = function (info) {
				if (prevConfigure) prevConfigure.call(this, info)

				normalizeIO(this)
				applyDynamicTypes(this)

				setTimeout(() => {
					applyDynamicTypes(this)
				}, 100)
			}

			const prevOnAdded = nodeType.prototype.onAdded
			nodeType.prototype.onAdded = function () {
				if (prevOnAdded) prevOnAdded.apply(this, arguments)

				deferMicrotask(() => {
					normalizeIO(this)
					applyDynamicTypes(this)
				})
			}
		}
	}
}