import {app} from "../../scripts/app.js";

const DYNAMIC_NODE_NAMES = new Set(
	[
		// Batch switches
		"PT_AnyImageBatchSwitch",
		"PT_AnyMaskBatchSwitch",
		"PT_AnyLatentBatchSwitch",
		"PT_AnyConditioningBatchSwitch",
		// First-valid switches
		"PT_AnyImageSwitch",
		"PT_AnyMaskSwitch",
		"PT_AnyLatentSwitch",
		"PT_AnyCLIPSwitch",
		"PT_AnyModelSwitch",
		"PT_AnyVAESwitch",
		"PT_AnyControlNetSwitch",
		"PT_AnySAMModelSwitch",
		"PT_AnyStringSwitch",
		"PT_AnyIntSwitch",
		"PT_AnyFloatSwitch",
		"PT_AnyBoolSwitch",
		// Dynamic passthrough (type follows connections)
		"PT_DynamicPassthrough"
	]
);

const INPUT_PREFIX_BY_NODE = {
	"PT_AnyImageBatchSwitch": "image_",
	"PT_AnyMaskBatchSwitch": "mask_",
	"PT_AnyLatentBatchSwitch": "latent_",
	"PT_AnyConditioningBatchSwitch": "cond_",
	"PT_AnyImageSwitch": "image_",
	"PT_AnyMaskSwitch": "mask_",
	"PT_AnyLatentSwitch": "latent_",
	"PT_AnyCLIPSwitch": "clip_",
	"PT_AnyModelSwitch": "model_",
	"PT_AnyVAESwitch": "vae_",
	"PT_AnyControlNetSwitch": "control_net_",
	"PT_AnySAMModelSwitch": "sam_model_",
	"PT_AnyStringSwitch": "text_",
	"PT_AnyIntSwitch": "int_",
	"PT_AnyFloatSwitch": "float_",
	"PT_AnyBoolSwitch": "boolean_"
};

