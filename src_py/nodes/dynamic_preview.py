# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

import json
import os

import folder_paths

from .base import AnyType, FlexibleOptionalInputType
from ..config.categories import CATEGORIES

any_type = AnyType("*")


class PT_DynamicPreview:
	"""Dynamic Preview node that accepts any image input with flexible slots."""

	NODE_NAME = "Dynamic Preview (Beta)"
	DESCRIPTION = "Previews images with navigation. Slots appear dynamically based on connections. WARNING: this node is still in beta and may be very broken. Use with caution."
	CATEGORY = CATEGORIES["dynamic"]
	_MAX_SOCKETS = 32

	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": FlexibleOptionalInputType(any_type),
			"hidden": {
				"prompt": "PROMPT",
				"extra_pnginfo": "EXTRA_PNGINFO",
			},
		}

	RETURN_TYPES = ()
	OUTPUT_NODE = True
	FUNCTION = "preview_images"

	def preview_images(self, prompt=None, extra_pnginfo=None, **kwargs):
		import numpy as np
		from PIL import Image
		from PIL.PngImagePlugin import PngInfo

		all_images = []

		output_dir = folder_paths.get_temp_directory()
		prefix = "preview_"

		for key, value in sorted(kwargs.items(), key=lambda x: self._parse_slot_order(x[0])):
			if value is None:
				continue

			for batch_idx, image in enumerate(value):
				i = 255.0 * image.cpu().numpy()
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
				img.save(filepath, pnginfo=metadata, compress_level=4)

				all_images.append({
					"filename": filename_with_counter,
					"subfolder": subfolder,
					"type": "temp",
				})

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