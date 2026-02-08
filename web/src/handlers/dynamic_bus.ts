import {DeferMicrotask, GetGraph, GetInputLink, GetLgInput, GetLgOutput, GetLink, GetNodeById, IsGraphLoading, UpdateNodeSize, UpdateNodeSizeImmediate} from '@/utils';
import {ComfyApp, ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {ANY_TYPE, BUS_TYPE} from '@/types/tojioo';
import {logger_internal} from '@/logger_internal.ts';

export function configureDynamicBus(): ComfyExtension
{
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicBus",
		beforeRegisterNodeDef: async (nodeType, nodeData: ComfyNodeDef, _app: ComfyApp): Promise<void> =>
		{
			if (nodeData.name !== "PT_DynamicBus")
			{
				return;
			}

			function getUpstreamBusTypes(node: any): Record<number, string>
			{
				const busInput = node.inputs?.[0];
				if (!busInput || busInput.link == null)
				{
					return {};
				}

				const link = GetInputLink(node, 0);
				if (!link)
				{
					return {};
				}

				const sourceNode = GetNodeById(node, link.origin_id);
				return (sourceNode?.properties as any)?._busTypes ?? {};
			}

			function getSlotType(node: any, slotIdx: number): string
			{
				const input = node.inputs?.[slotIdx];
				const output = node.outputs?.[slotIdx];

				if (input?.type && input.type !== ANY_TYPE && input.type !== -1)
				{
					return input.type;
				}
				if (output?.type && output.type !== ANY_TYPE && output.type !== -1)
				{
					return output.type;
				}

				return ANY_TYPE;
			}

			function generateLabels(types: Record<number, string>): Record<number, string>
			{
				const sorted = Object.entries(types)
					.map(([k, v]) => ({idx: Number(k), type: v}))
					.sort((a, b) => a.idx - b.idx);

				const counters: Record<string, number> = {};
				const labels: Record<number, string> = {};

				for (const entry of sorted)
				{
					const isTyped = entry.type !== ANY_TYPE;
					const base = isTyped ? entry.type.toLowerCase() : "value";
					const key = isTyped ? entry.type : "__any__";

					counters[key] = (counters[key] || 0) + 1;
					labels[entry.idx] = counters[key] === 1 ? base : `${base}_${counters[key]}`;
				}

				return labels;
			}

			function buildSlotTypes(node: any): string
			{
				const types: string[] = [];

				for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++)
				{
					const input = node.inputs[slotIdx];
					if (input?.link != null)
					{
						const type = input.type && input.type !== ANY_TYPE && input.type !== -1
							? input.type
							: ANY_TYPE;
						types.push(`${slotIdx}:${type}`);
					}
				}

				return types.join(",");
			}

			function buildOutputHints(node: any): string
			{
				const hints: string[] = [];

				for (let slotIdx = 1; slotIdx < node.outputs.length; slotIdx++)
				{
					const out = node.outputs[slotIdx];
					const hasOutputLink = (out?.links?.length ?? 0) > 0;

					if (!hasOutputLink)
					{
						continue;
					}

					const hasInputLink = node.inputs[slotIdx]?.link != null;
					let expectedType = ANY_TYPE;

					if (!hasInputLink)
					{
						const linkId = out.links[0];
						const link = GetLink(node, linkId);
						if (link)
						{
							const targetNode = GetNodeById(node, link.target_id);
							const targetSlot = targetNode?.inputs?.[link.target_slot];
							if (targetSlot?.type && targetSlot.type !== ANY_TYPE && targetSlot.type !== -1)
							{
								expectedType = targetSlot.type;
							}
						}
					}
					else
					{
						expectedType = getSlotType(node, slotIdx);
					}

					hints.push(`${slotIdx}:${expectedType}:${hasInputLink ? 1 : 0}`);
				}

				return hints.join(",");
			}

			function findOrCreateWidget(node: any, name: string): any
			{
				if (!node.widgets)
				{
					node.widgets = [];
				}

				let widget = node.widgets.find((w: any) => w.name === name);
				if (!widget)
				{
					widget = {
						name: name,
						type: "hidden",
						value: "",
						options: {serialize: true},
						computeSize: () => [0, -4],
					};
					node.widgets.push(widget);
				}
				else
				{
					widget.type = "hidden";
					widget.computeSize = () => [0, -4];
				}
				return widget;
			}

			function resetNodeToCleanState(node: any): void
			{
				for (let i = 1; i < node.inputs?.length; i++)
				{
					if (node.inputs[i])
					{
						node.inputs[i].type = ANY_TYPE as ISlotType;
						node.inputs[i].label = "input";
					}
				}
				for (let i = 1; i < node.outputs?.length; i++)
				{
					if (node.outputs[i])
					{
						node.outputs[i].type = ANY_TYPE as ISlotType;
						node.outputs[i].label = "output";
					}
				}

				while (node.inputs.length > 1)
				{
					node.removeInput(node.inputs.length - 1);
				}
				while (node.outputs.length > 1)
				{
					node.removeOutput(node.outputs.length - 1);
				}

				node.addInput?.("input", ANY_TYPE as ISlotType);
				node.inputs[1].name = "input_1";
				node.inputs[1].label = "input";
				node.inputs[1].type = ANY_TYPE as ISlotType;

				node.addOutput?.("output", ANY_TYPE as ISlotType);
				node.outputs[1].name = "output_1";
				node.outputs[1].label = "output";
				node.outputs[1].type = ANY_TYPE as ISlotType;

				const slotTypesWidget = node.widgets?.find((w: any) => w.name === "_slot_types");
				if (slotTypesWidget)
				{
					slotTypesWidget.value = "";
				}

				const outputHintsWidget = node.widgets?.find((w: any) => w.name === "_output_hints");
				if (outputHintsWidget)
				{
					outputHintsWidget.value = "";
				}

				if (node.properties)
				{
					(node.properties as any)._busTypes = {};
				}
			}

			function synchronize(node: any, serializedInfo?: any): void
			{
				if (!node.inputs)
				{
					node.inputs = [];
				}
				if (!node.outputs)
				{
					node.outputs = [];
				}

				const upstreamTypes = getUpstreamBusTypes(node);

				if (node.inputs.length === 0)
				{
					node.addInput?.("bus", BUS_TYPE as ISlotType);
				}
				else
				{
					node.inputs[0].name = "bus";
					node.inputs[0].label = "bus";
					node.inputs[0].type = BUS_TYPE as ISlotType;
				}

				if (node.outputs.length === 0)
				{
					node.addOutput?.("bus", BUS_TYPE as ISlotType);
				}
				else
				{
					node.outputs[0].name = "bus";
					node.outputs[0].label = "bus";
					node.outputs[0].type = BUS_TYPE as ISlotType;
				}

				let maxNeededSlot = 0;

				const maxLen = Math.max(
					node.inputs.length,
					node.outputs.length,
					serializedInfo?.inputs?.length ?? 0,
					serializedInfo?.outputs?.length ?? 0
				);

				for (let slotIdx = 1; slotIdx < maxLen; slotIdx++)
				{
					const hasInput = node.inputs[slotIdx]?.link != null;
					const hasOutput = (node.outputs[slotIdx]?.links?.length ?? 0) > 0;
					const hadSerializedInput = serializedInfo?.inputs?.[slotIdx]?.link != null;
					const hadSerializedOutput = (serializedInfo?.outputs?.[slotIdx]?.links?.length ?? 0) > 0;

					if (hasInput || hasOutput || hadSerializedInput || hadSerializedOutput)
					{
						maxNeededSlot = Math.max(maxNeededSlot, slotIdx);
					}
				}

				const targetCount = maxNeededSlot + 2;

				while (node.inputs.length > targetCount)
				{
					const lastIdx = node.inputs.length - 1;
					const hasLiveLink = node.inputs[lastIdx]?.link != null;
					const hasSerializedLink = serializedInfo?.inputs?.[lastIdx]?.link != null;
					if (hasLiveLink || hasSerializedLink)
					{
						break;
					}
					node.removeInput?.(lastIdx);
				}

				while (node.outputs.length > targetCount)
				{
					const lastIdx = node.outputs.length - 1;
					const hasLiveLinks = (node.outputs[lastIdx]?.links?.length ?? 0) > 0;
					const hasSerializedLinks = (serializedInfo?.outputs?.[lastIdx]?.links?.length ?? 0) > 0;
					if (hasLiveLinks || hasSerializedLinks)
					{
						break;
					}
					node.removeOutput?.(lastIdx);
				}

				while (node.inputs.length < targetCount)
				{
					const slotIdx = node.inputs.length;
					node.addInput?.("input", ANY_TYPE as ISlotType);
					node.inputs[slotIdx].name = `input_${slotIdx}`;
				}

				while (node.outputs.length < targetCount)
				{
					const slotIdx = node.outputs.length;
					node.addOutput?.("output", ANY_TYPE as ISlotType);
					node.outputs[slotIdx].name = `output_${slotIdx}`;
				}

				// Restore types from serialized info for output-only slots
				if (serializedInfo?.outputs)
				{
					for (let slotIdx = 1; slotIdx < node.outputs.length; slotIdx++)
					{
						const serializedOut = serializedInfo.outputs[slotIdx];
						if (serializedOut?.type && serializedOut.type !== ANY_TYPE && serializedOut.type !== -1)
						{
							if (node.outputs[slotIdx])
							{
								node.outputs[slotIdx].type = serializedOut.type as ISlotType;
							}
							if (node.inputs[slotIdx])
							{
								node.inputs[slotIdx].type = serializedOut.type as ISlotType;
							}
						}
					}
				}

				const slotTypes: Record<number, string> = {};

				for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++)
				{
					const type = getSlotType(node, slotIdx);
					if (type !== ANY_TYPE)
					{
						slotTypes[slotIdx] = type;
					}
				}

				const labels = generateLabels(slotTypes);

				for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++)
				{
					const type = slotTypes[slotIdx] || ANY_TYPE;

					if (node.inputs[slotIdx])
					{
						node.inputs[slotIdx].name = `input_${slotIdx}`;
						node.inputs[slotIdx].label = labels[slotIdx] || "input";
						node.inputs[slotIdx].type = type as ISlotType;
					}

					if (node.outputs[slotIdx])
					{
						node.outputs[slotIdx].name = `output_${slotIdx}`;
						node.outputs[slotIdx].label = labels[slotIdx] || "output";
						node.outputs[slotIdx].type = type as ISlotType;
					}

					const inLink = GetInputLink(node, slotIdx);
					if (inLink && type !== ANY_TYPE)
					{
						inLink.type = type;
					}

					for (const linkId of node.outputs[slotIdx]?.links ?? [])
					{
						const link = GetLink(node, linkId);
						if (link && type !== ANY_TYPE)
						{
							link.type = type;
						}
					}
				}

				if (!node.properties)
				{
					node.properties = {};
				}

				const combinedTypes: Record<number, string> = {...upstreamTypes};
				let nextIdx = Math.max(-1, ...Object.keys(upstreamTypes).map(Number)) + 1;

				for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++)
				{
					if (node.inputs[slotIdx]?.link != null)
					{
						combinedTypes[nextIdx] = slotTypes[slotIdx] || ANY_TYPE;
						nextIdx++;
					}
				}

				(node.properties as any)._busTypes = combinedTypes;

				const slotTypesWidget = findOrCreateWidget(node, "_slot_types");
				slotTypesWidget.value = buildSlotTypes(node);

				const outputHintsWidget = findOrCreateWidget(node, "_output_hints");
				outputHintsWidget.value = buildOutputHints(node);

				const busOutLinks = node.outputs?.[0]?.links;
				if (busOutLinks?.length)
				{
					for (const linkId of busOutLinks)
					{
						const link = GetLink(node, linkId);
						if (link)
						{
							const targetNode = GetNodeById(node, link.target_id);
							if (targetNode && (targetNode as any).onBusChanged)
							{
								DeferMicrotask(() => (targetNode as any).onBusChanged());
							}
						}
					}
				}

				GetGraph(node)?.setDirtyCanvas?.(true, true);
				UpdateNodeSize(node);
			}

			(nodeType.prototype as any).onBusChanged = function()
			{
				synchronize(this);
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
				const LG_INPUT = GetLgInput();
				const LG_OUTPUT = GetLgOutput();

				if (isConnected && index > 0)
				{
					try
					{
						if (type === LG_INPUT)
						{
							const link = link_info ?? GetInputLink(node, index);
							if (link)
							{
								const sourceNode = GetNodeById(node, link.origin_id);
								const sourceSlot = sourceNode?.outputs?.[link.origin_slot];
								if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE && sourceSlot.type !== -1)
								{
									if (node.inputs[index])
									{
										node.inputs[index].type = sourceSlot.type as ISlotType;
									}
									if (node.outputs[index])
									{
										node.outputs[index].type = sourceSlot.type as ISlotType;
									}
								}
							}
						}
						else if (type === LG_OUTPUT)
						{
							const linkId = (link_info as any)?.id;
							const link = link_info ?? (linkId != null ? GetLink(node, linkId) : null);
							if (link)
							{
								const targetNode = GetNodeById(node, link.target_id);
								const targetSlot = targetNode?.inputs?.[link.target_slot];
								if (targetSlot?.type && targetSlot.type !== ANY_TYPE && targetSlot.type !== -1)
								{
									if (node.outputs[index])
									{
										node.outputs[index].type = targetSlot.type as ISlotType;
									}
									if (node.inputs[index])
									{
										node.inputs[index].type = targetSlot.type as ISlotType;
									}
								}
							}
						}
					}
					catch
					{
					}
				}

				DeferMicrotask(() => synchronize(node));
			};

			const prevConfigure = nodeType.prototype.configure;
			nodeType.prototype.configure = function(this, info)
			{
				prevConfigure?.call(this, info);

				const node = this;

				DeferMicrotask(() =>
				{
					try
					{
						const graph = GetGraph(node);

						const hasOrphanedLinks = info.inputs?.some((inp: any) =>
							inp.link != null && (!graph?.links || !graph.links[inp.link])
						);

						const hasTypedUnconnectedSlots = info.inputs?.slice(1).some((inp: any, idx: number) =>
						{
							const slotIdx = idx + 1;
							const hasType = inp.type && inp.type !== ANY_TYPE && inp.type !== -1;
							const hasInputLink = inp.link != null;
							const hasOutputLink = (info.outputs?.[slotIdx]?.links?.length ?? 0) > 0;
							return hasType && !hasInputLink && !hasOutputLink;
						});

						if (hasOrphanedLinks || hasTypedUnconnectedSlots)
						{
							resetNodeToCleanState(node);
							synchronize(node);
						}
						else
						{
							synchronize(node, info);
						}
					}
					catch (e)
					{
						logger_internal.error("DynamicBus configure error", e);
					}
				});

				setTimeout(() =>
				{
					try
					{
						synchronize(this);
						UpdateNodeSizeImmediate(this);
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
				DeferMicrotask(() =>
				{
					try
					{
						synchronize(this);
					}
					catch (e)
					{
						logger_internal.error("DynamicBus onAdded error", e);
					}
				});
			};
		}
	};
}