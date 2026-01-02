from .base import BaseNode
from .dynamic_passthrough import any_type
from ..config.categories import CATEGORIES

class PT_DynamicAny(BaseNode):
	DESCRIPTION = "Pass any type through unchanged. Type changes based on connection."
	NODE_NAME = "Dynamic Any"

	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": {"input": (any_type,)}
		}

	RETURN_TYPES = (any_type,)
	RETURN_NAMES = ("output",)
	CATEGORY = CATEGORIES["dynamic"]

	def run(self, **kwargs):
		val = kwargs.get("input_1")
		if val is None:
			val = kwargs.get("input")
		return (val,)