from .base import BaseNode, AnyType, FlexibleOptionalInputType
from ..config.categories import CATEGORIES


any_type = AnyType("*")


def parse_slot_occurrence(key: str) -> int:
	"""Parse slot occurrence from key name. Returns 1-based index."""
	if '_' in key:
		parts = key.rsplit('_', 1)
		try:
			return int(parts[1])
		except ValueError:
			pass
	return 1


class PT_DynamicBus(BaseNode):
	NODE_NAME = "Dynamic Bus (Beta)"
	DESCRIPTION = "Pack values into a bus, unpack values from a received bus, or passthrough."
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
	RETURN_NAMES = ("bus",) + ("output",) + tuple(f"output_{i}" for i in range(2, _MAX_SOCKETS))
	OUTPUT_IS_LIST = tuple(False for _ in range(_MAX_SOCKETS))
	CATEGORY = CATEGORIES["dynamic"]


	def run(self, bus = None, **kwargs):
		if bus is None:
			bus_dict = {}
		elif isinstance(bus, dict):
			bus_dict = {}
			for k, v in bus.items():
				try:
					bus_dict[int(k)] = v
				except (ValueError, TypeError):
					bus_dict[k] = v
		else:
			bus_dict = {}

		direct_inputs = {}
		used = {k for k in bus_dict.keys() if isinstance(k, int)}
		next_idx = 0
		while next_idx in used:
			next_idx += 1

		for key, value in kwargs.items():
			if value is None:
				continue
			bus_idx = self._try_parse_bus_idx(key)
			if bus_idx is None:
				while next_idx in used:
					next_idx += 1
				bus_idx = next_idx
			used.add(bus_idx)
			direct_inputs[bus_idx] = value
			bus_dict[bus_idx] = value

		outputs = [bus_dict]
		for i in range(self._MAX_SOCKETS - 1):
			if i in direct_inputs:
				outputs.append(direct_inputs[i])
			else:
				val = bus_dict.get(i)
				if val is None:
					val = bus_dict.get(str(i))
				outputs.append(val)

		return tuple(outputs[:self._MAX_SOCKETS])


	@staticmethod
	def _try_parse_bus_idx(key: str):
		if key == "input":
			return 0
		if key.startswith("input_"):
			try:
				n = int(key.split("_")[-1])
				if n > 0:
					return n - 1
			except (ValueError, IndexError):
				pass
		return None