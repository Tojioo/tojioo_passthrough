# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from .base import BaseNode
from ..config.types import COMFY_TYPES

class PT_MultiPass(BaseNode):
	DESCRIPTION = "Multi-type passthrough. Wire only the sockets you need."
	NODE_NAME = "Multi-Passthrough"

	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": {
				"image": (COMFY_TYPES["image"],),
				"mask": (COMFY_TYPES["mask"],),
				"latent": (COMFY_TYPES["latent"],),
				"positive": (COMFY_TYPES["conditioning"],),
				"negative": (COMFY_TYPES["conditioning"],),
				"clip": (COMFY_TYPES["clip"],),
				"model": (COMFY_TYPES["model"],),
				"vae": (COMFY_TYPES["vae"],),
				"control_net": (COMFY_TYPES["control_net"],),
				"sam_model": (COMFY_TYPES["sam_model"],),
				"text": (COMFY_TYPES["text"], {"forceInput": True}),
				"int": (COMFY_TYPES["int"], {"forceInput": True}),
				"float": (COMFY_TYPES["float"], {"forceInput": True}),
				"boolean": (COMFY_TYPES["boolean"], {"forceInput": True}),
			}
		}

	RETURN_TYPES = (
		COMFY_TYPES["image"], COMFY_TYPES["mask"], COMFY_TYPES["latent"],
		COMFY_TYPES["conditioning"], COMFY_TYPES["conditioning"],
		COMFY_TYPES["clip"], COMFY_TYPES["model"], COMFY_TYPES["vae"],
		COMFY_TYPES["control_net"], COMFY_TYPES["sam_model"],
		COMFY_TYPES["text"], COMFY_TYPES["int"], COMFY_TYPES["float"], COMFY_TYPES["boolean"]
	)

	RETURN_NAMES = (
		"image", "mask", "latent", "positive", "negative",
		"clip", "model", "vae", "control_net", "sam_model",
		"text", "int", "float", "boolean"
	)

	CATEGORY = "Tojioo Passthrough"

	def run(self, **kwargs):
		return tuple(kwargs.get(k) for k in self.RETURN_NAMES)