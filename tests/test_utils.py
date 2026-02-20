import sys

from python.utils.wsl_patch import apply_wsl_safetensors_patch


def test_patch_applies_without_error():
	apply_wsl_safetensors_patch()


def test_patch_handles_missing_safetensors(monkeypatch):
	monkeypatch.delitem(sys.modules, "safetensors", raising = False)
	monkeypatch.delitem(sys.modules, "safetensors.torch", raising = False)
	apply_wsl_safetensors_patch()