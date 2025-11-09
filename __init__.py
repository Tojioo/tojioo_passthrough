# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from typing import Dict, Tuple, Any

# note: Add a toggle on primitive type nodes for this in the future.
# For now, change this ↓ to False if you want widgets instead of sockets.
_FORCE_INPUT = True

CATEGORY_PREFIX = "Tojioo/"
CATEGORY_PASSTHROUGH = "Passthrough"
CATEGORY_UTIL = "Utility"

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
			"CATEGORY": CATEGORY_PREFIX + CATEGORY_PASSTHROUGH,
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
	CATEGORY = CATEGORY_PREFIX + CATEGORY_PASSTHROUGH

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
	CATEGORY = CATEGORY_PREFIX + CATEGORY_PASSTHROUGH

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

# Note: Shitty name. Gotta find something better.
class PT_AnyImageBatchSwitch:
	"""
	Fallback-or-batch for IMAGE inputs.
	Takes multiple optional IMAGE inputs.
	 - If only one valid input is connected, it passes it through.
	 - If multiple valid inputs are connected, it batches them into one IMAGE batch.
	Batching groups by matching HxWxC. It concatenates the largest compatible group along batch dim.
	"""
	DESCRIPTION = "IMAGE fallback with automatic batching when multiple inputs are present."
	NODE_NAME = "Any Image Batch Switch"

	@classmethod
	def INPUT_TYPES (cls):
		# Eight optional IMAGE inputs in fixed priority order
		opt = {f"image_{i}": ("IMAGE",) for i in range(1, 9)}
		return {"required": {}, "optional": opt}

	RETURN_TYPES = ("IMAGE",)
	RETURN_NAMES = ("IMAGE",)
	FUNCTION = "run"
	CATEGORY = CATEGORY_PREFIX + CATEGORY_PASSTHROUGH + "/" + CATEGORY_UTIL

	def _ensure_4d (self, img):
		# ComfyUI IMAGE is typically [B,H,W,C]. If single, ensure batch dimension.
		if hasattr(img, "dim") and img.dim() == 3:
			return img.unsqueeze(0)
		return img

	def run (self, **kwargs):
		# Keep priority order like a switch
		names = [f"image_{i}" for i in range(1, 9)]
		images = []
		for n in names:
			val = kwargs.get(n, None)
			if val is not None:
				images.append(val)

		if not images:
			raise ValueError(f"{self.NODE_NAME}: no IMAGE inputs connected.")

		# If single valid input, pass through unchanged
		if len(images) == 1:
			return (images[0],)

		# Multiple inputs: batch by compatible spatial shape
		import torch

		prepped = []
		for img in images:
			t = self._ensure_4d(img)
			if not isinstance(t, torch.Tensor):
				raise TypeError(f"{self.NODE_NAME} expects IMAGE tensors.")
			prepped.append(t)

		# Group by HxWxC (ignore batch size)
		from collections import defaultdict

		def shape_key (t: "torch.Tensor"):
			if t.dim() != 4:
				raise ValueError(f"IMAGE must be 4D [B,H,W,C], got {t.shape}.")
			return int(t.shape[1]), int(t.shape[2]), int(t.shape[3])

		groups = defaultdict(list)
		for t in prepped:
			groups[shape_key(t)].append(t)

		# Pick the largest compatible group by total resulting batch size
		candidates = []
		for k, ts in groups.items():
			total_b = sum(int(t.shape[0]) for t in ts)
			candidates.append((total_b, k, ts))
		candidates.sort(reverse = True)  # highest total batch first

		_, _, best = candidates[0]

		if len(best) == 1:
			# Only one compatible source after shape check, pass it through
			return (best[0],)

		# Concatenate along batch dimension
		batched = torch.cat(best, dim = 0)
		return (batched,)

# Register new node
NODE_CLASS_MAPPINGS.update({
	"PT_AnyImageBatchSwitch": PT_AnyImageBatchSwitch,
})

NODE_DISPLAY_NAME_MAPPINGS.update({
	"PT_AnyImageBatchSwitch": f"{PT_AnyImageBatchSwitch.NODE_NAME} (Tojioo Passthrough)",
})
