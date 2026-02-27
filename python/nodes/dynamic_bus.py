from .base import BaseNode, AnyType, FlexibleOptionalInputType
from ..config.categories import CATEGORIES


any_type = AnyType("*")


class PT_DynamicBus(BaseNode):
	NODE_NAME = "Dynamic Bus"
	DESCRIPTION = "Pack values into a bus, unpack values from a received bus, or passthrough."
	_MAX_SLOTS = 32


	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": FlexibleOptionalInputType(any_type, {"bus": (any_type,)}),
			"hidden": {
				"_slot_types": ("STRING", {"default": ""}),
				"_output_hints": ("STRING", {"default": ""}),
				"_overwrite_mode": ("STRING", {"default": "0"}),
			}
		}


	@classmethod
	def VALIDATE_INPUTS(cls, **kwargs) -> bool:
		return True


	RETURN_TYPES = tuple(any_type for _ in range(_MAX_SLOTS))
	RETURN_NAMES = ("bus",) + tuple(f"output_{i}" for i in range(1, _MAX_SLOTS))
	OUTPUT_IS_LIST = tuple(False for _ in range(_MAX_SLOTS))
	CATEGORY = CATEGORIES["dynamic"]


	def run(self, bus = None, _slot_types = "", _output_hints = "", _overwrite_mode = "0", **kwargs):
		bus_dict = dict(bus) if isinstance(bus, dict) else {}
		overwrite = str(_overwrite_mode) == "1"

		slot_type_map = {}
		if _slot_types:
			for part in _slot_types.split(","):
				if ":" in part:
					slot_str, type_str = part.split(":", 1)
					try:
						slot_type_map[int(slot_str)] = type_str
					except ValueError:
						pass

		next_bus_idx = max(bus_dict.keys(), default = -1) + 1
		used_bus_indices = set()

		direct_inputs = {}
		for key, value in kwargs.items():
			if value is None or key == "bus" or key.startswith("_"):
				continue
			slot_idx = self._parse_slot_index(key)
			if slot_idx is not None:
				slot_type = slot_type_map.get(slot_idx, "*")

				if overwrite and slot_type != "*":
					match_idx = self._find_matching_index(bus_dict, slot_type, used_bus_indices)
					if match_idx is not None:
						used_bus_indices.add(match_idx)
						bus_dict[match_idx] = {"data": value, "type": slot_type}
						direct_inputs[slot_idx] = value
						continue

				bus_dict[next_bus_idx] = {"data": value, "type": slot_type}
				direct_inputs[slot_idx] = value
				next_bus_idx += 1

		hints = {}
		if _output_hints:
			for part in _output_hints.split(","):
				parts = part.split(":")
				if len(parts) >= 2:
					try:
						slot_idx = int(parts[0])
						hints[slot_idx] = {
							"type": parts[1] if len(parts) > 1 else "*",
							"has_input": parts[2] == "1" if len(parts) > 2 else False
						}
					except ValueError:
						pass

		used_indices = set()
		outputs = [bus_dict]

		for slot_idx in range(1, self._MAX_SLOTS):
			hint = hints.get(slot_idx, {})
			has_input = hint.get("has_input", slot_idx in direct_inputs)
			expected_type = hint.get("type", "*")

			if has_input and slot_idx in direct_inputs:
				outputs.append(direct_inputs[slot_idx])
				continue

			if slot_idx in hints and not has_input:
				match = self._find_matching_value(bus_dict, expected_type, used_indices)
				if match is not None:
					matched_idx, matched_data = match
					used_indices.add(matched_idx)
					outputs.append(matched_data)
					continue

			outputs.append(None)

		return tuple(outputs)


	@staticmethod
	def _find_matching_index(bus_dict, expected_type, used_indices):
		"""Returns the index of the first bus entry with a matching type."""
		for idx in sorted(bus_dict.keys()):
			if idx in used_indices:
				continue
			entry = bus_dict[idx]
			if entry is None:
				continue
			if isinstance(entry, dict) and "data" in entry:
				entry_type = entry.get("type", "*")
			else:
				entry_type = "*"
			if entry_type == expected_type:
				return idx
		return None


	@staticmethod
	def _find_matching_value(bus_dict, expected_type, used_indices):
		"""Returns first matching value from bus dictionary"""
		for idx in sorted(bus_dict.keys()):
			if idx in used_indices:
				continue
			entry = bus_dict[idx]
			if entry is None:
				continue

			if isinstance(entry, dict) and "data" in entry:
				entry_type = entry.get("type", "*")
				entry_data = entry["data"]
			else:
				entry_type = "*"
				entry_data = entry

			if expected_type == "*" or entry_type == "*" or entry_type == expected_type:
				return idx, entry_data
		return None


	@staticmethod
	def _parse_slot_index(key: str) -> int | None:
		if key.startswith("input_"):
			try:
				return int(key.split("_")[-1])
			except (ValueError, IndexError):
				pass
		return None