import {ApplySwitchDynamicTypes, DeferMicrotask, DeriveDynamicPrefixFromNodeData, IsGraphLoading, NormalizeInputs, ResolveInputType, GetLgInput} from '@/utils';
import {ComfyApp, ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {ANY_TYPE} from '@/types/tojioo';

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

			const inputPrefix = DeriveDynamicPrefixFromNodeData(nodeData);
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

				if (!link_info || type !== GetLgInput())
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
							NormalizeInputs(node);
							ApplySwitchDynamicTypes(node, inputPrefix);
							return;
						}

						if (node.inputs[index]?.link != null)
						{
							NormalizeInputs(node);
							ApplySwitchDynamicTypes(node, inputPrefix);
							return;
						}

						const hasConnectionsAfter = node.inputs.slice(index + 1).some((i: any) => i?.link != null);
						if (hasConnectionsAfter && typeof node.removeInput === "function")
						{
							node.removeInput(index);
						}

						NormalizeInputs(node);
						ApplySwitchDynamicTypes(node, inputPrefix);
					});
					return;
				}

				NormalizeInputs(node);
				ApplySwitchDynamicTypes(node, inputPrefix);

				const lastIndex = node.inputs.length - 1;
				if (index === lastIndex && node.inputs[lastIndex]?.link != null && typeof node.addInput === "function")
				{
					const resolvedType = ResolveInputType(node, lastIndex);
					const socketType = resolvedType !== ANY_TYPE
						? resolvedType
						: (node.inputs[0]?.type ?? ANY_TYPE);
					node.addInput(`${inputPrefix}_${node.inputs.length + 1}`, socketType as ISlotType);
					NormalizeInputs(node);
					ApplySwitchDynamicTypes(node, inputPrefix);
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
				NormalizeInputs(this);
				ApplySwitchDynamicTypes(this, inputPrefix);
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function(this)
			{
				prevOnAdded?.apply(this, arguments as any);
				NormalizeInputs(this);
				ApplySwitchDynamicTypes(this, inputPrefix);
			};
		}
	};
}