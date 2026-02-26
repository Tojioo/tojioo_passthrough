import {connectPending, consumePendingConnection, DeferMicrotask, GetGraph, GetInputLink, GetLink, IsGraphLoading, ResolveConnectedType} from '@/utils';
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

				const inLink = GetInputLink(node, 0);
				if (inLink && slotType !== ANY_TYPE)
				{
					inLink.type = slotType;
				}

				for (const linkId of node.outputs?.[0]?.links ?? [])
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
				if (this.inputs?.[0]?.link == null)
				{
					return returnObj ? this.inputs[0] : 0;
				}
				return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
			};

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
				const loading = IsGraphLoading();
				DeferMicrotask(() =>
				{
					if (loading)
					{
						(this as any).__tojioo_skip_resize = true;
					}
					try
					{
						applyType(this);
					}
					catch (e)
					{
						log.error("error in configure", e);
					}
					finally
					{
						(this as any).__tojioo_skip_resize = false;
					}
				});
				setTimeout(() =>
				{
					try
					{
						applyType(this);
					}
					catch
					{
					}
				}, 100);
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function(this)
			{
				prevOnAdded?.apply(this, arguments as any);

				const pending = consumePendingConnection();

				const loading = IsGraphLoading();
				DeferMicrotask(() =>
				{
					if (loading)
					{
						(this as any).__tojioo_skip_resize = true;
					}
					try
					{
						applyType(this);
					}
					catch (e)
					{
						log.error("error in onAdded", e);
					}
					finally
					{
						(this as any).__tojioo_skip_resize = false;
					}

					connectPending(this, pending);
				});
			};
		}
	};
}