# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from typing import Dict, Tuple, Any

# ============================================================================
# Configuration
# ============================================================================

# Todo: Add a toggle on primitive type nodes for this in the future.
# Note: Does not work right now.
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
    "PT_MultiPass": "Multi-Passthrough (Tojioo Passthrough)",
    "PT_Conditioning": "Conditioning Passthrough (Tojioo Passthrough)",
    "PT_AnyImageBatchSwitch": "Any Image Batch Switch (Tojioo Passthrough)",
    "PT_AnyMaskBatchSwitch": "Any Mask Batch Switch (Tojioo Passthrough)",
    "PT_AnyLatentBatchSwitch": "Any Latent Batch Switch (Tojioo Passthrough)",
    "PT_AnyConditioningBatchSwitch": "Any Conditioning Batch Switch (Tojioo Passthrough)",
    # Simple passthroughs
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

# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]

# Tell ComfyUI where to load our frontend JS from
WEB_DIRECTORY = "js"
