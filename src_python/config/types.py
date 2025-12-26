# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

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
	"text": "STRING",
	"int": "INT",
	"float": "FLOAT",
	"boolean": "BOOLEAN",
	"conditioning": "CONDITIONING",
	"bus": "BUS",
	"any": "*"
}

TYPE_SPECS: Tuple[Tuple[str, str, str], ...] = (
	("PT_Image", COMFY_TYPES["image"], "image"),
	("PT_Mask", COMFY_TYPES["mask"], "mask"),
	("PT_Latent", COMFY_TYPES["latent"], "latent"),
	("PT_CLIP", COMFY_TYPES["clip"], "clip"),
	("PT_Model", COMFY_TYPES["model"], "model"),
	("PT_VAE", COMFY_TYPES["vae"], "vae"),
	("PT_ControlNet", COMFY_TYPES["control_net"], "control_net"),
	("PT_SAMModel", COMFY_TYPES["sam_model"], "sam_model"),
	("PT_String", COMFY_TYPES["text"], "text"),
	("PT_Int", COMFY_TYPES["int"], "int"),
	("PT_Float", COMFY_TYPES["float"], "float"),
	("PT_Bool", COMFY_TYPES["boolean"], "boolean")
)

FORCE_INPUT_TYPES = {"INT", "FLOAT", "BOOLEAN", "STRING"}
BATCHABLE_TYPES = {"IMAGE", "MASK", "LATENT", "CONDITIONING"}