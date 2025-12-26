# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from .base import BaseNode
from ..config.categories import CATEGORIES
from ..config.types import COMFY_TYPES

class PT_Conditioning(BaseNode):
	DESCRIPTION = "Passthrough for positive and negative conditioning."
	NODE_NAME = "Conditioning Passthrough"

	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {
				"positive": (COMFY_TYPES["conditioning"],),
				"negative": (COMFY_TYPES["conditioning"],),
			}
		}

	RETURN_TYPES = (COMFY_TYPES["conditioning"], COMFY_TYPES["conditioning"])
	RETURN_NAMES = ("positive", "negative")
	CATEGORY = CATEGORIES["simple"]

	def run(self, positive, negative):
		return positive, negative