import {ComfyApp, ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {applySwitchDynamicTypes, DeferMicrotask, deriveDynamicPrefixFromNodeData, IsGraphLoading, normalizeInputs, resolveInputType} from '@/utils/lifecycle.ts';
import {ANY_TYPE} from "@/types/tojioo.ts";

function isSwitch(nodeData: ComfyNodeDef): boolean
{
	const n = nodeData?.name ?? "";
	return n.startsWith("PT_Any") && n.endsWith("Switch") && !n.endsWith("BatchSwitch");
}

export function configureSwitchNodes(): ComfyExtension
{
	return {
		name: "Tojioo.Passthrough.Dynamic.SwitchNodes",
		beforeRegisterNodeDef: async (nodeType, nodeData: ComfyNodeDef, _app: ComfyApp): Promise<void> =>
		{
			if (!isSwitch(nodeData))
			{
				return;
			}

			const inputPrefix = deriveDynamicPrefixFromNodeData(nodeData);
			if (!inputPrefix)
			{
				return;
			}

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function(this, type, index, isConnected, link_info, inputOrOutput)
			{
				if (IsGraphLoading())
				{
					return;
				}

				prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);

				if (!link_info || type !== LiteGraph.INPUT)
				{
					return;
				}

				const node = this;

				if (!isConnected)
				{
					DeferMicrotask(() =>
					{
						if (!node.inputs?.length || index < 0 || index >= node.inputs.length)
						{
							normalizeInputs(node);
							applySwitchDynamicTypes(node, inputPrefix);
							return;
						}

						if (node.inputs[index]?.link != null)
						{
							normalizeInputs(node);
							applySwitchDynamicTypes(node, inputPrefix);
							return;
						}

						const hasConnectionsAfter = node.inputs.slice(index + 1).some((i: any) => i?.link != null);
						if (hasConnectionsAfter)
						{
							node.removeInput(index);
						}

						normalizeInputs(node);
						applySwitchDynamicTypes(node, inputPrefix);
					});
					return;
				}

				normalizeInputs(node);
				applySwitchDynamicTypes(node, inputPrefix);

				const lastIndex = node.inputs.length - 1;
				if (index === lastIndex && node.inputs[lastIndex]?.link != null)
				{
					const resolvedType = resolveInputType(node, lastIndex);
					const socketType = resolvedType !== ANY_TYPE
						? resolvedType
						: (node.inputs[0]?.type ?? ANY_TYPE);
					node.addInput(`${inputPrefix}_${node.inputs.length + 1}`, socketType as ISlotType);
					normalizeInputs(node);
					applySwitchDynamicTypes(node, inputPrefix);
				}
			};

			const prevConfigure = nodeType.prototype.configure;
			nodeType.prototype.configure = function(this, info)
			{
				prevConfigure?.call(this, info);
				if (!this.inputs?.length)
				{
					return;
				}
				normalizeInputs(this);
				applySwitchDynamicTypes(this, inputPrefix);
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function(this)
			{
				prevOnAdded?.apply(this, arguments as any);
				normalizeInputs(this);
				applySwitchDynamicTypes(this, inputPrefix);
			};
		}
	};
}