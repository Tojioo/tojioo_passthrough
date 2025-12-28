# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

# noinspection PyUnresolvedReferences
from nodes import PreviewImage

from .base import AnyType, FlexibleOptionalInputType
from ..config.categories import CATEGORIES

any_type = AnyType("*")


class PT_DynamicPreview(PreviewImage):
	"""Dynamic Preview node that accepts any image input with flexible slots."""

	NODE_NAME = "Dynamic Preview (Beta)"
	DESCRIPTION = "Previews images with navigation. Slots appear dynamically based on connections."
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
		"""Save all connected images and return them for UI display with navigation."""
		all_images = []
		slot_names = []
		images_per_slot = []

		for key, value in sorted(kwargs.items(), key=lambda x: self._parse_slot_order(x[0])):
			if value is not None:
				slot_names.append(key)
				result = super().save_images(
					images=value,
					prompt=prompt,
					extra_pnginfo=extra_pnginfo,
				)
				slot_images = result.get("ui", {}).get("images", [])
				images_per_slot.append(len(slot_images))
				all_images.extend(slot_images)

		if not all_images:
			return {"ui": {"images": [], "slot_names": [], "images_per_slot": []}}

		return {
			"ui": {
				"images": all_images,
				"slot_names": slot_names,
				"images_per_slot": images_per_slot,
			}
		}

	@staticmethod
	def _parse_slot_order(key: str) -> int:
		"""Parse slot order from key name. 'image' -> 1, 'image_2' -> 2"""
		if '_' in key:
			parts = key.rsplit('_', 1)
			try:
				return int(parts[1])
			except ValueError:
				pass
		return 1