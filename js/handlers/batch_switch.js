import {applyDynamicInputs, deriveDynamicPrefixFromNodeData, makeIsGraphLoading} from "../utils/lifecycle.js"

function isBatchSwitch(nodeData) {
	const n = nodeData?.name ?? ""
	return n.startsWith("PT_Any") && n.endsWith("BatchSwitch")
}

export function configureBatchSwitch() {
	return {
		name: "Tojioo.Passthrough.Dynamic.BatchSwitchNodes",
		beforeRegisterNodeDef(nodeType, nodeData, app) {
			if (!isBatchSwitch(nodeData)) return

			const isGraphLoading = makeIsGraphLoading()
			const prefix = deriveDynamicPrefixFromNodeData(nodeData)
			if (!prefix) return

			applyDynamicInputs(nodeType, prefix, isGraphLoading)
		}
	}
}