from .base import BaseNode
from ..config.categories import CATEGORIES
from ..config.types import COMFY_TYPES


class PT_DualCLIPEncode(BaseNode):
	"""Encodes positive and negative prompts in a single node using a shared CLIP model."""
	NODE_NAME = "Dual CLIP Text Encode"
	DESCRIPTION = "Encodes a positive and negative text prompt into conditioning using a shared CLIP model."


	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {
				"clip": (COMFY_TYPES["clip"],),
				"positive": (COMFY_TYPES["string"], {"multiline": True, "dynamicPrompts": True}),
				"negative": (COMFY_TYPES["string"], {"multiline": True, "dynamicPrompts": True}),
			}
		}


	RETURN_TYPES = (COMFY_TYPES["conditioning"], COMFY_TYPES["conditioning"])
	RETURN_NAMES = ("positive", "negative")
	CATEGORY = CATEGORIES["other"]


	@staticmethod
	def run(clip, positive, negative):
		"""Encodes positive and negative prompts into conditioning"""
		if clip is None:
			return ([], [])

		positive_tokens = clip.tokenize(positive)
		negative_tokens = clip.tokenize(negative)

		positive_cond = clip.encode_from_tokens_scheduled(positive_tokens)
		negative_cond = clip.encode_from_tokens_scheduled(negative_tokens)

		return (positive_cond, negative_cond)