import {consumePendingConnection, DeferMicrotask, GetGraph, GetInputLink, GetLgInput, GetLink, GetLinkTypeFromEndpoints, IsGraphLoading, IsNodes2Mode, UpdatePreviewNodeSize} from '@/utils';
import {ComfyApp, ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {ANY_TYPE, MAX_SOCKETS} from '@/types/tojioo';
import logger_internal, {loggerInstance} from '@/logger_internal';

type PreviewItem = | { type: "image"; element: HTMLImageElement } | { type: "text"; text: string };
const defaultLabel = "input";

// Scoped log
const log = loggerInstance("DynamicPreview");

export function configureDynamicPreview(): ComfyExtension
{
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicPreview",
		beforeRegisterNodeDef: async (nodeType, nodeData: ComfyNodeDef, _app: ComfyApp): Promise<void> =>
		{
			if (nodeData?.name !== "PT_DynamicPreview")
			{
				return;
			}

			(nodeType.prototype as any)._currentImageIndex = 0;
			(nodeType.prototype as any)._previewItems = [] as PreviewItem[];
			(nodeType.prototype as any)._totalImages = 0;

			function normalizeInputs(node: any): void
			{
				if (!node.inputs)
				{
					node.inputs = [];
				}

				if (!(node as any).__tojioo_dynamic_io_rebuilt)
				{
					(node as any).__tojioo_dynamic_io_rebuilt = true;
					const hasAnyLinks = node.inputs?.some((i: any) => i?.link != null);
					if (!hasAnyLinks && typeof node.removeInput === "function")
					{
						while (node.inputs.length)
						{
							node.removeInput(node.inputs.length - 1);
						}
					}
				}

				let lastConnectedIndex = -1;
				for (let i = node.inputs.length - 1; i >= 0; i--)
				{
					if (node.inputs[i]?.link != null)
					{
						lastConnectedIndex = i;
						break;
					}
				}

				const desiredCount = Math.min(MAX_SOCKETS, Math.max(1, lastConnectedIndex + 2));

				while (node.inputs.length > desiredCount && typeof node.removeInput === "function")
				{
					node.removeInput(node.inputs.length - 1);
				}
				while (node.inputs.length < desiredCount && typeof node.addInput === "function")
				{
					node.addInput(defaultLabel, ANY_TYPE);
					node.inputs[node.inputs.length - 1].label = defaultLabel;
				}

				UpdatePreviewNodeSize(node);
			}

			function applyDynamicTypes(node: any): void
			{
				if (!node.inputs?.length)
				{
					return;
				}

				const types: string[] = [];
				const typeCounters: Record<string, number> = {};

				for (let i = 0; i < node.inputs.length; i++)
				{
					const link = GetInputLink(node, i);
					let resolvedType = ANY_TYPE;
					if (link)
					{
						const t = GetLinkTypeFromEndpoints(node, link);
						if (t !== ANY_TYPE)
						{
							resolvedType = t;
						}
					}
					types.push(resolvedType);
				}

				for (let i = 0; i < node.inputs.length; i++)
				{
					const inp = node.inputs[i];
					const t = types[i];
					const isTyped = t !== ANY_TYPE;

					inp.type = t;

					let label: string;
					if (isTyped)
					{
						const baseLabel = t.toLowerCase();
						typeCounters[t] = (typeCounters[t] ?? 0) + 1;
						label = typeCounters[t] === 1 ? baseLabel : `${baseLabel}_${typeCounters[t]}`;
					}
					else
					{
						typeCounters["__untyped__"] = (typeCounters["__untyped__"] ?? 0) + 1;
						const n = typeCounters["__untyped__"];
						label = n === 1 ? defaultLabel : `${defaultLabel}_${n}`;
					}
					inp.name = `${defaultLabel}_${i + 1}`;
					inp.label = label;
				}

				GetGraph(node)?.setDirtyCanvas?.(true, true);
			}

			function createPreviewWidget(node: any): void
			{
				if (node._previewContainer)
				{
					return;
				}

				const container = document.createElement("div");
				Object.assign(container.style, {
					display: "flex",
					flexDirection: "column",
					width: "100%",
					height: "100%",
					overflow: "hidden",
					background: "transparent"
				});

				const tabBar = document.createElement("div");
				Object.assign(tabBar.style, {
					display: "none",
					flexDirection: "row",
					justifyContent: "center",
					gap: "4px",
					padding: "4px 8px 0 8px",
					marginBottom: "6px",
					flexShrink: "0",
					overflowX: "hidden",
					overflowY: "hidden",
					scrollbarWidth: "thin",
					scrollbarColor: "rgba(255,255,255,0.3) transparent"
				});

				const content = document.createElement("div");
				Object.assign(content.style, {
					flex: "1",
					overflow: "hidden",
					position: "relative",
					minHeight: "60px"
				});

				container.appendChild(tabBar);
				container.appendChild(content);

				node._previewContainer = container;
				node._previewTabBar = tabBar;
				node._previewContent = content;

				if (typeof node.addDOMWidget === "function")
				{
					node._previewWidget = node.addDOMWidget("preview_display", "customtext", container, {
						serialize: false
					});
				}

				new ResizeObserver(() => updateTabBarOverflow(node)).observe(tabBar);
			}

			function updateTabBarOverflow(node: any): void
			{
				const tabBar = node._previewTabBar as HTMLElement | undefined;
				if (!tabBar || tabBar.style.display === "none" || !tabBar.children.length)
				{
					return;
				}

				const gap = 4;
				let totalWidth = 0;
				for (let c = 0; c < tabBar.children.length; c++)
				{
					totalWidth += (tabBar.children[c] as HTMLElement).offsetWidth;
				}
				totalWidth += gap * Math.max(0, tabBar.children.length - 1);
				const availableWidth = tabBar.clientWidth - 16;

				if (totalWidth > availableWidth)
				{
					tabBar.style.justifyContent = "flex-start";
					tabBar.style.overflowX = "scroll";
				}
				else
				{
					tabBar.style.justifyContent = "center";
					tabBar.style.overflowX = "hidden";
				}
			}

			function updatePreviewDisplay(node: any): void
			{
				const content = node._previewContent as HTMLElement | undefined;
				const tabBar = node._previewTabBar as HTMLElement | undefined;
				if (!content || !tabBar)
				{
					return;
				}

				const items: PreviewItem[] = node._previewItems ?? [];
				const total = node._totalImages ?? 0;

				if (!items.length || total === 0)
				{
					content.innerHTML = "";
					tabBar.style.display = "none";
					return;
				}

				if (total >= 2)
				{
					tabBar.style.display = "flex";
					tabBar.innerHTML = "";
					for (let i = 0; i < total; i++)
					{
						const tab = document.createElement("button");
						tab.textContent = String(i + 1);
						const selected = i === node._currentImageIndex;
						Object.assign(tab.style, {
							padding: "2px 10px",
							border: selected ? "1px solid rgba(80, 120, 200, 0.9)" : "1px solid transparent",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "12px",
							fontFamily: "Arial, sans-serif",
							background: selected ? "rgba(80, 120, 200, 0.9)" : "rgba(60, 60, 60, 0.8)",
							color: selected ? "#fff" : "#aaa",
							outline: "none",
							lineHeight: "1.4",
							flexShrink: "0"
						});
						const idx = i;
						tab.addEventListener("click", () =>
						{
							node._currentImageIndex = idx;
							updatePreviewDisplay(node);
						});
						tabBar.appendChild(tab);
					}

					if (!(tabBar as any)._hasWheelHandler)
					{
						tabBar.addEventListener("wheel", (e: WheelEvent) =>
						{
							if (tabBar.scrollWidth > tabBar.clientWidth)
							{
								e.preventDefault();
								e.stopPropagation();
								tabBar.scrollLeft += e.deltaY;
							}
						}, {passive: false});
						(tabBar as any)._hasWheelHandler = true;
					}

					requestAnimationFrame(() => updateTabBarOverflow(node));
				}
				else
				{
					tabBar.style.display = "none";
				}

				const itemIdx = Math.min(node._currentImageIndex, items.length - 1);
				const item = items[itemIdx];
				content.innerHTML = "";

				if (!item)
				{
					return;
				}

				if (item.type === "image")
				{
					Object.assign(content.style, {
						overflow: "hidden",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						padding: "0"
					});

					const img = item.element.cloneNode(true) as HTMLImageElement;
					Object.assign(img.style, {
						maxWidth: "100%",
						maxHeight: "100%",
						objectFit: "contain"
					});
					content.appendChild(img);
				}
				else if (item.type === "text")
				{
					Object.assign(content.style, {
						overflow: "hidden",
						display: "flex",
						alignItems: "stretch",
						justifyContent: "stretch",
						padding: "0"
					});

					const textarea = document.createElement("textarea");
					textarea.readOnly = true;
					textarea.value = item.text;
					Object.assign(textarea.style, {
						width: "100%",
						height: "100%",
						resize: "none",
						boxSizing: "border-box"
					});
					textarea.classList.add("comfy-multiline-input");
					content.appendChild(textarea);
				}
			}

			function resetPreviewState(node: any): void
			{
				node._currentImageIndex = 0;
				node._previewItems = [];
				node._totalImages = 0;
				updatePreviewDisplay(node);
			}

			(nodeType.prototype as any).selectImage = function(this: any, index: number): void
			{
				if (index < 0 || index >= this._totalImages)
				{
					return;
				}
				this._currentImageIndex = index;
				updatePreviewDisplay(this);
			};

			nodeType.prototype.onConnectInput = function(
				this: any,
				_targetSlot: number,
				_type: ISlotType,
				_output: any,
				_sourceNode: any,
				_sourceSlot: number
			): boolean
			{
				log.debug(`${_sourceNode.properties["Node name for S&R"]} called onConnectInput with type ${_type}`);
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
				logger_internal.debug("findInputSlotByType called", type);
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

			const prevOnDrawForeground = nodeType.prototype.onDrawForeground;
			nodeType.prototype.onDrawForeground = function(ctx, canvas, canvasElement)
			{
				prevOnDrawForeground?.call(this, ctx, canvas, canvasElement);
				if (!ctx || IsNodes2Mode())
				{
					return;
				}
			};

			const prevOnExecuted = (nodeType.prototype as any).onExecuted;
			(nodeType.prototype as any).onExecuted = function(message: any)
			{
				logger_internal.debug("onExecuted", message);
				prevOnExecuted?.call(this, message);

				const node = this as any;
				node.imgs = null;

				const images: any[] = message?.preview_data ?? [];
				const textEntries: any[] = message?.text_data ?? [];

				const previewItems: PreviewItem[] = [];
				const slotContent = new Map<number, PreviewItem[]>();

				for (const imgInfo of images)
				{
					const slot = imgInfo.slot ?? 0;
					if (!slotContent.has(slot))
					{
						slotContent.set(slot, []);
					}
					const img = new Image();
					img.src = `/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(
						imgInfo.subfolder || "")}&type=${encodeURIComponent(imgInfo.type || "output")}`;
					slotContent.get(slot)!.push({type: "image", element: img});
				}

				for (const entry of textEntries)
				{
					const slot = entry.slot ?? 0;
					if (!slotContent.has(slot))
					{
						slotContent.set(slot, []);
					}
					slotContent.get(slot)!.push({type: "text", text: entry.text});
				}

				const sortedSlots = [...slotContent.keys()].sort((a, b) => a - b);
				for (const slot of sortedSlots)
				{
					previewItems.push(...slotContent.get(slot)!);
				}

				node._previewItems = previewItems;
				node._totalImages = previewItems.length;
				node._currentImageIndex = Math.min(node._currentImageIndex ?? 0, Math.max(0, node._totalImages - 1));

				updatePreviewDisplay(node);
			};

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function(this, type, index, isConnected, link_info, inputOrOutput)
			{
				if (IsGraphLoading())
				{
					return;
				}

				prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);

				if (type !== GetLgInput())
				{
					return;
				}

				const node = this;

				if (isConnected)
				{
					try
					{
						const link = link_info ?? GetInputLink(node, index);
						if (link)
						{
							const inferredType = GetLinkTypeFromEndpoints(node, link);
							const linkId = (link_info as any)?.id ?? node.inputs?.[index]?.link;
							const linkObj = GetLink(node, linkId);
							if (linkObj && inferredType !== ANY_TYPE)
							{
								linkObj.type = inferredType;
								if (node.inputs[index])
								{
									node.inputs[index].type = inferredType;
									node.inputs[index].name = `${defaultLabel}_${index + 1}`;
									node.inputs[index].label = inferredType.toLowerCase();
								}
							}
						}
					}
					catch
					{
					}

					DeferMicrotask(() =>
					{
						normalizeInputs(node);
						applyDynamicTypes(node);
					});
					return;
				}

				DeferMicrotask(() =>
				{
					if (!node.inputs?.length || index < 0 || index >= node.inputs.length)
					{
						return;
					}

					if (node.inputs[index]?.link != null)
					{
						normalizeInputs(node);
						applyDynamicTypes(node);
						return;
					}

					const hasConnectionsAfter = node.inputs.slice(index + 1).some((i: any) => i?.link != null);
					if (hasConnectionsAfter && typeof node.removeInput === "function")
					{
						node.removeInput(index);
					}

					const hasAny = node.inputs?.some((inp: any) => inp?.link != null);
					if (!hasAny)
					{
						resetPreviewState(node as any);
					}

					normalizeInputs(node);
					applyDynamicTypes(node);
				});
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
						normalizeInputs(this);
						applyDynamicTypes(this);
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
						normalizeInputs(this);
						applyDynamicTypes(this);
					}
					catch
					{
					}
				}, 100);
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function()
			{
				prevOnAdded?.apply(this, arguments as any);

				if (this.widgets)
				{
					const imgWidgetIndex = this.widgets.findIndex((w: any) => w.name === "image" || w.type === "preview");
					if (imgWidgetIndex !== -1)
					{
						this.widgets.splice(imgWidgetIndex, 1);
					}
				}
				(this as any).imgs = null;

				createPreviewWidget(this);

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
						normalizeInputs(this);
						applyDynamicTypes(this);
					}
					catch (e)
					{
						log.error("error in onAdded", e);
					}
					finally
					{
						(this as any).__tojioo_skip_resize = false;
					}

					if (pending?.sourceNode && this.inputs?.length)
					{
						const firstFree = this.inputs.findIndex((inp: any) => inp?.link == null);
						if (firstFree >= 0)
						{
							pending.sourceNode.connect(pending.sourceSlot, this, firstFree);
						}
					}
				});
			};
		}
	};
}