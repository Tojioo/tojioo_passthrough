import {ANY_TYPE} from "@/types/tojioo.ts";
import {DeferMicrotask, IsGraphLoading} from "@/utils/lifecycle";
import {ResolveConnectedType} from "@/utils/types";
import {ComfyApp, ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';

export function configureDynamicSingle(): ComfyExtension
{
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicSingle",
		beforeRegisterNodeDef: async (nodeType, nodeData: ComfyNodeDef, _app: ComfyApp): Promise<void> =>
		{
			if (nodeData?.name !== "PT_DynamicSingle")
			{
				return;
			}

			function applyType(node: any): void
			{
				const t = ResolveConnectedType(node, node.inputs?.[0], node.outputs?.[0]);
				const isTyped = t !== ANY_TYPE;
				const slotType = isTyped ? t : ANY_TYPE;
				const slotName = isTyped ? t.toLowerCase() : "input";

				if (node.inputs?.[0])
				{
					node.inputs[0].type = slotType;
					node.inputs[0].name = slotName;
					node.inputs[0].label = slotName;
				}

				if (node.outputs?.[0])
				{
					node.outputs[0].type = slotType;
					const n = isTyped ? t.toLowerCase() : "output";
					node.outputs[0].name = n;
					node.outputs[0].label = n;
				}

				const inLink = node.getInputLink(0);
				if (inLink && slotType !== ANY_TYPE)
				{
					inLink.type = slotType;
				}

				for (const linkId of node.outputs?.[0]?.links ?? [])
				{
					const link = node.graph?.links?.[linkId];
					if (link && slotType !== ANY_TYPE)
					{
						link.type = slotType;
					}
				}

				node.graph?.setDirtyCanvas?.(true, true);
			}

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function(this, type, index, isConnected, link_info, inputOrOutput)
			{
				if (IsGraphLoading())
				{
					return;
				}

				prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
				DeferMicrotask(() => applyType(this));
			};

			const prevConfigure = nodeType.prototype.configure;
			nodeType.prototype.configure = function(this, info)
			{
				prevConfigure?.call(this, info);
				applyType(this);
				setTimeout(() => applyType(this), 100);
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function(this)
			{
				prevOnAdded?.apply(this, arguments as any);
				applyType(this);
			};
		}
	};
}