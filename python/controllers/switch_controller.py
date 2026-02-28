from typing import Dict

from ..config.categories import CATEGORIES
from ..config.types import COMFY_TYPES, FORCE_INPUT_TYPES
from ..handlers.batch_handler import BatchHandler


class SwitchController:
	SWITCH_SPECS = [
		("PT_AnyImageSwitch", "image", "image", "image", "Any Image Switch"),
		("PT_AnyMaskSwitch", "mask", "mask", "mask", "Any Mask Switch"),
		("PT_AnyLatentSwitch", "latent", "latent", "latent", "Any Latent Switch"),
		("PT_AnyCLIPSwitch", "clip", "clip", "clip", "Any CLIP Switch"),
		("PT_AnyModelSwitch", "model", "model", "model", "Any Model Switch"),
		("PT_AnyVAESwitch", "vae", "vae", "vae", "Any VAE Switch"),
		("PT_AnyControlNetSwitch", "control_net", "control_net", "control_net", "Any ControlNet Switch"),
		("PT_AnySAMModelSwitch", "sam_model", "sam_model", "sam_model", "Any SAM Model Switch"),
		("PT_AnyStringSwitch", "string", "string", "string", "Any String Switch"),
		("PT_AnyIntSwitch", "int", "int", "int", "Any Int Switch"),
		("PT_AnyFloatSwitch", "float", "float", "float", "Any Float Switch"),
		("PT_AnyBoolSwitch", "boolean", "boolean", "boolean", "Any Bool Switch"),
	]

	BATCH_SWITCH_SPECS = [
		("PT_AnyImageBatchSwitch", "image", "image", "images", "Any Image Batch Switch"),
		("PT_AnyMaskBatchSwitch", "mask", "mask", "masks", "Any Mask Batch Switch"),
		("PT_AnyLatentBatchSwitch", "latent", "latent", "latents", "Any Latent Batch Switch"),
		("PT_AnyConditioningBatchSwitch", "conditioning", "conditioning", "conditioning", "Any Conditioning Batch Switch"),
	]


	@staticmethod
	def create_nodes() -> Dict[str, type]:
		nodes = {}
		for spec in SwitchController.SWITCH_SPECS:
			nodes[spec[0]] = SwitchController._make_switch(*spec)
		for spec in SwitchController.BATCH_SWITCH_SPECS:
			node = SwitchController._make_batch_switch(*spec)
			if node:
				nodes[spec[0]] = node
		return nodes


	@staticmethod
	def _make_switch(
		class_name: str, type_key: str, input_prefix: str,
		output_name: str, display_name: str):
		type_name = COMFY_TYPES[type_key]
		force_input = type_name in FORCE_INPUT_TYPES

		base_input = f"{input_prefix}_1"
		input_spec = (type_name, {"forceInput": True}) if force_input else (type_name,)


		class DynamicOptional(dict):

			# Intercepts keys with prefix; returns true
			def __contains__(self, key):
				if isinstance(key, str) and key.startswith(input_prefix):
					return True
				return dict.__contains__(self, key)


			# Returns input type if key starts with prefix
			def __getitem__(self, key):
				if isinstance(key, str) and key.startswith(input_prefix):
					return input_spec
				return dict.__getitem__(self, key)


		def _idx_from_name(n: str) -> int:
			i = len(n) - 1
			while i >= 0 and n[i].isdigit():
				i -= 1
			try:
				return int(n[i + 1:]) if i + 1 < len(n) else 10 ** 9
			except Exception:
				return 10 ** 9


		def _run(self, **kwargs):
			candidates = [(_idx_from_name(k), v) for k, v in kwargs.items() if v is not None]
			if not candidates:
				raise ValueError(f"{display_name}: no inputs connected.")
			candidates.sort(key = lambda x: x[0])
			return (candidates[0][1],)


		return type(
			class_name,
			(),
			{
				"DESCRIPTION": f"Returns the first connected {type_name} input by index. Bypassed or muted inputs are ignored.",
				"NODE_NAME": display_name,
				"INPUT_TYPES": classmethod(
					lambda cls: {
						"required": {},
						"optional": DynamicOptional({base_input: input_spec})
					}
				),
				"VALIDATE_INPUTS": classmethod(lambda cls, **kwargs: True),
				"RETURN_TYPES": (type_name,),
				"RETURN_NAMES": (output_name,),
				"FUNCTION": "run",
				"CATEGORY": CATEGORIES["switch"],
				"run": _run,
			}
		)


	@staticmethod
	def _make_batch_switch(
		class_name: str, type_key: str, input_prefix: str,
		output_name: str, display_name: str):
		"""Creates batch switch node type with dynamic inputs"""
		type_name = COMFY_TYPES[type_key]

		if not BatchHandler.can_batch(type_name):
			return None

		handler = BatchHandler.get_handler(type_name)
		if not handler:
			return None

		prep_fn, merge_fn = handler
		base_input = f"{input_prefix}_1"


		class DynamicOptional(dict):

			# Intercepts keys with prefix; returns true
			def __contains__(self, key):
				if isinstance(key, str) and key.startswith(input_prefix):
					return True
				return dict.__contains__(self, key)


			# Returns input type if key starts with prefix
			def __getitem__(self, key):
				if isinstance(key, str) and key.startswith(input_prefix):
					return (type_name,)
				return dict.__getitem__(self, key)


		def _run(self, **kwargs):
			values = [v for v in kwargs.values() if v is not None]
			if not values:
				raise ValueError(f"{display_name}: no {type_name} inputs connected.")
			if len(values) == 1:
				return (values[0],)
			prepped = [prep_fn(v) for v in values]
			return (merge_fn(values, prepped),)


		return type(
			class_name,
			(),
			{
				"DESCRIPTION": f"Returns the first connected {type_name} input, or merges multiple inputs into a batch.",
				"NODE_NAME": display_name,
				"INPUT_TYPES": classmethod(
					lambda cls: {
						"required": {},
						"optional": DynamicOptional({base_input: (type_name,)})
					}
				),
				"VALIDATE_INPUTS": classmethod(lambda cls, **kwargs: True),
				"RETURN_TYPES": (type_name,),
				"RETURN_NAMES": (output_name,),
				"FUNCTION": "run",
				"CATEGORY": CATEGORIES["batch"],
				"run": _run,
			}
		)