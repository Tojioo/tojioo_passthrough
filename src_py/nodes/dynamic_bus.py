# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from .base import BaseNode, AnyType, FlexibleOptionalInputType
from ..config.categories import CATEGORIES


any_type = AnyType("*")


class PT_DynamicBus(BaseNode):
	"""
	Dynamic Bus: pack values into a bus, unpack values from a received bus, or pass through.
	
	This node allows flexible data routing by:
	- Packing multiple inputs into a single bus output
	- Unpacking a received bus into individual outputs
	- Direct passthrough of individual values
	
	Class Attributes
	----------------
	_MAX_SOCKETS : int
		Maximum number of input/output sockets (32)
	"""

	NODE_NAME = "Dynamic Bus Node (Beta)"
	DESCRIPTION = "Dynamic Bus: pack values into a bus, unpack values from a received bus, or pass through."
	_MAX_SOCKETS = 32

	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": FlexibleOptionalInputType(any_type)
		}

	RETURN_TYPES = tuple(any_type for _ in range(_MAX_SOCKETS))
	RETURN_NAMES = ("bus",) + ("output",) + tuple(f"output_{i}" for i in range(2, _MAX_SOCKETS))
	OUTPUT_IS_LIST = tuple(False for _ in range(_MAX_SOCKETS))
	CATEGORY = CATEGORIES["dynamic"]

	def run(self, bus=None, **kwargs):
		if bus is None:
			bus_dict = {}
		elif isinstance(bus, dict):
			bus_dict = dict(bus)
		else:
			bus_dict = {}

		direct_inputs = {}
		for key, value in kwargs.items():
			if value is None:
				continue
			occurrence = parse_slot_occurrence(key)
			bus_idx = occurrence - 1
			direct_inputs[bus_idx] = value
			bus_dict[bus_idx] = value

		outputs = [bus_dict]

		max_slot = (max(bus_dict.keys(), default=-1) + 1) if bus_dict else 0

		for idx in range(max_slot):
			if idx in direct_inputs:
				outputs.append(direct_inputs[idx])
			else:
				outputs.append(bus_dict.get(idx))

		while len(outputs) < self._MAX_SOCKETS:
			outputs.append(None)

		return tuple(outputs[:self._MAX_SOCKETS])


def parse_slot_occurrence(key):
	"""
	Parse slot occurrence from key name.
	'image' -> 1, 'image_2' -> 2, 'model_3' -> 3
	"""
	if '_' in key:
		parts = key.rsplit('_', 1)
		try:
			return int(parts[1])
		except ValueError:
			pass
	return 1