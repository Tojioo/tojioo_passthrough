import {ApplyDynamicTypes, connectPending, consumePendingConnection, DeferMicrotask, GetGraph, GetLgInput, GetLink, GetLinkTypeFromEndpoints, IsGraphLoading, UpdateNodeSize, UpdateNodeSizeImmediate} from '@/utils';
import {ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {ANY_TYPE, MAX_SOCKETS} from '@/types/tojioo';
import {loggerInstance} from '@/logger_internal';

// Scoped log
const log = loggerInstance("DynamicPassthrough");

export function configureDynamicPassthrough(): ComfyExtension
{
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicPassthrough",
		beforeRegisterNodeDef: async (nodeType, nodeData: ComfyNodeDef, _app): Promise<void> =>
		{
			if (nodeData?.name !== "PT_DynamicPassthrough")
			{
				return;
			}

			function normalizeIO(node: any)
			{
				if (!node.inputs)
				{
					node.inputs = [];
				}
				if (!node.outputs)
				{
					node.outputs = [];
				}

				let lastConnectedInput = -1;
				for (let i = node.inputs.length - 1; i >= 0; i--)
				{
					if (node.inputs[i]?.link != null)
					{
						lastConnectedInput = i;
						break;
					}
				}

				let lastConnectedOutput = -1;
				for (let i = node.outputs.length - 1; i >= 0; i--)
				{
					const links = node.outputs[i]?.links;
					if (links && links.length > 0)
					{
						lastConnectedOutput = i;
						break;
					}
				}

				const lastConnected = Math.max(lastConnectedInput, lastConnectedOutput);
				const desiredCount = Math.min(MAX_SOCKETS, Math.max(1, lastConnected + 2));

				while (node.inputs.length > desiredCount && typeof node.removeInput === "function")
				{
					node.removeInput(node.inputs.length - 1);
				}
				while (node.outputs.length > desiredCount && typeof node.removeOutput === "function")
				{
					node.removeOutput(node.outputs.length - 1);
				}

				while (node.inputs.length < desiredCount && typeof node.addInput === "function")
				{
					node.addInput("input", ANY_TYPE as ISlotType);
					node.inputs[node.inputs.length - 1].label = "input";
				}
				while (node.outputs.length < desiredCount && typeof node.addOutput === "function")
				{
					node.addOutput("output", ANY_TYPE as ISlotType);
					node.outputs[node.outputs.length - 1].label = "output";
				}

				UpdateNodeSize(node, (node as any).__tojioo_dynamic_io_size_fixed || false);
				(node as any).__tojioo_dynamic_io_size_fixed = true;
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
				if (this.inputs)
				{
					for (let i = 0; i < this.inputs.length; i++)
					{
						if (this.inputs[i]?.link == null)
						{
							return returnObj ? this.inputs[i] : i;
						}
					}
				}
				return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
			};

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function(this: any, type: number, index: number, isConnected: boolean, link_info: any, inputOrOutput: any)
			{
				if (IsGraphLoading())
				{
					return;
				}

				prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);

				const node = this;

				if (type === GetLgInput() && isConnected)
				{
					try
					{
						const g = GetGraph(node);
						const linkId = link_info?.id ?? node.inputs?.[index]?.link;
						const linkObj = link_info ?? GetLink(node, linkId);
						const inferredType = GetLinkTypeFromEndpoints(node, linkObj);

						if (linkId != null && g?.links?.[linkId] && inferredType && inferredType !== ANY_TYPE)
						{
							g.links[linkId].type = inferredType;

							if (node.outputs?.[index])
							{
								node.outputs[index].type = inferredType as ISlotType;
								const n = inferredType.toLowerCase();
								node.outputs[index].name = `output_${index + 1}`;
								node.outputs[index].label = n;

								if (node.inputs?.[index])
								{
									node.inputs[index].type = inferredType as ISlotType;
									node.inputs[index].name = `input_${index + 1}`;
									node.inputs[index].label = n;
								}
							}
						}
					}
					catch (e)
					{
						log.error(e);
					}

					DeferMicrotask(() =>
					{
						normalizeIO(this);
						ApplyDynamicTypes(this);
					});
					return;
				}

				if (!isConnected)
				{
					const disconnectedIndex = index;
					DeferMicrotask(() =>
					{
						if (!node.inputs || node.inputs.length === 0)
						{
							return;
						}
						if (disconnectedIndex < 0 || disconnectedIndex >= node.inputs.length)
						{
							return;
						}

						if (node.inputs[disconnectedIndex]?.link != null)
						{
							normalizeIO(this);
							ApplyDynamicTypes(this);
							return;
						}

						let hasConnectionsAfter = false;
						for (let i = disconnectedIndex + 1; i < Math.max(node.inputs.length, node.outputs.length); i++)
						{
							if (node.inputs?.[i]?.link != null || (node.outputs?.[i]?.links?.length ?? 0) > 0)
							{
								hasConnectionsAfter = true;
								break;
							}
						}

						if (hasConnectionsAfter)
						{
							if (typeof node.removeInput === "function")
							{
								node.removeInput(disconnectedIndex);
							}
							if (typeof node.removeOutput === "function")
							{
								node.removeOutput(disconnectedIndex);
							}
						}

						normalizeIO(this);
						ApplyDynamicTypes(this);
					});
					return;
				}

				DeferMicrotask(() =>
				{
					normalizeIO(node);
					ApplyDynamicTypes(node);
				});
			};

			const prevConfigure = nodeType.prototype.configure;
			nodeType.prototype.configure = function(this: any, info: any)
			{
				prevConfigure?.call(this, info);

				(this as any).__tojioo_dynamic_io_size_fixed = false;
				DeferMicrotask(() =>
				{
					try
					{
						normalizeIO(this);
						ApplyDynamicTypes(this);
					}
					catch (e)
					{
						log.error("error in configure", e);
					}
				});

				setTimeout(() =>
				{
					try
					{
						(this as any).__tojioo_dynamic_io_size_fixed = false;
						normalizeIO(this);
						ApplyDynamicTypes(this);
						UpdateNodeSizeImmediate(this);
					}
					catch
					{
					}
				}, 100);
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function(this: any)
			{
				prevOnAdded?.apply(this, arguments as any);

				const pending = consumePendingConnection();

				(this as any).__tojioo_dynamic_io_size_fixed = false;
				DeferMicrotask(() =>
				{
					try
					{
						normalizeIO(this);
						ApplyDynamicTypes(this);
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