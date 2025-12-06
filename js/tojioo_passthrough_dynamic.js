import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "Tojioo.Passthrough.DynamicBatchInputs",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "PT_AnyImageBatchSwitch" ||
            nodeData.name === "PT_AnyMaskBatchSwitch" ||
            nodeData.name === "PT_AnyLatentBatchSwitch" ||
            nodeData.name === "PT_AnyConditioningBatchSwitch") {

            let input_name = "input";

            switch(nodeData.name) {
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

                // Renumber inputs
                let slot_i = 1;
                for (let i = 0; i < this.inputs.length; i++) {
                    this.inputs[i].name = `${input_name}${slot_i}`;
                    slot_i++;
                }

                // Add new slot if connecting to last input
                if (connected) {
                    const lastIndex = this.inputs.length - 1;
                    if (index === lastIndex) {
                        this.addInput(`${input_name}${slot_i}`, this.inputs[0].type);
                    }
                }
            };
        }
    },
});
