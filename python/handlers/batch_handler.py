import torch
from comfy.utils import common_upscale

from ..config.types import BATCHABLE_TYPES


class BatchHandler:

	@staticmethod
	def can_batch(type_name: str) -> bool:
		return type_name in BATCHABLE_TYPES


	@staticmethod
	def get_handler(type_name: str):
		handlers = {
			"IMAGE": (
				lambda img: img.unsqueeze(0) if img.dim() == 3 else img,
				BatchHandler._merge_images
			),
			"MASK": (
				lambda m: m.unsqueeze(0) if m.dim() == 2 else m,
				BatchHandler._merge_masks
			),
			"LATENT": (
				lambda L: L["samples"].unsqueeze(0) if L["samples"].dim() == 3 else L["samples"],
				BatchHandler._merge_latents
			),
			"CONDITIONING": (
				lambda c: c,
				lambda vals, _: [item for cond in vals for item in cond]
			)
		}
		return handlers.get(type_name)


	# Invariant: these merges match ComfyUI's Batch Images/Masks/Latents nodes (comfy_extras/nodes_post_processing.py), resizing to the first input.
	@staticmethod
	def _merge_images(vals, prepped):
		max_channels = max(t.shape[-1] for t in prepped)
		padded = [
			torch.nn.functional.pad(t, (0, 1), mode = "constant", value = 1.0) if t.shape[-1] < max_channels else t
			for t in prepped
		]
		first = padded[0].shape
		resized = [
			t if t.shape[1:] == first[1:]
			else common_upscale(t.movedim(-1, 1), first[2], first[1], "bilinear", "center").movedim(1, -1)
			for t in padded
		]
		return torch.cat(resized, dim = 0)


	@staticmethod
	def _merge_masks(vals, prepped):
		first = prepped[0].shape
		resized = [
			m if m.shape[1:] == first[1:]
			else common_upscale(m.unsqueeze(1), first[2], first[1], "bilinear", "center").squeeze(1)
			for m in prepped
		]
		return torch.cat(resized, dim = 0)


	@staticmethod
	def _merge_latents(vals, prepped):
		first = prepped[0].shape
		resized = [
			s if s.shape[1:] == first[1:]
			else common_upscale(s, first[-1], first[-2], "bilinear", "center")
			for s in prepped
		]
		merged = {k: v for k, v in vals[0].items() if k not in ("samples", "noise_mask", "batch_index")}
		merged["samples"] = torch.cat(resized, dim = 0)
		return merged
