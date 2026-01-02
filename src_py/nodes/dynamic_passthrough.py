from .base import BaseNode, AnyType, FlexibleOptionalInputType
from ..config.categories import CATEGORIES


any_type = AnyType("*")


class PT_DynamicPassthrough(BaseNode):
	NODE_NAME = "Dynamic Passthrough"
	DESCRIPTION = "Dynamic passthrough with one output per input. Types adapt based on connections."
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
		# Robustly map inputs to outputs by parsing index from name.
		indexed_values = {}
		for key, value in kwargs.items():
			idx = self._parse_slot_index(key) - 1
			if 0 <= idx < self._MAX_SOCKETS:
				indexed_values[idx] = value

		outputs = []
		for i in range(self._MAX_SOCKETS):
			outputs.append(indexed_values.get(i))

		return tuple(outputs)

	@staticmethod
	def _parse_slot_index(key: str) -> int:
		"""
		Extract slot index from key name (1-based).
		'image' -> 1, 'input_2' -> 2, 'anything_3' -> 3
		"""
		if '_' in key:
			parts = key.rsplit('_', 1)
			try:
				return int(parts[1])
			except ValueError:
				pass
		return 1