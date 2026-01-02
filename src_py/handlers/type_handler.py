from ..config.types import FORCE_INPUT_TYPES

class TypeHandler:
	@staticmethod
	def create_input_spec(type_name: str, force_input: bool = True):
		if force_input and type_name in FORCE_INPUT_TYPES:
			return (type_name, {"forceInput": True})
		return (type_name,)