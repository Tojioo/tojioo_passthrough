from .base import BaseNode, AnyType, FlexibleOptionalInputType
from ..config.categories import CATEGORIES


any_type = AnyType("*")


class PT_DynamicPassthrough(BaseNode):
	NODE_NAME = "Dynamic Passthrough"
	DESCRIPTION = "Dynamic passthrough with one output per input. Types and slots appear dynamically based on connections."
	_MAX_SOCKETS = 32


	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": FlexibleOptionalInputType(any_type)
		}


	@classmethod
	def VALIDATE_INPUTS(cls, **kwargs) -> bool:
		return True


	RETURN_TYPES = tuple(any_type for _ in range(_MAX_SOCKETS))
	RETURN_NAMES = tuple(
		"output" if i == 0 else f"output_{i + 1}"
		for i in range(_MAX_SOCKETS)
	)
	OUTPUT_IS_LIST = tuple(False for _ in range(_MAX_SOCKETS))
	CATEGORY = CATEGORIES["dynamic"]


	def run(self, **kwargs):
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
		if key.startswith("input_"):
			try:
				return int(key.split("_")[-1])
			except (ValueError, IndexError):
				pass
		return 1