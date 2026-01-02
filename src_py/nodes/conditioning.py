from .base import BaseNode
from ..config.categories import CATEGORIES


class PT_Conditioning(BaseNode):
	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": {
				"positive": ("CONDITIONING",),
				"negative": ("CONDITIONING",),
			}
		}

	OUTPUT_NODE = True
	NODE_NAME = "Conditioning Passthrough"
	CATEGORY = CATEGORIES["simple"]
	DESCRIPTION = "Passthrough for positive and negative conditioning."

	RETURN_TYPES = ("CONDITIONING", "CONDITIONING")
	RETURN_NAMES = ("positive", "negative")

	FUNCTION = "run"

	@staticmethod
	def run(positive=None, negative=None):
		return positive, negative