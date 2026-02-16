from .base import BaseNode
from ..config.categories import CATEGORIES


class PT_TiledVAESettings(BaseNode):
	NODE_NAME = "Tiled VAE Settings"
	DESCRIPTION = "Provides tiled VAE encoding/decoding settings as connectable outputs for use in subgraphs."


	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {
				"tile_size": ("INT", {
					"default": 512,
					"min": 64,
					"max": 4096,
					"step": 32,
					"display": "number",
					"tooltip": "Size of each tile for VAE encoding/decoding",
				}),
				"overlap": ("INT", {
					"default": 64,
					"min": 0,
					"max": 4096,
					"step": 32,
					"display": "number",
					"tooltip": "Overlap between adjacent tiles in pixels",
				}),
				"temporal_size": ("INT", {
					"default": 64,
					"min": 8,
					"max": 4096,
					"step": 4,
					"display": "number",
					"tooltip": "Number of frames per temporal tile (video VAE)",
				}),
				"temporal_overlap": ("INT", {
					"default": 8,
					"min": 4,
					"max": 4096,
					"step": 4,
					"display": "number",
					"tooltip": "Overlap between temporal tiles in frames",
				}),
			}
		}


	RETURN_TYPES = ("INT", "INT", "INT", "INT",)
	RETURN_NAMES = ("tile_size", "overlap", "temporal_size", "temporal_overlap",)
	CATEGORY = CATEGORIES["other"]


	@staticmethod
	def run(tile_size, overlap, temporal_size, temporal_overlap):
		return tile_size, overlap, temporal_size, temporal_overlap,