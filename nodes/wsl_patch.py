# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes - WSL Patch Module
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

"""
WSL-specific patch for safetensors.torch.load_file
Handles loading safetensors files in WSL environments.
"""

try:
	from logger import get_logger
except ImportError:
	from ..logger import get_logger

logger = get_logger(__name__)


def apply_wsl_safetensors_patch():
	"""
	Apply WSL-specific patch to safetensors.torch.load_file.
	Falls back to standard loading if safetensors is not available.
	"""
	try:
		import safetensors.torch

		_load_file_org = safetensors.torch.load_file

		def _load_file_for_wsl(filename, device="cpu", *args, **kwargs):
			try:
				if device == "cpu":
					with open(filename, "rb") as f:
						return safetensors.torch.load(f.read())
			except Exception as e:
				logger.warning(
					f"WSL safetensors patch failed for '{filename}' (device={device}), "
					f"falling back to standard loading.",
					exc_info=e
				)
			return _load_file_org(filename, device, *args, **kwargs)

		safetensors.torch.load_file = _load_file_for_wsl
		logger.debug("WSL safetensors patch applied successfully")
	except ImportError:
		# safetensors not available, skip patching
		logger.debug("safetensors not available, skipping WSL patch")