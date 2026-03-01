import {connectPending, consumePendingConnection, DeferMicrotask, GetGraph, GetInputLink, GetLgInput, GetLgOutput, GetLink, GetNodeById, IsGraphLoading, UpdateNodeSize, UpdateNodeSizeImmediate} from '@/utils';
import {ComfyApp, ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {ANY_TYPE, BUS_TYPE} from '@/types/tojioo';
import {getBusOverwriteMode} from '@/settings';
import {loggerInstance} from '@/logger_internal';

// Scoped log
const log = loggerInstance("DynamicBus");

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
					busInput.link = null;
					return {};
				}

				const sourceNode = GetNodeById(node, link.origin_id);
				if (!sourceNode)
				{
					busInput.link = null;
					return {};
				}

				return (sourceNode.properties as any)?._busTypes ?? {};
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
				if (node._syncing)
				{
					return;
				}
				node._syncing = true;
				try
				{
					// entire existing body
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

					// Stale link references can survive workflow serialization
					if (node.inputs[0]?.link != null)
					{
						const busLink = GetInputLink(node, 0);
						if (!busLink || !GetNodeById(node, busLink.origin_id))
						{
							node.inputs[0].link = null;
						}
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

					// Clear stale link references from data slots
					for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++)
					{
						if (node.inputs[slotIdx]?.link != null)
						{
							const link = GetInputLink(node, slotIdx);
							if (!link || !GetNodeById(node, link.origin_id))
							{
								node.inputs[slotIdx].link = null;
							}
						}
					}

					// Clear stale types from slots with no live connections
					for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++)
					{
						const hasInput = node.inputs[slotIdx]?.link != null;
						const outputLinkIds = node.outputs[slotIdx]?.links ?? [];
						const hasOutput = outputLinkIds.some((linkId: number) => GetLink(node, linkId) != null);

						if (!hasInput && !hasOutput)
						{
							if (node.inputs[slotIdx])
							{
								node.inputs[slotIdx].type = ANY_TYPE as ISlotType;
							}
							if (node.outputs[slotIdx])
							{
								node.outputs[slotIdx].type = ANY_TYPE as ISlotType;
							}
						}
					}

					// Compact gaps: remove empty slots that have connections after them
					if (!serializedInfo)
					{
						for (let slotIdx = node.inputs.length - 2; slotIdx >= 1; slotIdx--)
						{
							const hasInput = node.inputs[slotIdx]?.link != null;
							const outputLinkIds = node.outputs[slotIdx]?.links ?? [];
							const hasOutput = outputLinkIds.some((linkId: number) =>
							{
								const link = GetLink(node, linkId);
								if (!link)
								{
									return false;
								}
								const targetNode = GetNodeById(node, link.target_id);
								if (!targetNode)
								{
									return false;
								}
								return targetNode.inputs?.[link.target_slot]?.link === linkId;
							});

							if (hasInput || hasOutput)
							{
								continue;
							}

							let hasConnectionsAfter = false;
							for (let i = slotIdx + 1; i < Math.max(node.inputs.length, node.outputs.length); i++)
							{
								const laterInput = node.inputs[i]?.link != null;
								const laterOutputIds = node.outputs[i]?.links ?? [];
								const laterOutput = laterOutputIds.some((id: number) =>
								{
									const link = GetLink(node, id);
									if (!link)
									{
										return false;
									}
									const target = GetNodeById(node, link.target_id);
									if (!target)
									{
										return false;
									}
									return target.inputs?.[link.target_slot]?.link === id;
								});

								if (laterInput || laterOutput)
								{
									hasConnectionsAfter = true;
									break;
								}
							}

							if (hasConnectionsAfter)
							{
								node.removeInput?.(slotIdx);
								node.removeOutput?.(slotIdx);
							}
						}
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

					const isOverwriteEnabled = getBusOverwriteMode();
					log.debug('Overwrite is set to: ', isOverwriteEnabled);

					const combinedTypes: Record<number, string> = {...upstreamTypes};
					let nextIdx = Math.max(-1, ...Object.keys(upstreamTypes).map(Number)) + 1;
					const usedUpstreamIndices = new Set<number>();

					for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++)
					{
						if (node.inputs[slotIdx]?.link == null)
						{
							continue;
						}

						const localType = slotTypes[slotIdx] || ANY_TYPE;

						if (isOverwriteEnabled && localType !== ANY_TYPE)
						{
							const matchIdx = Object.keys(combinedTypes)
								.map(Number)
								.sort((a, b) => a - b)
								.find(idx => !usedUpstreamIndices.has(idx) && combinedTypes[idx] === localType);

							if (matchIdx !== undefined)
							{
								usedUpstreamIndices.add(matchIdx);
								continue;
							}
						}

						combinedTypes[nextIdx] = localType;
						nextIdx++;
					}

					(node.properties as any)._busTypes = combinedTypes;

					const slotTypesWidget = findOrCreateWidget(node, "_slot_types");
					slotTypesWidget.value = buildSlotTypes(node);

					const outputHintsWidget = findOrCreateWidget(node, "_output_hints");
					outputHintsWidget.value = buildOutputHints(node);

					const overwriteWidget = findOrCreateWidget(node, "_overwrite_mode");
					overwriteWidget.value = isOverwriteEnabled ? "1" : "0";

					const busOutLinks = node.outputs?.[0]?.links;
					if (busOutLinks?.length)
					{
						for (const linkId of busOutLinks)
						{
							const link = GetLink(node, linkId);
							if (link)
							{
								const targetNode = GetNodeById(node, link.target_id);
								if (targetNode && (targetNode as any).onBusChanged && !(targetNode as any)._busChangeScheduled)
								{
									(targetNode as any)._busChangeScheduled = true;
									DeferMicrotask(() =>
									{
										(targetNode as any)._busChangeScheduled = false;
										(targetNode as any).onBusChanged();
									});
								}
							}
						}
					}

					GetGraph(node)?.setDirtyCanvas?.(true, true);
					UpdateNodeSize(node);
				}
				finally
				{
					node._syncing = false;
				}
			}

			(nodeType.prototype as any).onBusChanged = function()
			{
				synchronize(this);
			};

			nodeType.prototype.onConnectInput = function(
				this: any,
				targetSlot: number,
				_type: ISlotType,
				_output: any,
				_sourceNode: any,
				_sourceSlot: number
			): boolean
			{
				return !(targetSlot === 0 && String(_type) !== BUS_TYPE);

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
					if (String(type) === BUS_TYPE)
					{
						if (this.inputs[0]?.link == null)
						{
							return returnObj ? this.inputs[0] : 0;
						}
					}
					else
					{
						for (let i = 1; i < this.inputs.length; i++)
						{
							if (this.inputs[i]?.link == null)
							{
								return returnObj ? this.inputs[i] : i;
							}
						}
					}
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

				if (!isConnected && index > 0)
				{
					DeferMicrotask(() => synchronize(node));
					return;
				}

				DeferMicrotask(() => synchronize(node));
			};

			const prevConfigure = nodeType.prototype.configure;
			nodeType.prototype.configure = function(this, info)
			{
				prevConfigure?.call(this, info);

				const node = this;

				// Todo: Move from down ther up here
				/*DeferMicrotask(() =>
				{
					try
					{*/
				// Stale link cleanup — deferred so subgraph links are fully registered
				for (let i = 0; i < (node.inputs?.length ?? 0); i++)
				{
					if (node.inputs[i]?.link != null)
					{
						const link = GetInputLink(node, i);
						if (!link || !GetNodeById(node, link.origin_id))
						{
							node.inputs[i].link = null;
						}
					}
				}

				// Todo: Move this up there
				DeferMicrotask(() =>
				{
					try
					{
						const hasTypedUnconnectedSlots = info.inputs?.slice(1).some((inp: any, idx: number) =>
						{
							const slotIdx = idx + 1;
							const hasType = inp.type && inp.type !== ANY_TYPE && inp.type !== -1;
							const hasInputLink = inp.link != null;
							const hasOutputLink = (info.outputs?.[slotIdx]?.links?.length ?? 0) > 0;
							return hasType && !hasInputLink && !hasOutputLink;
						});

						if (hasTypedUnconnectedSlots)
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
						log.error("error in configure", e);
					}
				});

				setTimeout(() =>
				{
					try
					{
						synchronize(this, info);
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

				const pending = consumePendingConnection();

				DeferMicrotask(() =>
				{
					try
					{
						synchronize(this);
					}
					catch (e)
					{
						log.error("error in onAdded", e);
					}

					connectPending(this, pending, (i, type) => type === BUS_TYPE ? i === 0 : i > 0);
				});
			};
		}
	};
}