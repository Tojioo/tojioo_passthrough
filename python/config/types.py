from typing import Tuple


COMFY_TYPES = {
	"image": "IMAGE",
	"mask": "MASK",
	"latent": "LATENT",
	"clip": "CLIP",
	"model": "MODEL",
	"vae": "VAE",
	"control_net": "CONTROL_NET",
	"sam_model": "SAM_MODEL",
	"string": "STRING",
	"int": "INT",
	"float": "FLOAT",
	"boolean": "BOOLEAN",
	"conditioning": "CONDITIONING",
	"bus": "BUS",
	"any": "*"
}

TYPE_SPECS: Tuple[Tuple[str, str, str], ...] = (
	("PT_Image", "IMAGE", "image"),
	("PT_Mask", "MASK", "mask"),
	("PT_Latent", "LATENT", "latent"),
	("PT_CLIP", "CLIP", "clip"),
	("PT_Model", "MODEL", "model"),
	("PT_VAE", "VAE", "vae"),
	("PT_ControlNet", "CONTROL_NET", "control_net"),
	("PT_SAMModel", "SAM_MODEL", "sam_model"),
	("PT_String", "STRING", "string"),
	("PT_Int", "INT", "int"),
	("PT_Float", "FLOAT", "float"),
	("PT_Bool", "BOOLEAN", "boolean")
)

FORCE_INPUT_TYPES = {"INT", "FLOAT", "BOOLEAN", "STRING"}
BATCHABLE_TYPES = {"IMAGE", "MASK", "LATENT", "CONDITIONING"}