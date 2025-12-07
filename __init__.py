# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from typing import Dict, Tuple, Any

# ============================================================================
# Configuration
# ============================================================================

# Note: Add a toggle on primitive type nodes for this in the future.
# Change to False for widgets instead of sockets.
_FORCE_INPUT = True

# Primitive types that should be sockets, not widgets
_FORCE_INPUT_TYPES = {"INT", "FLOAT", "BOOLEAN"}

# ============================================================================
# Categories
# ============================================================================

CATEGORY_PREFIX = "Tojioo/"
CATEGORY_PASSTHROUGH = "Passthrough"
CATEGORY_UTIL = "Utility"

# ============================================================================
# ComfyUI Type Specifications
# ============================================================================

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

# ============================================================================
# Node UI Specifications
# ============================================================================

# Per-node input/output specs (ordered). Third element is optional socket options dict.
NODE_UI_SPECS: Dict[str, Dict[str, Any]] = {
	"PT_MultiPass": {
		"inputs_required": [],
		"inputs_optional": [
			("image", "IMAGE"),
			("mask", "MASK"),
			("latent", "LATENT"),
			("positive", "CONDITIONING"),
			("negative", "CONDITIONING"),
			("clip", "CLIP"),
			("model", "MODEL"),
			("vae", "VAE"),
			("control_net", "CONTROL_NET"),
			("sam_model", "SAM_MODEL"),
			("text", "STRING"),
			("int", "INT", {"forceInput": True}),
			("float", "FLOAT", {"forceInput": True}),
			("boolean", "BOOLEAN", {"forceInput": True}),
		],
		"outputs": [
			("image", "IMAGE"),
			("mask", "MASK"),
			("latent", "LATENT"),
			("positive", "CONDITIONING"),
			("negative", "CONDITIONING"),
			("clip", "CLIP"),
			("model", "MODEL"),
			("vae", "VAE"),
			("control_net", "CONTROL_NET"),
			("sam_model", "SAM_MODEL"),
			("text", "STRING"),
			("int", "INT"),
			("float", "FLOAT"),
			("boolean", "BOOLEAN"),
		],
	},
	"PT_Conditioning": {
		"inputs_required": [
			("positive", "CONDITIONING"),
			("negative", "CONDITIONING"),
		],
		"inputs_optional": [],
		"outputs": [
			("positive", "CONDITIONING"),
			("negative", "CONDITIONING"),
		],
	},
	"PT_AnyImageBatchSwitch": {
		"node_name": "Any Image Batch Switch",
		"inputs_required": [],
		"inputs_optional": [("image_1", "IMAGE")],
		"outputs": [("IMAGE", "IMAGE")],
	},
	"PT_AnyMaskBatchSwitch": {
		"node_name": "Any Mask Batch Switch",
		"inputs_required": [],
		"inputs_optional": [("mask_1", "MASK")],
		"outputs": [("MASK", "MASK")],
	},
	"PT_AnyLatentBatchSwitch": {
		"node_name": "Any Latent Batch Switch",
		"inputs_required": [],
		"inputs_optional": [("latent_1", "LATENT")],
		"outputs": [("LATENT", "LATENT")],
	},
	"PT_AnyConditioningBatchSwitch": {
		"node_name": "Any Conditioning Batch Switch",
		"inputs_required": [],
		"inputs_optional": [("cond_1", "CONDITIONING")],
		"outputs": [("CONDITIONING", "CONDITIONING")],
	},
	"PT_AnyImageSwitch": {
		"node_name": "Any Image Switch",
		"inputs_required": [],
		"inputs_optional": [("image_1", "IMAGE")],
		"outputs": [("IMAGE", "IMAGE")],
	},
	"PT_AnyMaskSwitch": {
		"node_name": "Any Mask Switch",
		"inputs_required": [],
		"inputs_optional": [("mask_1", "MASK")],
		"outputs": [("MASK", "MASK")],
	},
	"PT_AnyLatentSwitch": {
		"node_name": "Any Latent Switch",
		"inputs_required": [],
		"inputs_optional": [("latent_1", "LATENT")],
		"outputs": [("LATENT", "LATENT")],
	},
	"PT_AnyCLIPSwitch": {
		"node_name": "Any CLIP Switch",
		"inputs_required": [],
		"inputs_optional": [("clip_1", "CLIP")],
		"outputs": [("CLIP", "CLIP")],
	},
	"PT_AnyModelSwitch": {
		"node_name": "Any Model Switch",
		"inputs_required": [],
		"inputs_optional": [("model_1", "MODEL")],
		"outputs": [("MODEL", "MODEL")],
	},
	"PT_AnyVAESwitch": {
		"node_name": "Any VAE Switch",
		"inputs_required": [],
		"inputs_optional": [("vae_1", "VAE")],
		"outputs": [("VAE", "VAE")],
	},
	"PT_AnyControlNetSwitch": {
		"node_name": "Any ControlNet Switch",
		"inputs_required": [],
		"inputs_optional": [("control_net_1", "CONTROL_NET")],
		"outputs": [("CONTROL_NET", "CONTROL_NET")],
	},
	"PT_AnySAMModelSwitch": {
		"node_name": "Any SAM Model Switch",
		"inputs_required": [],
		"inputs_optional": [("sam_model_1", "SAM_MODEL")],
		"outputs": [("SAM_MODEL", "SAM_MODEL")],
	},
	"PT_AnyStringSwitch": {
		"node_name": "Any String Switch",
		"inputs_required": [],
		"inputs_optional": [("text_1", "STRING", {"forceInput": True})],
		"outputs": [("STRING", "STRING")],
	},
	"PT_AnyIntSwitch": {
		"node_name": "Any Int Switch",
		"inputs_required": [],
		"inputs_optional": [("int_1", "INT", {"forceInput": True})],
		"outputs": [("INT", "INT")],
	},
	"PT_AnyFloatSwitch": {
		"node_name": "Any Float Switch",
		"inputs_required": [],
		"inputs_optional": [("float_1", "FLOAT", {"forceInput": True})],
		"outputs": [("FLOAT", "FLOAT")],
	},
	"PT_AnyBoolSwitch": {
		"node_name": "Any Bool Switch",
		"inputs_required": [],
		"inputs_optional": [("boolean_1", "BOOLEAN", {"forceInput": True})],
		"outputs": [("BOOLEAN", "BOOLEAN")],
	},
}

