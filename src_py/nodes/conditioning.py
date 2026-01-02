# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from .base import BaseNode
from ..config.categories import CATEGORIES


class PT_Conditioning(BaseNode):
	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": {
				"positive": ("CONDITIONING",),
				"negative": ("CONDITIONING",),
			}
		}

	OUTPUT_NODE = True
	NODE_NAME = "Conditioning Passthrough"
	CATEGORY = CATEGORIES["simple"]
	DESCRIPTION = "Passthrough for positive and negative conditioning."

	RETURN_TYPES = ("CONDITIONING", "CONDITIONING")
	RETURN_NAMES = ("positive", "negative")

	FUNCTION = "run"

	@staticmethod
	def run(positive=None, negative=None):
		return positive, negative