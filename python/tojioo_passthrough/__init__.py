# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from typing import Dict, Any

from .controllers.passthrough_controller import PassthroughController
from .controllers.switch_controller import SwitchController
from .nodes.conditioning import PT_Conditioning
from .nodes.dynamic_any import PT_DynamicAny
from .nodes.dynamic_bus import PT_DynamicBus
from .nodes.dynamic_passthrough import PT_DynamicPassthrough
from .nodes.dynamic_preview import PT_DynamicPreview
from .nodes.multi_pass import PT_MultiPass
from .utils.wsl_patch import apply_wsl_safetensors_patch


apply_wsl_safetensors_patch()

NODE_CLASS_MAPPINGS: Dict[str, Any] = {
	"PT_MultiPass": PT_MultiPass,
	"PT_Conditioning": PT_Conditioning,
	"PT_DynamicPassthrough": PT_DynamicPassthrough,
	"PT_DynamicBus": PT_DynamicBus,
	"PT_DynamicAny": PT_DynamicAny,
	"PT_DynamicPreview": PT_DynamicPreview,
	**PassthroughController.create_nodes(),
	**SwitchController.create_nodes(),
}

NODE_DISPLAY_NAME_MAPPINGS = {
	k: v.NODE_NAME for k, v in NODE_CLASS_MAPPINGS.items()
}