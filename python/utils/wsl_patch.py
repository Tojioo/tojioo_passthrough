# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

import platform
import sys

from .logger_internal import get_logger


logger = get_logger(__name__)


def _is_wsl() -> bool:
	# Because both WSL1 and WSL2 kernels report "microsoft" in their release string.
	return sys.platform == "linux" and "microsoft" in platform.uname().release.lower()


def apply_wsl_safetensors_patch():
	if not _is_wsl():
		return
	try:
		import safetensors.torch

		_load_file_org = safetensors.torch.load_file


		def _load_file_for_wsl(filename, device = "cpu", *args, **kwargs):
			try:
				if str(device) == "cpu":
					with open(filename, "rb") as f:
						return safetensors.torch.load(f.read())
			except Exception as e:
				logger.warning(f"WSL safetensors patch failed for '{filename}', falling back.",exc_info = e)
			return _load_file_org(filename, device, *args, **kwargs)


		safetensors.torch.load_file = _load_file_for_wsl
		logger.debug("WSL safetensors patch applied")
	except ImportError:
		logger.debug("safetensors not available, skipping WSL patch")