# ============================================================================
# Import Node Modules
# ============================================================================

from .passthrough import create_passthrough_nodes
from .utility import create_utility_nodes

# ============================================================================
# Node Registration
# ============================================================================

# Create all passthrough nodes
_passthrough_nodes = create_passthrough_nodes(
	type_specs=TYPE_SPECS,
	force_input_types=_FORCE_INPUT_TYPES,
	force_input=_FORCE_INPUT,
	category=CATEGORY_PREFIX + CATEGORY_PASSTHROUGH,
	node_ui_specs=NODE_UI_SPECS,
)

# Create all utility nodes
_utility_nodes = create_utility_nodes(
	category=CATEGORY_PREFIX + CATEGORY_PASSTHROUGH + "/" + CATEGORY_UTIL,
	node_ui_specs=NODE_UI_SPECS,
)

# Combine all nodes
NODE_CLASS_MAPPINGS: Dict[str, Any] = {
	**_passthrough_nodes,
	**_utility_nodes,
}

# Display names shown in the UI menu for each node
NODE_DISPLAY_NAME_MAPPINGS: Dict[str, str] = {
	# Multi-node utilities
	"PT_MultiPass": "Multi-Passthrough",
	"PT_Conditioning": "Conditioning Passthrough",
	"PT_AnyImageBatchSwitch": "Any Image Batch Switch",
	"PT_AnyMaskBatchSwitch": "Any Mask Batch Switch",
	"PT_AnyLatentBatchSwitch": "Any Latent Batch Switch",
	"PT_AnyConditioningBatchSwitch": "Any Conditioning Batch Switch",
	# Any*Switch
	"PT_AnyImageSwitch": "Any Image Switch",
	"PT_AnyMaskSwitch": "Any Mask Switch",
	"PT_AnyLatentSwitch": "Any Latent Switch",
	"PT_AnyCLIPSwitch": "Any CLIP Switch",
	"PT_AnyModelSwitch": "Any Model Switch",
	"PT_AnyVAESwitch": "Any VAE Switch",
	"PT_AnyControlNetSwitch": "Any ControlNet Switch",
	"PT_AnySAMModelSwitch": "Any SAM Model Switch",
	"PT_AnyStringSwitch": "Any String Switch",
	"PT_AnyIntSwitch": "Any Int Switch",
	"PT_AnyFloatSwitch": "Any Float Switch",
	"PT_AnyBoolSwitch": "Any Bool Switch",
	# Simple passthroughs
	"PT_Image": "Image Passthrough",
	"PT_Mask": "Mask Passthrough",
	"PT_Latent": "Latent Passthrough",
	"PT_CLIP": "CLIP Passthrough",
	"PT_Model": "Model Passthrough",
	"PT_VAE": "VAE Passthrough",
	"PT_ControlNet": "ControlNet Passthrough",
	"PT_SAMModel": "SAM Model Passthrough",
	"PT_String": "String Passthrough",
	"PT_Int": "Int Passthrough",
	"PT_Float": "Float Passthrough",
	"PT_Bool": "Bool Passthrough",
}

# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]

# Tell ComfyUI where to load our frontend JS from
WEB_DIRECTORY = "js"
