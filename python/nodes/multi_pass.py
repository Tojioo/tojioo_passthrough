from .base import BaseNode


class PT_MultiPass(BaseNode):
	NODE_NAME = "Multi-Passthrough"
	DESCRIPTION = "Multi-type passthrough. Wire only the sockets you need."


	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {},
			"optional": {
				"image": ("IMAGE",),
				"mask": ("MASK",),
				"latent": ("LATENT",),
				"positive": ("CONDITIONING",),
				"negative": ("CONDITIONING",),
				"clip": ("CLIP",),
				"model": ("MODEL",),
				"vae": ("VAE",),
				"control_net": ("CONTROL_NET",),
				"sam_model": ("SAM_MODEL",),
				"string": ("STRING", {"forceInput": True}),
				"int": ("INT", {"forceInput": True}),
				"float": ("FLOAT", {"forceInput": True}),
				"boolean": ("BOOLEAN", {"forceInput": True}),
			}
		}


	RETURN_TYPES = (
		"IMAGE",
		"MASK",
		"LATENT",
		"CONDITIONING",
		"CONDITIONING",
		"CLIP",
		"MODEL",
		"VAE",
		"CONTROL_NET",
		"SAM_MODEL",
		"STRING",
		"INT",
		"FLOAT",
		"BOOLEAN"
	)

	RETURN_NAMES = (
		"image",
		"mask",
		"latent",
		"positive",
		"negative",
		"clip",
		"model",
		"vae",
		"control_net",
		"sam_model",
		"string",
		"int",
		"float",
		"boolean"
	)

	CATEGORY = "Tojioo Passthrough"


	def run(self, **kwargs):
		return tuple(kwargs.get(k) for k in self.RETURN_NAMES)