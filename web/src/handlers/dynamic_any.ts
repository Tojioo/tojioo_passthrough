import {AfterGraphLoaded, connectPending, consumePendingConnection, DeferMicrotask, GetGraph, GetInputLink, GetLink, GetOutputLinkIds, IsGraphLoading, IsInputLinked, ResolveConnectedType} from '@/utils';
import {ComfyApp, ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {ANY_TYPE} from '@/types/tojioo';
import {loggerInstance} from '@/logger_internal';

// Scoped log
const log = loggerInstance("DynamicAny");

export function configureDynamicAny(): ComfyExtension
{
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicAny",
		beforeRegisterNodeDef: async (nodeType, nodeData: ComfyNodeDef, _app: ComfyApp): Promise<void> =>
		{
			if (nodeData?.name !== "PT_DynamicAny")
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
					// Because ComfyUI keys the prompt by slot name, keeping the declared name lets it validate upstream nodes.
					node.inputs[0].name = "input";
					node.inputs[0].label = slotName;
				}

				if (node.outputs?.[0])
				{
					node.outputs[0].type = slotType;
					const n = isTyped ? t.toLowerCase() : "output";
					node.outputs[0].name = n;
					node.outputs[0].label = n;
				}

				const inLink = GetInputLink(node, 0);
				if (inLink && slotType !== ANY_TYPE)
				{
					inLink.type = slotType;
				}

				for (const linkId of GetOutputLinkIds(node, 0))
				{
					const link = GetLink(node, linkId);
					if (link && slotType !== ANY_TYPE)
					{
						link.type = slotType;
					}
				}

				GetGraph(node)?.setDirtyCanvas?.(true, true);
			}

			nodeType.prototype.onConnectInput = function(
				this: any,
				_targetSlot: number,
				_type: ISlotType,
				_output: any,
				_sourceNode: any,
				_sourceSlot: number
			): boolean
			{
				return true;
			};

			const prevFindInputSlotByType = nodeType.prototype.findInputSlotByType;
			nodeType.prototype.findInputSlotByType = function(
				this: any,
				type: ISlotType,
				returnObj?: true | undefined,
				preferFreeSlot?: boolean,
				doNotUseOccupied?: boolean
			): any
			{
				if (!IsInputLinked(this, 0))
				{
					return returnObj ? this.inputs[0] : 0;
				}
				return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
			};

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function(this, type, index, isConnected, link_info, inputOrOutput)
			{
				prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);

				if (IsGraphLoading())
				{
					return;
				}
				DeferMicrotask(() => applyType(this));
			};

			const prevConfigure = nodeType.prototype.configure;
			nodeType.prototype.configure = function(this, info)
			{
				prevConfigure?.call(this, info);
				DeferMicrotask(() =>
				{
					try
					{
						applyType(this);
					}
					catch (e)
					{
						log.error("error in configure", e);
					}
				});
				AfterGraphLoaded(() => applyType(this));
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function(this)
			{
				prevOnAdded?.apply(this, arguments as any);

				const pending = consumePendingConnection();

				DeferMicrotask(() =>
				{
					try
					{
						applyType(this);
					}
					catch (e)
					{
						log.error("error in onAdded", e);
					}

					connectPending(this, pending);
				});
			};
		}
	};
}