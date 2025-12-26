# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

import sys
from pathlib import Path

# Ensure the package directory is in the path for ComfyUI loading
_package_dir = Path(__file__).parent
if str(_package_dir) not in sys.path:
	sys.path.insert(0, str(_package_dir))

from src_python import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS, WEB_DIRECTORY

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]