function configureDynamicNode()
{
	return {
		name: "Tojioo.Passthrough.DynamicBatchInputs",

		async beforeRegisterNodeDef(nodeType, nodeData, app)
		{
			if (!DYNAMIC_NODE_NAMES.has(nodeData.name))
			{
				return;
			}

			const isGraphLoading = () => (new Error().stack ?? "").includes("loadGraphData");
			const defer = (fn) => setTimeout(fn, 0);

			if (nodeData.name === "PT_DynamicPassthrough")
			{
				const MAX_SOCKETS = 32;
				const ANY_TYPE = "*";

				function getGraph(node)
				{
					return node.graph || app.graph;
				}

				function getLink(node, linkId)
				{
					if (linkId == null) return null;
					const g = getGraph(node);
					return g?.links?.[linkId] ?? null;
				}

				function getNodeById(node, id)
				{
					const g = getGraph(node);
					return g?.getNodeById?.(id) ?? null;
				}

				function getLinkTypeFromEndpoints(node, link)
				{
					// Prefer origin output slot types
					const origin = getNodeById(node, link?.origin_id);
					const oSlot = link?.origin_slot;
					const originType = origin?.outputs?.[oSlot]?.type;
					if (originType && originType !== ANY_TYPE) return originType;

					// Fallback onto target input slot type
					const target = getNodeById(node, link?.target_id);
					const tSlot = link?.target_slot;
					const targetType = target?.inputs?.[tSlot]?.type;
					if (targetType && targetType !== ANY_TYPE) return targetType;

					// Fallback onto link.type if present
					const linkType = link?.type;
					if (linkType && linkType !== ANY_TYPE) return linkType;

					return ANY_TYPE;
				}

				function resolvePairType(node, zeroBasedIndex)
				{
					const out = node.outputs?.[zeroBasedIndex];
					const inp = node.inputs?.[zeroBasedIndex];

					// Prefer output constraint first
					const outLinkId = out?.links?.[0];
					const outLink = getLink(node, outLinkId);
					const outType = outLink ? getLinkTypeFromEndpoints(node, outLink) : ANY_TYPE;
					if (outType && outType !== ANY_TYPE) return outType;

					// Otherwise input constraint
					const inLinkId = inp?.link;
					const inLink = getLink(node, inLinkId);
					const inType = inLink ? getLinkTypeFromEndpoints(node, inLink) : ANY_TYPE;
					if (inType && inType !== ANY_TYPE) return inType;

					return ANY_TYPE;
				}

				function setLinkType(node, linkId, t)
				{
					const g = getGraph(node);
					const link = g?.links?.[linkId];
					if (!link) return;
					link.type = t;
				}

				function updateLinkTypesForSlot(node, zeroBasedIndex, t)
				{
					// Input side link (single)
					const inLinkId = node.inputs?.[zeroBasedIndex]?.link;
					if (inLinkId != null) setLinkType(node, inLinkId, t);

					// Output side links (can be many)
					const outLinks = node.outputs?.[zeroBasedIndex]?.links ?? [];
					for (const linkId of outLinks)
					{
						if (linkId != null) setLinkType(node, linkId, t);
					}
				}

				function computeTypedNames(node)
				{
					const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);

					// First pass, resolve types for each slot
					const types = [];
					for (let i = 0; i < count; i++)
					{
						types.push(resolvePairType(node, i));
					}

					// Second pass, assign names with per-type counters
					const typeCounters = {}; // type -> next number (starts at 1)
					const inputNames = [];
					const outputNames = [];

					for (let i = 0; i < count; i++)
					{
						const t = types[i];
						const isTyped = t && t !== ANY_TYPE;

						// Determine the base label
						let baseLabel;
						if (isTyped)
						{
							// Use lowercase type name as base
							baseLabel = t.toLowerCase();
						} else
						{
							baseLabel = "input"; // will use "output" for outputs
						}

						// Get or initialize counter for this type/label
						const counterKey = isTyped ? t : "__untyped__";
						if (typeCounters[counterKey] === undefined)
						{
							typeCounters[counterKey] = 1;
						}
						const occurrence = typeCounters[counterKey];
						typeCounters[counterKey]++;

						// Build the name: first occurrence has no number, subsequent get _2, _3, ...
						let inputName, outputName;
						if (occurrence === 1)
						{
							inputName = isTyped ? baseLabel : "input";
							outputName = isTyped ? baseLabel : "output";
						} else
						{
							inputName = isTyped ? `${baseLabel}_${occurrence}` : `input_${occurrence}`;
							outputName = isTyped ? `${baseLabel}_${occurrence}` : `output_${occurrence}`;
						}

						inputNames.push(inputName);
						outputNames.push(outputName);
					}

					return { types, inputNames, outputNames };
				}

				function applyTypesAndNames(node)
				{
					const { types, inputNames, outputNames } = computeTypedNames(node);

					for (let i = 0; i < types.length; i++)
					{
						const t = types[i];

						if (node.inputs?.[i])
						{
							node.inputs[i].type = t;
							node.inputs[i].name = inputNames[i];
						}
						if (node.outputs?.[i])
						{
							node.outputs[i].type = t;
							node.outputs[i].name = outputNames[i];
						}

						// Update link colors for typed connections
						if (t && t !== ANY_TYPE)
						{
							updateLinkTypesForSlot(node, i, t);
						}
					}

					const g = getGraph(node);
					g?.setDirtyCanvas?.(true, true);
					node.setSize(node.computeSize());
				}

				function normalizeIO(node)
				{
					if (!node.inputs) node.inputs = [];
					if (!node.outputs) node.outputs = [];

					// ComfyUI/LiteGraph pins the first slot from node definition.
					if (!node.__tojioo_dynamic_io_rebuilt)
					{
						node.__tojioo_dynamic_io_rebuilt = true;

						// Only rebuild when it's still in the "fresh" state (no links yet).
						const hasAnyLinks =
							(node.inputs?.some(i => i?.link != null)) ||
							(node.outputs?.some(o => (o?.links?.length ?? 0) > 0));

						if (!hasAnyLinks)
						{
							while (node.inputs.length) node.removeInput(node.inputs.length - 1);
							while (node.outputs.length) node.removeOutput(node.outputs.length - 1);
						}
					}

					// Find last connected input
					let lastConnectedInput = -1;
					for (let i = node.inputs.length - 1; i >= 0; i--)
					{
						if (node.inputs[i]?.link != null)
						{
							lastConnectedInput = i;
							break;
						}
					}

					// Find last connected output
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

					// Desired count = max of (last connected input, last connected output) + 1 trailing empty, min 1
					const lastConnected = Math.max(lastConnectedInput, lastConnectedOutput);
					const desiredCount = Math.min(MAX_SOCKETS, Math.max(1, lastConnected + 2));

					// Adjust inputs
					while (node.inputs.length > desiredCount)
					{
						node.removeInput(node.inputs.length - 1);
					}
					while (node.inputs.length < desiredCount)
					{
						node.addInput("input", ANY_TYPE); // temporary name, will be fixed by applyTypesAndNames
					}

					// Adjust outputs
					while (node.outputs.length > desiredCount)
					{
						node.removeOutput(node.outputs.length - 1);
					}
					while (node.outputs.length < desiredCount)
					{
						node.addOutput("output", ANY_TYPE); // temporary name
					}

					node.setSize(node.computeSize());
				}

				function compactAfterDisconnect(node, disconnectedIndex0)
				{
					if (!node.inputs || node.inputs.length === 0) return;

					// If it got reconnected (replace-link), don't compact
					if (node.inputs[disconnectedIndex0]?.link != null) return;

					let hasConnectionsAfter = false;
					for (let i = disconnectedIndex0 + 1; i < node.inputs.length; i++)
					{
						if (node.inputs[i]?.link != null)
						{
							hasConnectionsAfter = true;
							break;
						}
					}

					if (hasConnectionsAfter)
					{
						node.removeInput(disconnectedIndex0);
						node.removeOutput(disconnectedIndex0);
					}
				}

				const onConnectionsChange = nodeType.prototype.onConnectionsChange;
				nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info)
				{
					if (isGraphLoading()) return;

					if (onConnectionsChange)
					{
						onConnectionsChange.call(this, type, index, connected, link_info);
					}

					// INPUT side handling
					if (type === LiteGraph.INPUT)
					{
						const node = this;

						if (!connected)
						{
							// On input disconnect, compact slots then normalize and apply
							queueMicrotask(() =>
							{
								compactAfterDisconnect(node, index);
								normalizeIO(node);
								applyTypesAndNames(node);
							});
							return;
						}

						// On input connect, proactively set link.type from endpoints to stabilize type resolution
						try
						{
							const g = getGraph(node);
							const linkId = link_info?.id ?? node.inputs?.[index]?.link;
							const linkObj = link_info ?? (linkId != null ? getLink(node, linkId) : null);
							const inferredType = getLinkTypeFromEndpoints(node, linkObj);
							if (linkId != null && g?.links?.[linkId] && inferredType && inferredType !== ANY_TYPE)
							{
								g.links[linkId].type = inferredType;
							}
						}
						catch (e)
						{
							// ignore
						}

						// Defer both normalization and type/name application together
						queueMicrotask(() =>
						{
							normalizeIO(node);
							applyTypesAndNames(node);
						});
						return;
					}

					// OUTPUT side disconnect handling
					if (type === LiteGraph.OUTPUT && !connected)
					{
						const node = this;
						queueMicrotask(() =>
						{
							normalizeIO(node);
							applyTypesAndNames(node);
						});
						return;
					}

					// Other changes: normalize and apply together
					{
						const node = this;
						queueMicrotask(() =>
						{
							normalizeIO(node);
							applyTypesAndNames(node);
						});
					}
				};

				const onConfigure = nodeType.prototype.configure;
				nodeType.prototype.configure = function (info)
				{
					if (onConfigure)
					{
						onConfigure.call(this, info);
					}

					// Synchronous init so UI doesn't briefly show all 32 sockets
					normalizeIO(this);
					applyTypesAndNames(this);
				};

				// Ensure fresh nodes added from search/library are normalized before first render
				const onAdded = nodeType.prototype.onAdded;
				nodeType.prototype.onAdded = function ()
				{
					if (onAdded)
					{
						onAdded.apply(this, arguments);
					}
					normalizeIO(this);
					applyTypesAndNames(this);
				};

				return;
			}

			const inputPrefix = INPUT_PREFIX_BY_NODE[nodeData.name] || "input";

			function normalizeInputs(node)
			{
				if (!node.inputs || node.inputs.length === 0)
				{
					return;
				}

				// Trim trailing empty slots, keep one empty slot after last connected (min 1)
				let lastConnectedIndex = -1;
				for (let i = node.inputs.length - 1; i >= 0; i--)
				{
					if (node.inputs[i]?.link != null)
					{
						lastConnectedIndex = i;
						break;
					}
				}

				const keepCount = Math.max(1, lastConnectedIndex + 2);
				while (node.inputs.length > keepCount)
				{
					node.removeInput(node.inputs.length - 1);
				}

				// Renumber inputs
				let slotNumber = 1;
				for (let i = 0; i < node.inputs.length; i++)
				{
					const expectedName = `${inputPrefix}${slotNumber}`;
					if (node.inputs[i].name !== expectedName)
					{
						node.inputs[i].name = expectedName;
					}
					slotNumber++;
				}

				node.setSize(node.computeSize());
			}

			const onConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info)
			{
				// Skip during graph loading to avoid input name conflicts
				if (isGraphLoading()) return;

				// Let LiteGraph update the internal link state first
				if (onConnectionsChange)
				{
					onConnectionsChange.call(this, type, index, connected, link_info);
				}

				if (!link_info) return;
				if (type !== LiteGraph.INPUT)
				{
					return;
				}

				// Defer disconnect compaction to avoid breaking "replace link" operations
				if (!connected)
				{
					const node = this;
					queueMicrotask(() =>
					{
						if (!node.inputs || node.inputs.length === 0)
						{
							return;
						}

						// If it got reconnected as part of a replacement, do nothing
						if (node.inputs[index]?.link != null)
						{
							normalizeInputs(node);
							return;
						}

						// Only remove this slot if there are still connected inputs after it
						let hasConnectionsAfter = false;
						for (let i = index + 1; i < node.inputs.length; i++)
						{
							if (node.inputs[i]?.link != null)
							{
								hasConnectionsAfter = true;
								break;
							}
						}

						if (hasConnectionsAfter)
						{
							node.removeInput(index);
						}

						normalizeInputs(node);
					});
					return;
				}

				// Renumber and ensure a trailing empty slot exists on connection
				normalizeInputs(this);

				// Add a new slot if the user connected the last available slot
				const lastIndex = this.inputs.length - 1;
				if (index === lastIndex && this.inputs[lastIndex]?.link != null)
				{
					// Only add if there isn't already an empty trailing slot
					this.addInput(`${inputPrefix}${this.inputs.length + 1}`, this.inputs[0].type);
					normalizeInputs(this);
				}
			};

			// Fix inputs after a workflow is loaded or a node is duplicated using ALT+drag
			const onConfigure = nodeType.prototype.configure;
			nodeType.prototype.configure = function (info)
			{
				if (onConfigure)
				{
					onConfigure.call(this, info);
				}

				if (!this.inputs || this.inputs.length === 0)
				{
					return;
				}

				normalizeInputs(this);
			};
		}
	};
}

app.registerExtension(configureDynamicNode());