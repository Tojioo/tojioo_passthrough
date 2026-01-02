import {ANY_TYPE, BUS_TYPE, MAX_SOCKETS} from "@/types/tojioo.ts";
import {DeferMicrotask, IsGraphLoading, UpdateNodeSize} from "@/utils/lifecycle";
import {AssignTypeAndName, ProcessTypeNames, ResolveConnectedType} from "@/utils/types";
import {GetLinkTypeFromEndpoints} from "@/utils/graph";
import {ComfyApp, ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';

export function configureDynamicBus(): ComfyExtension
{
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicBus",
		beforeRegisterNodeDef: async (nodeType, nodeData: ComfyNodeDef, app: ComfyApp): Promise<void> =>
		{
			if (nodeData.name !== "PT_DynamicBus")
			{
				return;
			}

			function getSourceBusTypes(node: any): Record<number, string> | null
			{
				const busInput = node.inputs?.[0];
				if (!busInput || busInput.link == null)
				{
					return null;
				}

				const link = node.getInputLink(0);
				if (!link)
				{
					return null;
				}

				const sourceNode = node.graph?.getNodeById(link.origin_id);
				return (sourceNode?.properties as any)?._bus_slot_types ?? null;
			}

			function resolveSlotType(node: any, slotIndex: number, busTypes: Record<number, string> | null): string
			{
				const t = ResolveConnectedType(node, node.inputs?.[slotIndex], node.outputs?.[slotIndex]);
				if (t !== ANY_TYPE)
				{
					return t;
				}

				const busIndex = slotIndex - 1;
				if (busTypes?.[busIndex] !== undefined)
				{
					return busTypes[busIndex];
				}

				return ANY_TYPE;
			}

			function normalizeIO(node: any): void
			{
				if (!node.inputs) node.inputs = [];
				if (!node.outputs) node.outputs = [];

				if (node.inputs.length === 0)
				{
					node.addInput("bus", BUS_TYPE as ISlotType);
				}
				else
				{
					node.inputs[0].name = "bus";
					node.inputs[0].label = "bus";
					node.inputs[0].type = BUS_TYPE as ISlotType;
				}

				if (node.outputs.length === 0)
				{
					node.addOutput("bus", BUS_TYPE as ISlotType);
				}
				else
				{
					node.outputs[0].name = "bus";
					node.outputs[0].label = "bus";
					node.outputs[0].type = BUS_TYPE as ISlotType;
				}

				let lastConnectedInput = 0;
				for (let i = node.inputs.length - 1; i >= 1; i--)
				{
					if (node.inputs[i]?.link != null)
					{
						lastConnectedInput = i;
						break;
					}
				}

				let lastConnectedOutput = 0;
				for (let i = node.outputs.length - 1; i >= 1; i--)
				{
					if ((node.outputs[i]?.links?.length ?? 0) > 0)
					{
						lastConnectedOutput = i;
						break;
					}
				}

				const busTypes = getSourceBusTypes(node);
				const busSlotCount = busTypes ? Math.max(...Object.keys(busTypes).map(Number), -1) + 1 : 0;

				const lastConnected = Math.max(lastConnectedInput, lastConnectedOutput);
				const desiredCount = Math.min(MAX_SOCKETS, Math.max(2, lastConnected + 2, busSlotCount + 2));

				while (node.inputs.length > desiredCount)
				{
					node.removeInput(node.inputs.length - 1);
				}
				while (node.inputs.length < desiredCount)
				{
					node.addInput("input", ANY_TYPE as ISlotType);
					node.inputs[node.inputs.length - 1].label = "input";
				}

				while (node.outputs.length > desiredCount)
				{
					node.removeOutput(node.outputs.length - 1);
				}
				while (node.outputs.length < desiredCount)
				{
					node.addOutput("output", ANY_TYPE as ISlotType);
					node.outputs[node.outputs.length - 1].label = "output";
				}

				UpdateNodeSize(node);
			}

			function applyBusDynamicTypes(node: any): void
			{
				const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
				const busTypes = getSourceBusTypes(node);

				const types: string[] = [BUS_TYPE];
				for (let i = 1; i < count; i++)
				{
					types.push(resolveSlotType(node, i, busTypes));
				}

				for (let i = 1; i < count; i++)
				{
					if (types[i] !== ANY_TYPE && node.outputs?.[i])
					{
						node.outputs[i].type = types[i] as ISlotType;
					}
				}

				const typeCounters: Record<string, number> = {};
				const inputNames: string[] = ["bus"];
				const outputNames: string[] = ["bus"];

				for (let i = 1; i < count; i++)
				{
					ProcessTypeNames(types, i, typeCounters, inputNames, outputNames);
				}

				for (let i = 0; i < count; i++)
				{
					const currentType = AssignTypeAndName(types, i, node, inputNames, outputNames);

					if (i > 0 && currentType !== ANY_TYPE)
					{
						const inLink = node.getInputLink(i);
						if (inLink)
						{
							inLink.type = currentType;
						}

						for (const linkId of node.outputs?.[i]?.links ?? [])
						{
							const link = node.graph?.links?.[linkId];
							if (link)
							{
								link.type = currentType;
							}
						}
					}
				}

				const busInLink = node.getInputLink(0);
				if (busInLink)
				{
					busInLink.type = BUS_TYPE;
				}

				for (const linkId of node.outputs?.[0]?.links ?? [])
				{
					const link = node.graph?.links?.[linkId];
					if (link)
					{
						link.type = BUS_TYPE;
					}
				}

				if (!node.properties) node.properties = {};
				(node.properties as any)._bus_slot_types = {};

				if (busTypes)
				{
					for (const [idx, t] of Object.entries(busTypes))
					{
						(node.properties as any)._bus_slot_types[idx] = t;
					}
				}

				for (let i = 1; i < count; i++)
				{
					if (types[i] !== ANY_TYPE)
					{
						(node.properties as any)._bus_slot_types[i - 1] = types[i];
					}
				}

				node.graph?.setDirtyCanvas?.(true, true);
				UpdateNodeSize(node);
			}

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function(this, type, index, isConnected, link_info, inputOrOutput)
			{
				if (IsGraphLoading())
				{
					return;
				}

				prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);

				const node = this;

				if (type === LiteGraph.INPUT && isConnected && index > 0)
				{
					try
					{
						const link = link_info ?? node.getInputLink(index);
						if (link)
						{
							const sourceNode = node.graph?.getNodeById(link.origin_id);
							const sourceSlot = sourceNode?.outputs?.[link.origin_slot];
							const inferredType = sourceSlot?.type && sourceSlot.type !== ANY_TYPE && sourceSlot.type !== -1
								? sourceSlot.type as string
								: GetLinkTypeFromEndpoints(node, link);

							if (inferredType !== ANY_TYPE)
							{
								const n = inferredType.toLowerCase();
								if (node.inputs[index])
								{
									node.inputs[index].type = inferredType as ISlotType;
									node.inputs[index].name = n;
									node.inputs[index].label = n;
								}
								if (node.outputs[index])
								{
									node.outputs[index].type = inferredType as ISlotType;
									node.outputs[index].name = n;
									node.outputs[index].label = n;
								}
								const linkId = (link_info as any)?.id ?? node.inputs?.[index]?.link;
								const linkObj = node.graph?.links?.[linkId];
								if (linkObj) linkObj.type = inferredType;
							}
						}
					}
					catch {}
				}

				if (type === LiteGraph.OUTPUT && isConnected && index > 0)
				{
					try
					{
						const linkId = (link_info as any)?.id;
						const link = link_info ?? (linkId != null ? node.graph?.links?.[linkId] : null);
						if (link)
						{
							const targetNode = node.graph?.getNodeById(link.target_id);
							const targetSlot = targetNode?.inputs?.[link.target_slot];
							const inferredType = targetSlot?.type && targetSlot.type !== ANY_TYPE && targetSlot.type !== -1
								? targetSlot.type as string
								: GetLinkTypeFromEndpoints(node, link);

							if (inferredType !== ANY_TYPE)
							{
								const n = inferredType.toLowerCase();
								if (node.outputs[index])
								{
									node.outputs[index].type = inferredType as ISlotType;
									node.outputs[index].name = n;
									node.outputs[index].label = n;
								}
								if (node.inputs[index])
								{
									node.inputs[index].type = inferredType as ISlotType;
									node.inputs[index].name = n;
									node.inputs[index].label = n;
								}
								const linkObj = node.graph?.links?.[linkId];
								if (linkObj) linkObj.type = inferredType;
							}
						}
					}
					catch {}
				}

				if (!isConnected && index > 0)
				{
					const isInput = type === LiteGraph.INPUT;

					DeferMicrotask(() =>
					{
						const slotStillConnected = isInput
							? node.inputs?.[index]?.link != null
							: (node.outputs?.[index]?.links?.length ?? 0) > 0;

						if (slotStillConnected)
						{
							normalizeIO(node);
							applyBusDynamicTypes(node);
							return;
						}

						const pairConnected = isInput
							? (node.outputs?.[index]?.links?.length ?? 0) > 0
							: node.inputs?.[index]?.link != null;

						const maxLen = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
						let hasConnectionsAfter = false;
						for (let i = index + 1; i < maxLen; i++)
						{
							if (node.inputs?.[i]?.link != null || (node.outputs?.[i]?.links?.length ?? 0) > 0)
							{
								hasConnectionsAfter = true;
								break;
							}
						}

						if (hasConnectionsAfter && !pairConnected)
						{
							node.removeInput(index);
							node.removeOutput(index);
						}

						normalizeIO(node);
						applyBusDynamicTypes(node);
					});
					return;
				}

				DeferMicrotask(() =>
				{
					normalizeIO(node);
					applyBusDynamicTypes(node);
				});
			};

			const prevConfigure = nodeType.prototype.configure;
			nodeType.prototype.configure = function(this, info)
			{
				prevConfigure?.call(this, info);
				normalizeIO(this);
				applyBusDynamicTypes(this);
				setTimeout(() => applyBusDynamicTypes(this), 100);
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function(this)
			{
				prevOnAdded?.apply(this, arguments as any);
				DeferMicrotask(() =>
				{
					normalizeIO(this);
					applyBusDynamicTypes(this);
				});
			};
		}
	};
}