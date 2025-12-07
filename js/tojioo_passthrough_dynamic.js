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

			switch (nodeData.name) {
				case "PT_AnyImageBatchSwitch":
					input_name = "image_";
					break;
				case "PT_AnyMaskBatchSwitch":
					input_name = "mask_";
					break;
				case "PT_AnyLatentBatchSwitch":
					input_name = "latent_";
					break;
				case "PT_AnyConditioningBatchSwitch":
					input_name = "cond_";
					break;
				case "PT_AnyImageSwitch":
					input_name = "image_";
					break;
				case "PT_AnyMaskSwitch":
					input_name = "mask_";
					break;
				case "PT_AnyLatentSwitch":
					input_name = "latent_";
					break;
				case "PT_AnyCLIPSwitch":
					input_name = "clip_";
					break;
				case "PT_AnyModelSwitch":
					input_name = "model_";
					break;
				case "PT_AnyVAESwitch":
					input_name = "vae_";
					break;
				case "PT_AnyControlNetSwitch":
					input_name = "control_net_";
					break;
				case "PT_AnySAMModelSwitch":
					input_name = "sam_model_";
					break;
				case "PT_AnyStringSwitch":
					input_name = "text_";
					break;
				case "PT_AnyIntSwitch":
					input_name = "int_";
					break;
				case "PT_AnyFloatSwitch":
					input_name = "float_";
					break;
				case "PT_AnyBoolSwitch":
					input_name = "boolean_";
					break;
			}

			const onConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
				const stackTrace = new Error().stack;

				if (stackTrace.includes("loadGraphData")) {
					return;
				}

				if (!link_info) {
					return;
				}

				if (type !== LiteGraph.INPUT) {
					return;
				}

				if (!connected) {
					// Check if it's a replacement (slot still has link after disconnect event)
					if (this.inputs[index] && this.inputs[index].link !== null) {
						return;
					}

					// Remove the disconnected input slot
					this.removeInput(index);

					// If no inputs remain, add back one empty slot
					if (this.inputs.length === 0) {
						this.addInput(`${input_name}1`, link_info.type);
					} else {
						// Renumber all inputs
						for (let i = 0; i < this.inputs.length; i++) {
							this.inputs[i].name = `${input_name}${i + 1}`;
						}

						// Ensure there's always one empty slot at the end
						const lastInput = this.inputs[this.inputs.length - 1];
						if (lastInput.link !== null) {
							this.addInput(`${input_name}${this.inputs.length + 1}`, this.inputs[0].type);
						}
					}

					// Recalculate node size
					this.setSize(this.computeSize());
					return;
				}

				// Renumber inputs
				let slot_i = 1;
				for (let i = 0; i < this.inputs.length; i++) {
					this.inputs[i].name = `${input_name}${slot_i}`;
					slot_i++;
				}

				// Add new slot if connecting to last input
				const lastIndex = this.inputs.length - 1;
				if (index === lastIndex) {
					this.addInput(`${input_name}${slot_i}`, this.inputs[0].type);
				}
			};
		}
	},
});
