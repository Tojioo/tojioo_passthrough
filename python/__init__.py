# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from typing import Dict, Any

from .utils.wsl_patch import apply_wsl_safetensors_patch

from .controllers.passthrough_controller import PassthroughController
from .controllers.switch_controller import SwitchController
from .nodes.conditioning import PT_Conditioning
from .nodes.dynamic_any import PT_DynamicAny
from .nodes.dynamic_bus import PT_DynamicBus
from .nodes.dynamic_passthrough import PT_DynamicPassthrough
from .nodes.dynamic_preview import PT_DynamicPreview
from .nodes.multi_pass import PT_MultiPass
from .nodes.dual_clip_encode import PT_DualCLIPEncode
from .nodes.tiled_vae_settings import PT_TiledVAESettings


apply_wsl_safetensors_patch()

NODE_CLASS_MAPPINGS: Dict[str, Any] = {
	**PassthroughController.create_nodes(),
	**SwitchController.create_nodes(),
	"PT_Conditioning": PT_Conditioning,
	"PT_DynamicAny": PT_DynamicAny,
	"PT_DynamicBus": PT_DynamicBus,
	"PT_DynamicPassthrough": PT_DynamicPassthrough,
	"PT_DynamicPreview": PT_DynamicPreview,
	"PT_MultiPass": PT_MultiPass,
	"PT_DualCLIPEncode": PT_DualCLIPEncode,
	"PT_TiledVAESettings": PT_TiledVAESettings,
}

NODE_DISPLAY_NAME_MAPPINGS = {
	k: v.NODE_NAME for k, v in NODE_CLASS_MAPPINGS.items()
}