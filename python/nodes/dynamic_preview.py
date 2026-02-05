import json
import os

import folder_paths

from .base import AnyType, FlexibleOptionalInputType
from ..config.categories import CATEGORIES


any_type = AnyType("*")


class PT_DynamicPreview:
	NODE_NAME = "Dynamic Preview (Beta)"
	DESCRIPTION = "Previews images with navigation. Slots appear dynamically based on connections."
	CATEGORY = CATEGORIES["dynamic"]
	_MAX_SOCKETS = 32


	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": FlexibleOptionalInputType(any_type),
			"hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
		}


	@classmethod
	def VALIDATE_INPUTS(cls, **kwargs) -> bool:
		return True


	RETURN_TYPES = ()
	OUTPUT_NODE = True
	FUNCTION = "preview_images"


	def preview_images(self, prompt = None, extra_pnginfo = None, **kwargs):
		import numpy as np
		from PIL import Image
		from PIL.PngImagePlugin import PngInfo

		try:
			import torch
		except Exception:
			torch = None


		def iter_image_tensors(v):
			if torch is None:
				return
			if isinstance(v, torch.Tensor):
				if v.dim() == 4:
					for img in v:
						yield img
				elif v.dim() == 3:
					yield v
				return
			if isinstance(v, (list, tuple)):
				for x in v:
					yield from iter_image_tensors(x)


		all_images = []
		output_dir = folder_paths.get_temp_directory()
		prefix = "preview_"

		for key, value in sorted(kwargs.items(), key = lambda x: self._parse_slot_order(x[0])):
			if value is None:
				continue
			for batch_idx, image in enumerate(iter_image_tensors(value)):
				if torch is not None and isinstance(image, torch.Tensor):
					if image.dim() != 3:
						continue
					img_t = image
					if img_t.shape[-1] not in (1, 3, 4) and img_t.shape[0] in (1, 3, 4):
						img_t = img_t.permute(1, 2, 0)
					i = 255.0 * img_t.detach().cpu().numpy()
					img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
				else:
					continue

				metadata = PngInfo()
				if prompt is not None:
					metadata.add_text("prompt", json.dumps(prompt))
				if extra_pnginfo is not None:
					for k, v in extra_pnginfo.items():
						metadata.add_text(k, json.dumps(v))

				full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
					prefix, output_dir, img.width, img.height
				)
				filename_with_counter = f"{filename}_{counter:05}_.png"
				filepath = os.path.join(full_output_folder, filename_with_counter)
				img.save(filepath, pnginfo = metadata, compress_level = 4)

				all_images.append(
					{
						"filename": filename_with_counter,
						"subfolder": subfolder,
						"type": "temp",
					}
				)

		if not all_images:
			return {"ui": {"preview_data": []}}
		return {"ui": {"preview_data": all_images}}


	@staticmethod
	def _parse_slot_order(key: str) -> int:
		if '_' in key:
			parts = key.rsplit('_', 1)
			try:
				return int(parts[1])
			except ValueError:
				pass
		return 1