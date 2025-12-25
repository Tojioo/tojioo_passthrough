import {applyDynamicInputs, deriveDynamicPrefixFromNodeData, makeIsGraphLoading} from "../utils/lifecycle.js"

function isSwitch(nodeData) {
	const n = nodeData?.name ?? ""
	return n.startsWith("PT_Any") && n.endsWith("Switch") && !n.endsWith("BatchSwitch")
}

export function configureSwitch() {
	return {
		name: "Tojioo.Passthrough.Dynamic.SwitchNodes",
		beforeRegisterNodeDef(nodeType, nodeData, app) {
			if (!isSwitch(nodeData)) return

			const isGraphLoading = makeIsGraphLoading()
			const prefix = deriveDynamicPrefixFromNodeData(nodeData)
			if (!prefix) return

			applyDynamicInputs(nodeType, prefix, isGraphLoading)
		}
	}
}