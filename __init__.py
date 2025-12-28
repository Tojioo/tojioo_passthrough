# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

import sys
from pathlib import Path

# Ensure the package directory is in the path for ComfyUI loading.
_package_dir = Path(__file__).parent
if _package_dir.as_posix() not in sys.path:
	sys.path.insert(0, _package_dir.as_posix())

# Give Comfy the relevant stuff from src_py.
from src_py import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS, WEB_DIRECTORY

# ♪ We're all in this together ♪
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]