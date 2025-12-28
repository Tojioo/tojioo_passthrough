import {getGraph, getLink} from "../utils/graph.js"
import {getLinkTypeFromEndpoints} from "../utils/types.js"
import {deferMicrotask, makeIsGraphLoading} from "../utils/lifecycle.js"
import {ANY_TYPE, MAX_SOCKETS} from "../config/constants.js"

const TAB_BAR_HEIGHT = 28
const TAB_PADDING = 10
const TAB_GAP = 4

export function configureDynamicPreview()
{
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicPreview",
		beforeRegisterNodeDef(nodeType, nodeData, app)
		{
			if (nodeData?.name !== "PT_DynamicPreview") return

			const isGraphLoading = makeIsGraphLoading()

			nodeType.prototype._currentImageIndex = 0
			nodeType.prototype._imageElements = []
			nodeType.prototype._totalImages = 0
			nodeType.prototype._tabHitAreas = []

			function normalizeInputs(node)
			{
				if (!node.inputs) node.inputs = []

				let lastConnectedIndex = -1
				for (let i = node.inputs.length - 1; i >= 0; i--)
				{
					if (node.inputs[i]?.link != null)
					{
						lastConnectedIndex = i
						break
					}
				}

				const desiredCount = Math.min(MAX_SOCKETS, Math.max(1, lastConnectedIndex + 2))

				while (node.inputs.length > desiredCount) node.removeInput(node.inputs.length - 1)
				while (node.inputs.length < desiredCount) node.addInput("image", ANY_TYPE)
			}

			function applyDynamicTypes(node)
			{
				if (!node.inputs || node.inputs.length === 0) return

				const types = []
				const typeCounters = {}

				for (let i = 0; i < node.inputs.length; i++)
				{
					const inp = node.inputs[i]
					const linkId = inp?.link

					let resolvedType = ANY_TYPE

					if (linkId != null)
					{
						const link = getLink(node, linkId)
						if (link)
						{
							const t = getLinkTypeFromEndpoints(node, link)
							if (t && t !== ANY_TYPE) resolvedType = t
						}
					}

					types.push(resolvedType)
				}

				for (let i = 0; i < node.inputs.length; i++)
				{
					const inp = node.inputs[i]
					const t = types[i]
					const isTyped = t && t !== ANY_TYPE

					inp.type = t

					if (isTyped)
					{
						const baseLabel = t.toLowerCase()
						if (typeCounters[t] === undefined) typeCounters[t] = 1
						const occurrence = typeCounters[t]
						typeCounters[t]++
						inp.name = occurrence === 1 ? baseLabel : `${baseLabel}_${occurrence}`
					}
					else
					{
						if (typeCounters["__untyped__"] === undefined) typeCounters["__untyped__"] = 1
						const occurrence = typeCounters["__untyped__"]
						typeCounters["__untyped__"]++
						inp.name = occurrence === 1 ? "image" : `image_${occurrence}`
					}
				}

				const g = getGraph(node)
				g?.setDirtyCanvas?.(true, true)
			}

			function hasAnyConnection(node)
			{
				if (!node.inputs) return false
				return node.inputs.some(inp => inp?.link != null)
			}

			function resetStateIfNoConnections(node)
			{
				if (!hasAnyConnection(node))
				{
					node._currentImageIndex = 0
					node._imageElements = []
					node._totalImages = 0
					node._tabHitAreas = []
				}
			}

			function measureTabWidths(ctx, count)
			{
				ctx.font = "12px Arial"
				const widths = []
				for (let i = 1; i <= count; i++)
				{
					const textWidth = ctx.measureText(String(i)).width
					widths.push(textWidth + TAB_PADDING * 2)
				}
				return widths
			}

			nodeType.prototype.selectImage = function(index)
			{
				if (index < 0 || index >= this._totalImages) return
				this._currentImageIndex = index
				const g = getGraph(this)
				g?.setDirtyCanvas?.(true, true)
			}

			const prevOnDrawForeground = nodeType.prototype.onDrawForeground
			nodeType.prototype.onDrawForeground = function(ctx)
			{
				if (prevOnDrawForeground) prevOnDrawForeground.call(this, ctx)

				if (!this._imageElements || this._imageElements.length === 0) return
				if (this._totalImages === 0) return

				const imgs = this._imageElements
				const idx = Math.min(this._currentImageIndex, imgs.length - 1)
				const img = imgs[idx]

				if (!img || !img.complete || img.naturalWidth === 0) return

				const inputsHeight = (this.inputs?.length || 1) * LiteGraph.NODE_SLOT_HEIGHT + 10
				const showTabs = this._totalImages >= 2
				const tabBarHeight = showTabs ? TAB_BAR_HEIGHT : 0
				const previewY = inputsHeight + tabBarHeight
				const previewHeight = this.size[1] - previewY
				const previewWidth = this.size[0]

				if (previewHeight < 50) return

				const scale = Math.min(previewWidth / img.width, previewHeight / img.height)
				const drawWidth = img.width * scale
				const drawHeight = img.height * scale
				const drawX = (previewWidth - drawWidth) / 2
				const drawY = previewY + (previewHeight - drawHeight) / 2

				ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

				if (showTabs)
				{
					const tabY = inputsHeight
					const tabWidths = measureTabWidths(ctx, this._totalImages)
					const totalTabWidth = tabWidths.reduce((a, b) => a + b, 0) + TAB_GAP * (this._totalImages - 1)
					let tabX = (this.size[0] - totalTabWidth) / 2

					this._tabHitAreas = []

					for (let i = 0; i < this._totalImages; i++)
					{
						const tabWidth = tabWidths[i]
						const isSelected = i === this._currentImageIndex

						ctx.fillStyle = isSelected ? "rgba(80, 120, 200, 0.9)" : "rgba(60, 60, 60, 0.8)"
						ctx.beginPath()
						ctx.roundRect(tabX, tabY + 2, tabWidth, TAB_BAR_HEIGHT - 4, 4)
						ctx.fill()

						ctx.fillStyle = isSelected ? "#fff" : "#aaa"
						ctx.font = "12px Arial"
						ctx.textAlign = "center"
						ctx.textBaseline = "middle"
						ctx.fillText(String(i + 1), tabX + tabWidth / 2, tabY + TAB_BAR_HEIGHT / 2)

						this._tabHitAreas.push({
							x: tabX,
							y: tabY,
							width: tabWidth,
							height: TAB_BAR_HEIGHT,
							index: i,
						})

						tabX += tabWidth + TAB_GAP
					}
				}
			}

			const prevOnMouseDown = nodeType.prototype.onMouseDown
			nodeType.prototype.onMouseDown = function(e, localPos)
			{
				if (this._tabHitAreas && this._tabHitAreas.length > 0)
				{
					for (const area of this._tabHitAreas)
					{
						if (
							localPos[0] >= area.x &&
							localPos[0] <= area.x + area.width &&
							localPos[1] >= area.y &&
							localPos[1] <= area.y + area.height
						)
						{
							this.selectImage(area.index)
							return true
						}
					}
				}

				if (prevOnMouseDown) return prevOnMouseDown.call(this, e, localPos)
			}

			const prevOnExecuted = nodeType.prototype.onExecuted
			nodeType.prototype.onExecuted = function(message)
			{
				this.imgs = null

				const images = message?.preview_data

				if (!images || images.length === 0)
				{
					this._imageElements = []
					this._totalImages = 0
					this._currentImageIndex = 0
					this._tabHitAreas = []
					return
				}

				this._totalImages = images.length
				this._currentImageIndex = Math.min(this._currentImageIndex, this._totalImages - 1)

				this._imageElements = images.map(imgInfo =>
				{
					const img = new Image()
					img.src = `/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(imgInfo.subfolder || "")}&type=${encodeURIComponent(imgInfo.type || "output")}`
					return img
				})

				const g = getGraph(this)
				g?.setDirtyCanvas?.(true, true)
			}

			const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange
			nodeType.prototype.onConnectionsChange = function(type, index, connected, link_info)
			{
				if (isGraphLoading()) return
				if (prevOnConnectionsChange) prevOnConnectionsChange.call(this, type, index, connected, link_info)

				if (type !== LiteGraph.INPUT) return

				const node = this

				if (connected)
				{
					try
					{
						const g = getGraph(node)
						const linkId = link_info?.id ?? node.inputs?.[index]?.link
						const linkObj = link_info ?? (linkId != null ? getLink(node, linkId) : null)
						if (linkObj)
						{
							const inferredType = getLinkTypeFromEndpoints(node, linkObj)
							if (linkId != null && g?.links?.[linkId] && inferredType && inferredType !== ANY_TYPE)
							{
								g.links[linkId].type = inferredType
							}
						}
					}
					catch (e) {}

					deferMicrotask(() =>
					{
						normalizeInputs(node)
						applyDynamicTypes(node)
					})
					return
				}

				const disconnectedIndex = index

				deferMicrotask(() =>
				{
					if (!node.inputs || node.inputs.length === 0) return
					if (disconnectedIndex < 0 || disconnectedIndex >= node.inputs.length) return

					if (node.inputs[disconnectedIndex]?.link != null)
					{
						normalizeInputs(node)
						applyDynamicTypes(node)
						return
					}

					let hasConnectionsAfter = false
					for (let i = disconnectedIndex + 1; i < node.inputs.length; i++)
					{
						if (node.inputs[i]?.link != null)
						{
							hasConnectionsAfter = true
							break
						}
					}

					if (hasConnectionsAfter)
					{
						node.removeInput(disconnectedIndex)
					}

					resetStateIfNoConnections(node)

					normalizeInputs(node)
					applyDynamicTypes(node)
				})
			}

			const prevOnAdded = nodeType.prototype.onAdded
			nodeType.prototype.onAdded = function()
			{
				if (prevOnAdded) prevOnAdded.apply(this, arguments)

				if (this.widgets)
				{
					const imgWidgetIndex = this.widgets.findIndex(w => w.name === "image" || w.type === "preview")
					if (imgWidgetIndex !== -1)
					{
						this.widgets.splice(imgWidgetIndex, 1)
					}
				}
				this.imgs = null

				deferMicrotask(() =>
				{
					normalizeInputs(this)
					applyDynamicTypes(this)
				})
			}
		}
	}
}