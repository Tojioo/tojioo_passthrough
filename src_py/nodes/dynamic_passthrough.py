# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from .base import BaseNode, AnyType, FlexibleOptionalInputType
from ..config.categories import CATEGORIES


any_type = AnyType("*")


class PT_DynamicPassthrough(BaseNode):
	NODE_NAME = "Dynamic Passthrough"
	DESCRIPTION = "Dynamic passthrough with one output per input; types adapt based on connections."
	_MAX_SOCKETS = 32

	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": FlexibleOptionalInputType(any_type)
		}

	RETURN_TYPES = tuple(any_type for _ in range(_MAX_SOCKETS))
	RETURN_NAMES = tuple(
		"output" if i == 0 else f"output_{i + 1}"
			for i in range(_MAX_SOCKETS)
	)
	OUTPUT_IS_LIST = tuple(False for _ in range(_MAX_SOCKETS))
	CATEGORY = CATEGORIES["dynamic"]

	def run(self, **kwargs):
		values = list(kwargs.values())
		while len(values) < self._MAX_SOCKETS:
			values.append(None)
		return tuple(values[:self._MAX_SOCKETS])