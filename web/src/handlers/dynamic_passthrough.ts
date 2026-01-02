import {ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {ANY_TYPE, MAX_SOCKETS} from '@/types/tojioo.ts';
import {GetGraph, GetLink, GetLinkTypeFromEndpoints} from '@/utils/graph.ts';
import {ApplyDynamicTypes} from '@/utils/types.ts';
import {DeferMicrotask, IsGraphLoading, UpdateNodeSize} from '@/utils/lifecycle.ts';

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

				if (!(node as any).__tojioo_dynamic_io_rebuilt)
				{
					(node as any).__tojioo_dynamic_io_rebuilt = true;

					const hasAnyLinks =
						(node.inputs?.some((i: any) => i?.link != null)) ||
						(node.outputs?.some((o: any) => (o?.links?.length ?? 0) > 0));

					if (!hasAnyLinks)
					{
						while (node.inputs.length)
						{
							node.removeInput(node.inputs.length - 1);
						}
						while (node.outputs.length)
						{
							node.removeOutput(node.outputs.length - 1);
						}
					}
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

				while (node.inputs.length > desiredCount)
				{
					node.removeInput(node.inputs.length - 1);
				}
				while (node.outputs.length > desiredCount)
				{
					node.removeOutput(node.outputs.length - 1);
				}

				while (node.inputs.length < desiredCount)
				{
					node.addInput("input", ANY_TYPE as ISlotType);
					node.inputs[node.inputs.length - 1].label = "input";
				}
				while (node.outputs.length < desiredCount)
				{
					node.addOutput("output", ANY_TYPE as ISlotType);
					node.outputs[node.outputs.length - 1].label = "output";
				}

				UpdateNodeSize(node);
			}

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function(this: any, type: number, index: number, isConnected: boolean, link_info: any, inputOrOutput: any)
			{
				if (IsGraphLoading())
				{
					return;
				}

				if (prevOnConnectionsChange)
				{
					prevOnConnectionsChange.call(
						this,
						type,
						index,
						isConnected,
						link_info,
						inputOrOutput
					);
				}

				const node = this;

				// Handle input connection
				if (type === LiteGraph.INPUT && isConnected)
				{
					try
					{
						const g = GetGraph(node);
						const linkId = link_info?.id ?? node.inputs?.[index]?.link;
						const linkObj = link_info ?? (linkId != null ? GetLink(node, linkId) : null);
						const inferredType = GetLinkTypeFromEndpoints(node, linkObj);

						if (linkId != null && g?.links?.[linkId] && inferredType && inferredType !== ANY_TYPE)
						{
							g.links[linkId].type = inferredType;

							if (node.outputs?.[index])
							{
								node.outputs[index].type = inferredType as ISlotType;
								const n = inferredType.toLowerCase();
								node.outputs[index].name = n;
								node.outputs[index].label = n;

								if (node.inputs?.[index])
								{
									node.inputs[index].type = inferredType as ISlotType;
									node.inputs[index].name = n;
									node.inputs[index].label = n;
								}
							}
						}
					}
					catch (e)
					{
						console.error(e);
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
							node.removeInput(disconnectedIndex);
							node.removeOutput(disconnectedIndex);
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
				if (prevConfigure)
				{
					prevConfigure.call(this, info);
				}

				normalizeIO(this);
				ApplyDynamicTypes(this);

				setTimeout(() =>
				{
					ApplyDynamicTypes(this);
				}, 100);
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function(this: any)
			{
				if (prevOnAdded)
				{
					prevOnAdded.apply(this, arguments as any);
				}
				DeferMicrotask(() =>
				{
					normalizeIO(this);
					ApplyDynamicTypes(this);
				});
			};
		}
	}
}
