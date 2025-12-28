import {app} from "../../../scripts/app.js"

export function getGraph(node) {
	return node.graph || app.graph
}

export function getLink(node, linkId) {
	if (linkId == null) return null
	const g = getGraph(node)
	return g?.links?.[linkId] ?? null
}

export function getNodeById(node, id) {
	const g = getGraph(node)
	return g?.getNodeById?.(id) ?? null
}

export function setLinkType(node, linkId, type) {
	const g = getGraph(node)
	const link = g?.links?.[linkId]
	if (!link) return
	link.type = type
}