import {applyDynamicTypes} from "../utils/types.js"
import {makeIsGraphLoading} from "../utils/lifecycle.js"

export function configureDynamicSingle() {
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicSingle",
		beforeRegisterNodeDef(nodeType, nodeData, app) {
			if (nodeData?.name !== "PT_DynamicSingle") return

			const isGraphLoading = makeIsGraphLoading()

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange
			nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
				if (isGraphLoading()) return
				if (prevOnConnectionsChange) prevOnConnectionsChange.call(this, type, index, connected, link_info)

				const node = this
				setTimeout(() => {
					applyDynamicTypes(node)
				}, 50)
			}

			const prevConfigure = nodeType.prototype.configure
			nodeType.prototype.configure = function (info) {
				if (prevConfigure) prevConfigure.call(this, info)
				applyDynamicTypes(this)
			}

			const prevOnAdded = nodeType.prototype.onAdded
			nodeType.prototype.onAdded = function () {
				if (prevOnAdded) prevOnAdded.apply(this, arguments)
				applyDynamicTypes(this)
			}
		}
	}
}