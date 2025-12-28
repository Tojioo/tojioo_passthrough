import {getGraph, getLink} from "../utils/graph.js"
import {getLinkTypeFromEndpoints} from "../utils/types.js"
import {deferMicrotask, makeIsGraphLoading} from "../utils/lifecycle.js"
import {ANY_TYPE, MAX_SOCKETS} from "../config/constants.js"

const PREVIEW_MIN_HEIGHT = 220
const NAV_BAR_HEIGHT = 32

export function configureDynamicPreview()
{
	return {
		name: "Tojioo.Passthrough.Dynamic.DynamicPreview",
		beforeRegisterNodeDef(nodeType, nodeData, app)
		{
			if (nodeData?.name !== "PT_DynamicPreview") return

			const isGraphLoading = makeIsGraphLoading()

			nodeType.prototype._previewLockedSize = null
			nodeType.prototype._currentImageIndex = 0
			nodeType.prototype._imageElements = []
			nodeType.prototype._totalImages = 0

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

				if (!node._previewLockedSize)
				{
					const computed = node.computeSize()
					computed[1] = Math.max(computed[1], PREVIEW_MIN_HEIGHT)
					node.setSize(computed)
				}
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

			function lockSize(node)
			{
				if (!node._previewLockedSize && hasAnyConnection(node))
				{
					const size = node.size.slice()
					size[1] = Math.max(size[1], PREVIEW_MIN_HEIGHT)
					node._previewLockedSize = size
					node.setSize(size)
				}
			}

			function unlockSizeIfNoConnections(node)
			{
				if (!hasAnyConnection(node))
				{
					node._previewLockedSize = null
					node._currentImageIndex = 0
					node._imageElements = []
					node._totalImages = 0
				}
			}

			// Override setSize to respect locked size
			const prevSetSize = nodeType.prototype.setSize
			nodeType.prototype.setSize = function(size)
			{
				if (this._previewLockedSize)
				{
					size = [size[0], this._previewLockedSize[1]]
				}
				if (prevSetSize) prevSetSize.call(this, size)
				else this.size = size
			}

			// Navigation methods
			nodeType.prototype.navigateImage = function(delta)
			{
				if (this._totalImages <= 1) return
				this._currentImageIndex = (this._currentImageIndex + delta + this._totalImages) % this._totalImages
				const g = getGraph(this)
				g?.setDirtyCanvas?.(true, true)
			}

			// Custom drawing for image preview with navigation
			const prevOnDrawForeground = nodeType.prototype.onDrawForeground
			nodeType.prototype.onDrawForeground = function(ctx)
			{
				if (prevOnDrawForeground) prevOnDrawForeground.call(this, ctx)

				if (!this._imageElements || this._imageElements.length === 0) return
				if (this._totalImages === 0) return

				const imgs = this._imageElements
				const idx = Math.min(this._currentImageIndex, imgs.length - 1)
				const img = imgs[idx]

				if (!img || !img.complete) return

				// Calculate preview area
				const inputsHeight = (this.inputs?.length || 1) * LiteGraph.NODE_SLOT_HEIGHT + 10
				const previewY = inputsHeight
				const previewHeight = this.size[1] - inputsHeight - NAV_BAR_HEIGHT
				const previewWidth = this.size[0]

				if (previewHeight < 50) return

				// Draw image scaled to fit
				const scale = Math.min(previewWidth / img.width, previewHeight / img.height)
				const drawWidth = img.width * scale
				const drawHeight = img.height * scale
				const drawX = (previewWidth - drawWidth) / 2
				const drawY = previewY + (previewHeight - drawHeight) / 2

				ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

				// Draw navigation bar if multiple images
				if (this._totalImages > 1)
				{
					const navY = this.size[1] - NAV_BAR_HEIGHT

					// Background
					ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
					ctx.fillRect(0, navY, this.size[0], NAV_BAR_HEIGHT)

					// Left arrow
					ctx.fillStyle = "#fff"
					ctx.font = "16px Arial"
					ctx.textAlign = "center"
					ctx.textBaseline = "middle"
					ctx.fillText("◀", 20, navY + NAV_BAR_HEIGHT / 2)

					// Counter
					ctx.fillText(`${idx + 1} / ${this._totalImages}`, this.size[0] / 2, navY + NAV_BAR_HEIGHT / 2)

					// Right arrow
					ctx.fillText("▶", this.size[0] - 20, navY + NAV_BAR_HEIGHT / 2)
				}
			}

			const prevOnMouseDown = nodeType.prototype.onMouseDown
			nodeType.prototype.onMouseDown = function(e, localPos)
			{
				if (prevOnMouseDown) prevOnMouseDown.call(this, e, localPos)

				if (this._totalImages <= 1) return

				const navY = this.size[1] - NAV_BAR_HEIGHT
				if (localPos[1] >= navY)
				{
					if (localPos[0] < this.size[0] / 3)
					{
						this.navigateImage(-1)
						return true
					}
					else if (localPos[0] > this.size[0] * 2 / 3)
					{
						this.navigateImage(1)
						return true
					}
				}
			}

			const prevOnExecuted = nodeType.prototype.onExecuted
			nodeType.prototype.onExecuted = function(message)
			{
				this.imgs = null

				const images = message?.images
				if (!images || images.length === 0)
				{
					this._imageElements = []
					this._totalImages = 0
					this._currentImageIndex = 0
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

				lockSize(this)

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

					lockSize(node)

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

					unlockSizeIfNoConnections(node)

					normalizeInputs(node)
					applyDynamicTypes(node)
				})
			}

			const prevConfigure = nodeType.prototype.configure
			nodeType.prototype.configure = function(info)
			{
				if (prevConfigure) prevConfigure.call(this, info)

				if (info.size && hasAnyConnection(this))
				{
					this._previewLockedSize = info.size.slice()
				}
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