# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from .base import BaseNode
from ..config.categories import CATEGORIES


class AnyType(str):
	def __eq__(self, other):
		return isinstance(other, str)

	def __ne__(self, other):
		return False

	def __hash__(self):
		return hash("*")


any_type = AnyType("*")


class FlexibleOptionalInputType(dict):
	def __init__(self, type_spec):
		super().__init__()
		self._type_spec = type_spec

	def __contains__(self, key):
		return True

	def __getitem__(self, key):
		return (self._type_spec,)


class PT_DynamicPassthrough(BaseNode):
	DESCRIPTION = "Dynamic passthrough with one output per input; types adapt based on connections."
	NODE_NAME = "Dynamic Passthrough"
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