# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from typing import Dict, Tuple, Any

# Change to False if you want widgets instead of sockets.
_FORCE_INPUT = True

CATEGORY = "Tojioo/Passthrough"

# Primitive types that should be sockets, not widgets
_FORCE_INPUT_TYPES = {"INT", "FLOAT", "BOOLEAN"}

def _make_passthrough (class_name: str, type_name: str, socket_name: str):
	def _input_types (_cls):
		spec = (
			(type_name, {"forceInput": _FORCE_INPUT})
			if type_name in _FORCE_INPUT_TYPES
			else (type_name,)
		)
		return {"required": {socket_name: spec}}

	def _func (_self, **kwargs):
		return (kwargs[socket_name],)

	return type(
		class_name,
		(),
		{
			"__doc__": f"Pass {type_name} through unchanged.",
			"DESCRIPTION": f"{type_name} passthrough. One input, one output. No changes.",
			"INPUT_TYPES": classmethod(_input_types),
			"RETURN_TYPES": (type_name,),
			"RETURN_NAMES": (socket_name,),
			"FUNCTION": "run",
			"CATEGORY": CATEGORY,
			"run": _func,
		},
	)

# class name, type token, socket/base name
TYPE_SPECS: Tuple[Tuple[str, str, str], ...] = (
	("PT_Image", "IMAGE", "IMAGE"),
	("PT_Mask", "MASK", "MASK"),
	("PT_Latent", "LATENT", "LATENT"),
	("PT_CLIP", "CLIP", "CLIP"),
	("PT_Model", "MODEL", "MODEL"),
	("PT_VAE", "VAE", "VAE"),
	("PT_ControlNet", "CONTROL_NET", "CONTROL_NET"),
	("PT_SAMModel", "SAM_MODEL", "SAM_MODEL"),
	("PT_String", "STRING", "TEXT"),
	("PT_Int", "INT", "INT"),
	("PT_Float", "FLOAT", "FLOAT"),
	("PT_Bool", "BOOLEAN", "BOOLEAN"),
)

_generated = {spec[0]: _make_passthrough(*spec) for spec in TYPE_SPECS}

class PT_Conditioning:
	"""
	Pass positive and negative conditioning unchanged.
	Two inputs, two outputs. Useful to route both branches together.
	"""
	DESCRIPTION = "Passthrough for positive and negative conditioning."

	@classmethod
	def INPUT_TYPES (cls):
		return {
			"required": {
				"positive": ("CONDITIONING",),
				"negative": ("CONDITIONING",),
			}
		}

	RETURN_TYPES = ("CONDITIONING", "CONDITIONING")
	RETURN_NAMES = ("positive", "negative")
	FUNCTION = "run"
	CATEGORY = CATEGORY

	def run (self, positive, negative):
		return positive, negative

class PT_MultiPass:
	"""
	Multi-type passthrough hub. Wire only the sockets you need.
	Provides separate positive and negative conditioning.
	Outputs are statically typed.
	"""
	DESCRIPTION = (
		"Multi-type passthrough. Wire only the sockets you need. "
		"Includes separate positive and negative conditioning."
	)

	@classmethod
	def INPUT_TYPES (cls):
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
				"text": ("STRING",),
				"int": ("INT", {"forceInput": True}),
				"float": ("FLOAT", {"forceInput": True}),
				"boolean": ("BOOLEAN", {"forceInput": True}),
			},
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
		"BOOLEAN",
	)

	# Node output names
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
		"text",
		"int",
		"float",
		"boolean",
	)
	FUNCTION = "run"
	CATEGORY = CATEGORY

	def run (self, **kwargs):
		order = (
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
			"text",
			"int",
			"float",
			"boolean",
		)
		return tuple(kwargs.get(k) for k in order)

NODE_CLASS_MAPPINGS: Dict[str, Any] = {
	"PT_MultiPass": PT_MultiPass,
	"PT_Conditioning": PT_Conditioning,
	**_generated,
}

NODE_DISPLAY_NAME_MAPPINGS: Dict[str, str] = {
	"PT_MultiPass": "Multi-Passthrough (Tojioo Passthrough)",
	"PT_Conditioning": "Conditioning Passthrough (Tojioo Passthrough)",
	"PT_Image": "Image Passthrough (Tojioo Passthrough)",
	"PT_Mask": "Mask Passthrough (Tojioo Passthrough)",
	"PT_Latent": "Latent Passthrough (Tojioo Passthrough)",
	"PT_CLIP": "CLIP Passthrough (Tojioo Passthrough)",
	"PT_Model": "Model Passthrough (Tojioo Passthrough)",
	"PT_VAE": "VAE Passthrough (Tojioo Passthrough)",
	"PT_ControlNet": "ControlNet Passthrough (Tojioo Passthrough)",
	"PT_SAMModel": "SAM Model Passthrough (Tojioo Passthrough)",
	"PT_String": "String Passthrough (Tojioo Passthrough)",
	"PT_Int": "Int Passthrough (Tojioo Passthrough)",
	"PT_Float": "Float Passthrough (Tojioo Passthrough)",
	"PT_Bool": "Bool Passthrough (Tojioo Passthrough)",
}
