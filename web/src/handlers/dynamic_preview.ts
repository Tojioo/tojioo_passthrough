import {GetGraph, GetInputLink, GetLink, GetLinkTypeFromEndpoints, GetLgInput, GetLgSlotHeight, IsNodes2Mode, DeferMicrotask, IsGraphLoading, UpdatePreviewNodeSize} from '@/utils';
import {ComfyApp, ComfyExtension, ComfyNodeDef} from '@comfyorg/comfyui-frontend-types';
import {ANY_TYPE, MAX_SOCKETS, TAB_BAR_HEIGHT, TAB_GAP, TAB_PADDING} from '@/types/tojioo';

// Todo: Fix broken node ._.
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
			(nodeType.prototype as any)._imageElements = [];
			(nodeType.prototype as any)._totalImages = 0;
			(nodeType.prototype as any)._tabHitAreas = [];

			function normalizeInputs(node: any): void
			{
				if (!node.inputs) node.inputs = [];

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
					node.addInput("image", ANY_TYPE);
					node.inputs[node.inputs.length - 1].label = "image";
				}

				UpdatePreviewNodeSize(node);
			}

			function applyDynamicTypes(node: any): void
			{
				if (!node.inputs?.length) return;

				const types: string[] = [];
				const typeCounters: Record<string, number> = {};

				for (let i = 0; i < node.inputs.length; i++)
				{
					const link = GetInputLink(node, i);
					let resolvedType = ANY_TYPE;
					if (link)
					{
						const t = GetLinkTypeFromEndpoints(node, link);
						if (t !== ANY_TYPE) resolvedType = t;
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
						label = n === 1 ? "image" : `image_${n}`;
					}
					inp.name = `input_${i + 1}`;
					inp.label = label;
				}

				GetGraph(node)?.setDirtyCanvas?.(true, true);
			}

			function measureTabWidths(ctx: CanvasRenderingContext2D, count: number): number[]
			{
				ctx.font = "12px Arial";
				const widths: number[] = [];
				for (let i = 1; i <= count; i++)
				{
					widths.push(ctx.measureText(String(i)).width + TAB_PADDING * 2);
				}
				return widths;
			}

			(nodeType.prototype as any).selectImage = function(this: any, index: number): void
			{
				if (index < 0 || index >= this._totalImages) return;
				this._currentImageIndex = index;
				this.graph?.setDirtyCanvas?.(true, true);
			};

			const prevOnDrawForeground = nodeType.prototype.onDrawForeground;
			nodeType.prototype.onDrawForeground = function(ctx, canvas, canvasElement)
			{
				prevOnDrawForeground?.call(this, ctx, canvas, canvasElement);

				if (!ctx || IsNodes2Mode()) return;

				const node = this as any;
				if (!node._imageElements?.length || node._totalImages === 0) return;

				const imgs = node._imageElements;
				const idx = Math.min(node._currentImageIndex, imgs.length - 1);
				const img = imgs[idx];

				if (!img?.complete || img.naturalWidth === 0) return;

				const slotHeight = GetLgSlotHeight();
				const inputsHeight = (node.inputs?.length || 1) * slotHeight + 10;
				const showTabs = node._totalImages >= 2;
				const tabBarHeight = showTabs ? TAB_BAR_HEIGHT : 0;
				const previewY = inputsHeight + tabBarHeight;
				const previewHeight = node.size[1] - previewY;
				const previewWidth = node.size[0];

				if (previewHeight < 50) return;

				const scale = Math.min(previewWidth / img.width, previewHeight / img.height);
				const drawWidth = img.width * scale;
				const drawHeight = img.height * scale;
				const drawX = (previewWidth - drawWidth) / 2;
				const drawY = previewY + (previewHeight - drawHeight) / 2;

				ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

				if (showTabs)
				{
					const tabY = inputsHeight;
					const tabWidths = measureTabWidths(ctx, node._totalImages);
					const totalTabWidth = tabWidths.reduce((a, b) => a + b, 0) + TAB_GAP * (node._totalImages - 1);
					let tabX = (node.size[0] - totalTabWidth) / 2;

					node._tabHitAreas = [];

					for (let i = 0; i < node._totalImages; i++)
					{
						const tabWidth = tabWidths[i];
						const isSelected = i === node._currentImageIndex;

						ctx.fillStyle = isSelected ? "rgba(80, 120, 200, 0.9)" : "rgba(60, 60, 60, 0.8)";
						ctx.beginPath();
						if ((ctx as any).roundRect)
						{
							(ctx as any).roundRect(tabX, tabY + 2, tabWidth, TAB_BAR_HEIGHT - 4, 4);
						}
						else
						{
							ctx.rect(tabX, tabY + 2, tabWidth, TAB_BAR_HEIGHT - 4);
						}
						ctx.fill();

						ctx.fillStyle = isSelected ? "#fff" : "#aaa";
						ctx.font = "12px Arial";
						ctx.textAlign = "center";
						ctx.textBaseline = "middle";
						ctx.fillText(String(i + 1), tabX + tabWidth / 2, tabY + TAB_BAR_HEIGHT / 2);

						node._tabHitAreas.push({x: tabX, y: tabY, width: tabWidth, height: TAB_BAR_HEIGHT, index: i});
						tabX += tabWidth + TAB_GAP;
					}
				}
			};

			const prevOnMouseDown = nodeType.prototype.onMouseDown;
			nodeType.prototype.onMouseDown = function(this: any, e, pos, canvas)
			{
				if (this._tabHitAreas?.length)
				{
					for (const area of this._tabHitAreas)
					{
						if (pos[0] >= area.x && pos[0] <= area.x + area.width &&
							pos[1] >= area.y && pos[1] <= area.y + area.height)
						{
							this.selectImage(area.index);
							return true;
						}
					}
				}
				return prevOnMouseDown?.call(this, e, pos, canvas) ?? false;
			};

			const prevOnExecuted = (nodeType.prototype as any).onExecuted;
			(nodeType.prototype as any).onExecuted = function(message: any)
			{
				prevOnExecuted?.call(this, message);

				const node = this as any;
				node.imgs = null;
				const images = message?.preview_data;

				if (!images?.length)
				{
					node._imageElements = [];
					node._totalImages = 0;
					node._currentImageIndex = 0;
					node._tabHitAreas = [];
					return;
				}

				node._totalImages = images.length;
				node._currentImageIndex = Math.min(node._currentImageIndex, node._totalImages - 1);

				node._imageElements = images.map((imgInfo: any) =>
				{
					const img = new Image();
					img.src = `/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(
						imgInfo.subfolder || "")}&type=${encodeURIComponent(imgInfo.type || "output")}`;
					return img;
				});

				this.graph?.setDirtyCanvas?.(true, true);
			};

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function(this, type, index, isConnected, link_info, inputOrOutput)
			{
				if (IsGraphLoading()) return;

				prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);

				if (type !== GetLgInput()) return;

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
									const n = inferredType.toLowerCase();
									node.inputs[index].name = n;
									node.inputs[index].label = n;
								}
							}
						}
					}
					catch {}

					DeferMicrotask(() =>
					{
						normalizeInputs(node);
						applyDynamicTypes(node);
					});
					return;
				}

				DeferMicrotask(() =>
				{
					if (!node.inputs?.length || index < 0 || index >= node.inputs.length) return;

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
						(node as any)._currentImageIndex = 0;
						(node as any)._imageElements = [];
						(node as any)._totalImages = 0;
						(node as any)._tabHitAreas = [];
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
					if (loading) (this as any).__tojioo_skip_resize = true;
					try { normalizeInputs(this); applyDynamicTypes(this); }
					catch (e) { console.error("Tojioo.DynamicPreview: error in configure", e); }
					finally { (this as any).__tojioo_skip_resize = false; }
				});
				setTimeout(() => { try { normalizeInputs(this); applyDynamicTypes(this); } catch {} }, 100);
			};

			const prevOnAdded = nodeType.prototype.onAdded;
			nodeType.prototype.onAdded = function()
			{
				prevOnAdded?.apply(this, arguments as any);

				if (this.widgets)
				{
					const imgWidgetIndex = this.widgets.findIndex((w: any) => w.name === "image" || w.type === "preview");
					if (imgWidgetIndex !== -1) this.widgets.splice(imgWidgetIndex, 1);
				}
				(this as any).imgs = null;

				const loading = IsGraphLoading();
				DeferMicrotask(() =>
				{
					if (loading) (this as any).__tojioo_skip_resize = true;
					try { normalizeInputs(this); applyDynamicTypes(this); }
					catch (e) { console.error("Tojioo.DynamicPreview: error in onAdded", e); }
					finally { (this as any).__tojioo_skip_resize = false; }
				});
			};
		}
	};
}