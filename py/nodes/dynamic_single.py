# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from .base import BaseNode
from .dynamic_passthrough import any_type
from ..config.categories import CATEGORIES

class PT_DynamicSingle(BaseNode):
	DESCRIPTION = "Pass any type through unchanged."
	NODE_NAME = "Any Type Passthrough"

	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": {"input": (any_type,)}
		}

	RETURN_TYPES = (any_type,)
	RETURN_NAMES = ("output",)
	CATEGORY = CATEGORIES["simple"]

	def run(self, input=None):
		return (input,)