import {app} from "../../scripts/app.js";

app.registerExtension({
	name: "Tojioo.Passthrough.DynamicBatchInputs",

	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		const dynamicNodes = new Set([
			// Batch switches
			"PT_AnyImageBatchSwitch",
			"PT_AnyMaskBatchSwitch",
			"PT_AnyLatentBatchSwitch",
			"PT_AnyConditioningBatchSwitch",
			// First-valid switches
			"PT_AnyImageSwitch",
			"PT_AnyMaskSwitch",
			"PT_AnyLatentSwitch",
			"PT_AnyCLIPSwitch",
			"PT_AnyModelSwitch",
			"PT_AnyVAESwitch",
			"PT_AnyControlNetSwitch",
			"PT_AnySAMModelSwitch",
			"PT_AnyStringSwitch",
			"PT_AnyIntSwitch",
			"PT_AnyFloatSwitch",
			"PT_AnyBoolSwitch",
		]);

		if (dynamicNodes.has(nodeData.name)) {

			let input_name = "input";

			const inputNameMap = {
				"PT_AnyImageBatchSwitch": "image_",
				"PT_AnyMaskBatchSwitch": "mask_",
				"PT_AnyLatentBatchSwitch": "latent_",
				"PT_AnyConditioningBatchSwitch": "cond_",
				"PT_AnyImageSwitch": "image_",
				"PT_AnyMaskSwitch": "mask_",
				"PT_AnyLatentSwitch": "latent_",
				"PT_AnyCLIPSwitch": "clip_",
				"PT_AnyModelSwitch": "model_",
				"PT_AnyVAESwitch": "vae_",
				"PT_AnyControlNetSwitch": "control_net_",
				"PT_AnySAMModelSwitch": "sam_model_",
				"PT_AnyStringSwitch": "text_",
				"PT_AnyIntSwitch": "int_",
				"PT_AnyFloatSwitch": "float_",
				"PT_AnyBoolSwitch": "boolean_",
			};

			input_name = inputNameMap[nodeData.name] || "input";

			function normalizeInputs(node) {
				if (!node.inputs || node.inputs.length === 0) return;

				// Trim trailing empty slots; keep one empty slot after last connected (min 1 total)
				let lastConnectedIndex = -1;
				for (let i = node.inputs.length - 1; i >= 0; i--) {
					if (node.inputs[i]?.link != null) {
						lastConnectedIndex = i;
						break;
					}
				}

				const keepCount = Math.max(1, lastConnectedIndex + 2);
				while (node.inputs.length > keepCount) {
					node.removeInput(node.inputs.length - 1);
				}

				// Renumber inputs
				let slot_i = 1;
				for (let i = 0; i < node.inputs.length; i++) {
					const expectedName = `${input_name}${slot_i}`;
					if (node.inputs[i].name !== expectedName) {
						node.inputs[i].name = expectedName;
					}
					slot_i++;
				}

				node.setSize(node.computeSize());
			}

			const onConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
				const stackTrace = new Error().stack;

				// Skip during graph loading to avoid input name conflicts
				if (stackTrace.includes("loadGraphData")) {
					return;
				}

				// Let LiteGraph update internal link state first
				if (onConnectionsChange) {
					onConnectionsChange.call(this, type, index, connected, link_info);
				}

				if (!link_info) return;
				if (type !== LiteGraph.INPUT) return;

				// Defer disconnect compaction to avoid breaking "replace link" operations
				if (!connected) {
					const node = this;
					queueMicrotask(() => {
						if (!node.inputs || node.inputs.length === 0) return;

						// If it got reconnected as part of a replace, do nothing
						if (node.inputs[index]?.link != null) {
							normalizeInputs(node);
							return;
						}

						// Only remove this slot if there are still connected inputs after it
						let hasConnectionsAfter = false;
						for (let i = index + 1; i < node.inputs.length; i++) {
							if (node.inputs[i]?.link != null) {
								hasConnectionsAfter = true;
								break;
							}
						}

						if (hasConnectionsAfter) {
							node.removeInput(index);
						}

						normalizeInputs(node);
					});
					return;
				}

				// On connect: renumber and ensure a trailing empty slot exists
				normalizeInputs(this);

				// Add a new slot if the user connected the last available slot
				const lastIndex = this.inputs.length - 1;
				if (index === lastIndex && this.inputs[lastIndex]?.link != null) {
					// Only add if there isn't already an empty trailing slot
					this.addInput(`${input_name}${this.inputs.length + 1}`, this.inputs[0].type);
					normalizeInputs(this);
				}
			};

			// Fix inputs after workflow is loaded / node is duplicated (ALT+drag)
			const onConfigure = nodeType.prototype.configure;
			nodeType.prototype.configure = function (info) {
				if (onConfigure) {
					onConfigure.call(this, info);
				}

				if (!this.inputs || this.inputs.length === 0) {
					return;
				}

				normalizeInputs(this);
			};
		}
	},
});
