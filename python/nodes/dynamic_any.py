from .base import BaseNode, AnyType
from ..config.categories import CATEGORIES


any_type = AnyType("*")


class PT_DynamicAny(BaseNode):
	NODE_NAME = "Dynamic Any"
	DESCRIPTION = "Pass any type through unchanged. Type changes dynamically based on connections."


	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": {"input": (any_type,)}
		}


	@classmethod
	def VALIDATE_INPUTS(cls, **kwargs) -> bool:
		return True


	RETURN_TYPES = (any_type,)
	RETURN_NAMES = ("output",)
	CATEGORY = CATEGORIES["dynamic"]


	def run(self, **kwargs):
		val = kwargs.get("input_1")
		if val is None:
			val = kwargs.get("input")
		if val is None:
			# Because the frontend renames the input to the connected type, the key can be anything.
			val = next((v for v in kwargs.values() if v is not None), None)
		return (val,)