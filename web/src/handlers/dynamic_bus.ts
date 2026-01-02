import {ANY_TYPE, BUS_TYPE} from "@/types/tojioo.ts";
import {DeferMicrotask, IsGraphLoading, UpdateNodeSize} from "@/utils/lifecycle";
import {ResolveConnectedType} from "@/utils/types";
import {GetGraph, GetInputLink, GetLink, GetLinkTypeFromEndpoints, GetNodeById} from "@/utils/graph";
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

				const link = GetInputLink(node, 0);
				if (!link)
				{
					return null;
				}

				const sourceNode = GetNodeById(node, link.origin_id);
				return (sourceNode?.properties as any)?._bus_slot_types ?? null;
			}

			function resolveSlotType(node: any, slotIndex: number, busTypes: Record<number, string> | null): string
			{
				const inp = node.inputs?.[slotIndex];
				const out = node.outputs?.[slotIndex];
				const t = ResolveConnectedType(node, inp, out);

				if (t !== ANY_TYPE)
				{
					return t;
				}

				const isConnected = (inp?.link != null) || ((out?.links?.length ?? 0) > 0);
				if (isConnected)
				{
					const busIndex = slotIndex - 1;
					if (busTypes?.[busIndex] !== undefined)
					{
						return busTypes[busIndex];
					}
				}

				return ANY_TYPE;
			}

			function normalizeIO(node: any): void
			{
				if (!node.inputs) node.inputs = [];
				if (!node.outputs) node.outputs = [];

				const slotsToKeep = new Set<number>();
				slotsToKeep.add(0);

				const maxLen = Math.max(node.inputs.length, node.outputs.length);

				for (let i = 1; i < maxLen; i++)
				{
					const inputConnected = i < node.inputs.length && node.inputs[i]?.link != null;
					const outputConnected = i < node.outputs.length && (node.outputs[i]?.links?.length ?? 0) > 0;
					if (inputConnected || outputConnected)
					{
						slotsToKeep.add(i);
					}
				}

				for (let i = maxLen - 1; i >= 1; i--)
				{
					if (!slotsToKeep.has(i))
					{
						if (i < node.inputs.length)
						{
							node.removeInput(i);
						}
						if (i < node.outputs.length)
						{
							node.removeOutput(i);
						}
					}
				}

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

				const busTypes = getSourceBusTypes(node) || {};
				const occupiedInBus = new Set(Object.keys(busTypes).map(Number));

				const localIndicesInUse = new Set<number>();
				for (let i = 1; i < node.inputs.length; i++)
				{
					const input = node.inputs[i];
					let currentIdx = -1;
					const m = input.name?.match(/input_(\d+)/);
					if (m) currentIdx = parseInt(m[1]) - 1;

					const isInputConnected = input.link != null;
					if (currentIdx === -1 || localIndicesInUse.has(currentIdx) || (isInputConnected && occupiedInBus.has(currentIdx)))
					{
						let nextIdx = 0;
						while (occupiedInBus.has(nextIdx) || localIndicesInUse.has(nextIdx)) nextIdx++;

						input.name = `input_${nextIdx + 1}`;
						if (node.outputs[i]) node.outputs[i].name = `output_${nextIdx + 1}`;
						localIndicesInUse.add(nextIdx);
					}
					else
					{
						localIndicesInUse.add(currentIdx);
					}
				}

				let nextBusIdx = 0;
				while (localIndicesInUse.has(nextBusIdx)) nextBusIdx++;

				node.addInput("input", ANY_TYPE as ISlotType);
				node.inputs[node.inputs.length - 1].name = `input_${nextBusIdx + 1}`;
				node.inputs[node.inputs.length - 1].label = "input";

				node.addOutput("output", ANY_TYPE as ISlotType);
				node.outputs[node.outputs.length - 1].name = `output_${nextBusIdx + 1}`;
				node.outputs[node.outputs.length - 1].label = "output";

				UpdateNodeSize(node, (node as any).__tojioo_dynamic_io_size_fixed || false);
				(node as any).__tojioo_dynamic_io_size_fixed = true;
			}

			function AssignBusTypeAndName(types: string[], i: number, node: any, inputNames: string[], outputNames: string[]): string
			{
				const currentType = types[i];

				if (node.inputs?.[i])
				{
					node.inputs[i].type = currentType;
					if (i === 0)
					{
						node.inputs[i].name = "bus";
					}
					else
					{
						let idx = i;
						if (node.inputs[i].name)
						{
							const m = node.inputs[i].name.match(/input_(\d+)/);
							if (m) idx = parseInt(m[1]);
						}
						node.inputs[i].name = `input_${idx}`;
					}
					node.inputs[i].label = inputNames[i];
				}
				if (node.outputs?.[i])
				{
					node.outputs[i].type = currentType;
					if (i === 0)
					{
						node.outputs[i].name = "bus";
					}
					else
					{
						let idx = i;
						if (node.outputs[i].name)
						{
							const m = node.outputs[i].name.match(/output_(\d+)/);
							if (m) idx = parseInt(m[1]);
						}
						node.outputs[i].name = `output_${idx}`;
					}
					node.outputs[i].label = outputNames[i];
				}
				return currentType;
			}

			function applyBusDynamicTypes(node: any): void
			{
				const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
				const busTypes = getSourceBusTypes(node) || {};

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

				const slotIdxToBusIdx = new Map<number, number>();
				const busIdxToSlotIdx = new Map<number, number>();
				for (let i = 1; i < count; i++)
				{
					const m = node.inputs[i]?.name?.match(/input_(\d+)/);
					if (m)
					{
						const busIdx = parseInt(m[1]) - 1;
						slotIdxToBusIdx.set(i, busIdx);
						busIdxToSlotIdx.set(busIdx, i);
					}
				}

				let maxIdx = -1;
				for (const idxStr of Object.keys(busTypes))
				{
					maxIdx = Math.max(maxIdx, parseInt(idxStr));
				}
				for (const busIdx of slotIdxToBusIdx.values())
				{
					maxIdx = Math.max(maxIdx, busIdx);
				}

				const orderedInputLabels: Record<number, string> = {};
				const orderedOutputLabels: Record<number, string> = {};

				for (let idx = 0; idx <= maxIdx; idx++)
				{
					const slotI = busIdxToSlotIdx.get(idx);
					const t = slotI !== undefined ? types[slotI] : busTypes[idx];

					if (!t) continue;

					const isTyped = t !== ANY_TYPE;
					const baseLabel = isTyped ? t.toLowerCase() : "input";
					const counterKey = isTyped ? t : "__untyped__";

					typeCounters[counterKey] = (typeCounters[counterKey] || 0) + 1;
					const occurrence = typeCounters[counterKey];
					const label = occurrence === 1 ? baseLabel : `${baseLabel}_${occurrence}`;

					if (slotI !== undefined)
					{
						orderedInputLabels[slotI] = label;
						orderedOutputLabels[slotI] = label;
					}
				}

				for (let i = 1; i < count; i++)
				{
					inputNames[i] = orderedInputLabels[i] || "input";
					outputNames[i] = orderedOutputLabels[i] || "output";
				}

				for (let i = 0; i < count; i++)
				{
					const currentType = AssignBusTypeAndName(types, i, node, inputNames, outputNames);

					if (i > 0 && currentType !== ANY_TYPE)
					{
						const inLink = GetInputLink(node, i);
						if (inLink)
						{
							inLink.type = currentType;
						}

						for (const linkId of node.outputs?.[i]?.links ?? [])
						{
							const link = GetLink(node, linkId);
							if (link)
							{
								link.type = currentType;
							}
						}
					}
				}

				const busInLink = GetInputLink(node, 0);
				if (busInLink)
				{
					busInLink.type = BUS_TYPE;
				}

				for (const linkId of node.outputs?.[0]?.links ?? [])
				{
					const link = GetLink(node, linkId);
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
						const m = node.inputs[i]?.name?.match(/input_(\d+)/);
						const busIdx = m ? parseInt(m[1]) - 1 : i - 1;
						(node.properties as any)._bus_slot_types[busIdx] = types[i];
					}
				}

				GetGraph(node)?.setDirtyCanvas?.(true, true);
				UpdateNodeSize(node);

				const busOutLinks = node.outputs?.[0]?.links;
				if (busOutLinks && busOutLinks.length > 0)
				{
					for (const linkId of busOutLinks)
					{
						const link = GetLink(node, linkId);
						if (link)
						{
							const targetNode = GetNodeById(node, link.target_id);
							if (targetNode && (targetNode as any).onBusChanged)
							{
								DeferMicrotask(() =>
								{
									(targetNode as any).onBusChanged();
								});
							}
						}
					}
				}
			}

			(nodeType.prototype as any).onBusChanged = function()
			{
				normalizeIO(this);
				applyBusDynamicTypes(this);
			};

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
						const link = link_info ?? GetInputLink(node, index);
						if (link)
						{
							const sourceNode = GetNodeById(node, link.origin_id);
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
									node.inputs[index].label = n;
								}
								if (node.outputs[index])
								{
									node.outputs[index].type = inferredType as ISlotType;
									node.outputs[index].label = n;
								}
								const linkId = (link_info as any)?.id ?? node.inputs?.[index]?.link;
								const linkObj = GetLink(node, linkId);
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
						const link = link_info ?? (linkId != null ? GetLink(node, linkId) : null);
						if (link)
						{
							const targetNode = GetNodeById(node, link.target_id);
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
									node.outputs[index].label = n;
								}
								if (node.inputs[index])
								{
									node.inputs[index].type = inferredType as ISlotType;
									node.inputs[index].label = n;
								}
								const linkObj = GetLink(node, linkId);
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
				(this as any).__tojioo_dynamic_io_size_fixed = false;
				DeferMicrotask(() =>
				{
					try
					{
						normalizeIO(this);
						applyBusDynamicTypes(this);
					}
					catch (e)
					{
						console.error("Tojioo.DynamicBus: error in configure", e);
					}
				});
				setTimeout(() =>
				{
					try
					{
						(this as any).__tojioo_dynamic_io_size_fixed = false;
						normalizeIO(this);
						applyBusDynamicTypes(this);
					}
					catch {}
				}, 100);
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function(this)
			{
				prevOnAdded?.apply(this, arguments as any);
				(this as any).__tojioo_dynamic_io_size_fixed = false;
				DeferMicrotask(() =>
				{
					try
					{
						normalizeIO(this);
						applyBusDynamicTypes(this);
					}
					catch (e)
					{
						console.error("Tojioo.DynamicBus: error in onAdded", e);
					}
				});
			};
		}
	};
}