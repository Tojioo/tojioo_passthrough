# SPDX-License-Identifier: GPL-3.0-only


class TestWSLPatch:
	def test_patch_applies_without_error(self):
		from py.utils.wsl_patch import apply_wsl_safetensors_patch
		apply_wsl_safetensors_patch()

	def test_patch_handles_missing_safetensors(self, monkeypatch):
		import sys
		from py.utils.wsl_patch import apply_wsl_safetensors_patch

		monkeypatch.delitem(sys.modules, "safetensors", raising=False)
		apply_wsl_safetensors_patch()