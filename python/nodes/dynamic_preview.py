import json
import os

import folder_paths

from .base import AnyType, FlexibleOptionalInputType
from ..config.categories import CATEGORIES


any_type = AnyType("*")

_MAX_TEXT_LEN = 2000


class PT_DynamicPreview:
	NODE_NAME = "Dynamic Preview"
	DESCRIPTION = "Previews any value. Images and masks display visually; other types display as text."
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

		print("PT_DynamicPreview executing", list(kwargs.keys()))

		try:
			import torch
		except Exception:
			torch = None

		all_images = []
		all_text = []
		output_dir = folder_paths.get_temp_directory()
		prefix = "preview_"


		def save_tensor_as_image(img_t, slot_idx):
			if img_t.shape[-1] not in (1, 3, 4) and img_t.shape[0] in (1, 3, 4):
				img_t = img_t.permute(1, 2, 0)
			i = 255.0 * img_t.detach().cpu().numpy()
			img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))

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
					"slot": slot_idx,
				}
			)


		for slot_idx, (key, value) in enumerate(
			sorted(kwargs.items(), key = lambda x: self._parse_slot_order(x[0]))
		):
			if value is None:
				continue

			if torch is not None and isinstance(value, torch.Tensor):
				if self._is_image_tensor(value):
					for frame in self._iter_image_tensors(value):
						if frame.dim() == 3:
							save_tensor_as_image(frame, slot_idx)
					continue

				if self._is_mask_tensor(value):
					for frame in self._iter_mask_as_rgb(value):
						save_tensor_as_image(frame, slot_idx)
					continue

			all_text.append({"slot": slot_idx, "text": self._value_to_text(value, torch)})

		return {"ui": {"preview_data": all_images, "text_data": all_text}}


	@staticmethod
	def _is_image_tensor(v):
		if v.dim() == 4 and v.shape[-1] in (1, 3, 4):
			return True
		if v.dim() == 3 and v.shape[-1] in (1, 3, 4):
			return True
		if v.dim() == 4 and v.shape[1] in (1, 3, 4):
			return True
		if v.dim() == 3 and v.shape[0] in (3, 4):
			return True
		return False


	@staticmethod
	def _is_mask_tensor(v):
		if v.dim() == 2:
			return True
		if v.dim() == 3 and v.shape[0] not in (3, 4):
			return True
		return False


	@staticmethod
	def _iter_image_tensors(v):
		if v.dim() == 4:
			for frame in v:
				yield frame
		elif v.dim() == 3:
			yield v


	@staticmethod
	def _iter_mask_as_rgb(v):
		if v.dim() == 2:
			yield v.unsqueeze(-1).expand(-1, -1, 3)
		elif v.dim() == 3:
			for i in range(v.shape[0]):
				yield v[i].unsqueeze(-1).expand(-1, -1, 3)


	@staticmethod
	def _value_to_text(value, torch):
		if torch is not None and isinstance(value, torch.Tensor):
			return f"Tensor: shape={list(value.shape)}, dtype={value.dtype}"

		if isinstance(value, (list, tuple)):
			if (
				isinstance(value, list)
				and len(value) > 0
				and isinstance(value[0], (list, tuple))
				and len(value[0]) == 2
				and torch is not None
				and isinstance(value[0][0], torch.Tensor)
			):
				shapes = [list(e[0].shape) for e in value if isinstance(e[0], torch.Tensor)]
				return f"CONDITIONING: {len(value)} entries\nShapes: {shapes}"

			try:
				text = json.dumps(value, indent = 2, default = str)
			except Exception:
				text = repr(value)
		elif isinstance(value, dict):
			try:
				text = json.dumps(value, indent = 2, default = str)
			except Exception:
				text = repr(value)
		elif isinstance(value, (int, float, bool, str)):
			text = str(value)
		else:
			text = repr(value)

		if len(text) > _MAX_TEXT_LEN:
			text = text[:_MAX_TEXT_LEN] + "\n... (truncated)"
		return text


	@staticmethod
	def _parse_slot_order(key: str) -> int:
		if '_' in key:
			parts = key.rsplit('_', 1)
			try:
				return int(parts[1])
			except ValueError:
				pass
		return 1