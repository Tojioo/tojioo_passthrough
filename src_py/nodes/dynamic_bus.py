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

	NODE_NAME = "Dynamic Bus (Beta)"
	DESCRIPTION = "Pack values into a bus, unpack values from a received bus, or just use it as a passthrough."
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

		used = {k for k in bus_dict.keys() if isinstance(k, int)}
		next_idx = 0
		while next_idx in used:
			next_idx += 1

		for key, value in kwargs.items():
			if value is None:
				continue

			bus_idx = try_parse_bus_idx(key)
			if bus_idx is None:
				while next_idx in used:
					next_idx += 1
				bus_idx = next_idx

			used.add(bus_idx)
			direct_inputs[bus_idx] = value
			bus_dict[bus_idx] = value

		outputs = [bus_dict]

		# Use a fixed number of outputs to match RETURN_NAMES
		for i in range(self._MAX_SOCKETS - 1):
			if i in direct_inputs:
				outputs.append(direct_inputs[i])
			else:
				outputs.append(bus_dict.get(i))

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

def try_parse_bus_idx(key: str):
	"""
	Parse bus index from key. 'input_2' -> 1, 'model_3' -> 2.
	Returns None if no valid suffix.
	"""
	if '_' in key:
		_, tail = key.rsplit('_', 1)
		if tail.isdigit():
			n = int(tail)
			if n > 0:
				return n - 1
	return None