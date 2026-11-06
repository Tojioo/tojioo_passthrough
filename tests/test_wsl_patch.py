import platform
import sys
import types

import pytest
import torch

from python.utils import wsl_patch


@pytest.fixture
def fake_safetensors(monkeypatch):
	calls = []
	st_torch = types.ModuleType("safetensors.torch")


	def load_file(filename, device = "cpu", *args, **kwargs):
		calls.append(("load_file", filename, device))
		return {"via": "load_file"}


	def load(data):
		calls.append(("load", data))
		return {"via": "load"}


	st_torch.load_file = load_file
	st_torch.load = load
	package = types.ModuleType("safetensors")
	package.torch = st_torch
	monkeypatch.setitem(sys.modules, "safetensors", package)
	monkeypatch.setitem(sys.modules, "safetensors.torch", st_torch)
	return st_torch, load_file, calls


def _set_kernel(monkeypatch, release):
	monkeypatch.setattr(sys, "platform", "linux")
	monkeypatch.setattr(platform, "uname", lambda: types.SimpleNamespace(system = "Linux", release = release))


_WSL2_RELEASE = "5.15.153.1-microsoft-standard-WSL2"


@pytest.mark.parametrize("release,patched", [(_WSL2_RELEASE, True), ("4.4.0-19041-Microsoft", True), ("6.8.0-45-generic", False)])
def test_patch_is_applied_only_on_wsl(monkeypatch, fake_safetensors, release, patched):
	st_torch, original, _ = fake_safetensors
	_set_kernel(monkeypatch, release)

	wsl_patch.apply_wsl_safetensors_patch()

	assert (st_torch.load_file is not original) is patched


def test_patch_is_not_applied_on_windows(monkeypatch, fake_safetensors):
	st_torch, original, _ = fake_safetensors
	monkeypatch.setattr(sys, "platform", "win32")

	wsl_patch.apply_wsl_safetensors_patch()

	assert st_torch.load_file is original


def test_patch_reads_cpu_loads_into_memory_on_wsl(monkeypatch, fake_safetensors, tmp_path):
	st_torch, original, calls = fake_safetensors
	_set_kernel(monkeypatch, _WSL2_RELEASE)
	path = tmp_path / "model.safetensors"
	path.write_bytes(b"data")

	wsl_patch.apply_wsl_safetensors_patch()

	assert st_torch.load_file is not original
	assert st_torch.load_file(str(path)) == {"via": "load"}
	assert st_torch.load_file(str(path), device = torch.device("cpu")) == {"via": "load"}
	assert st_torch.load_file(str(path), device = "cuda:0") == {"via": "load_file"}
	assert calls == [("load", b"data"), ("load", b"data"), ("load_file", str(path), "cuda:0")]


def test_patch_falls_back_when_reading_fails(monkeypatch, fake_safetensors, tmp_path):
	st_torch, _, calls = fake_safetensors
	_set_kernel(monkeypatch, _WSL2_RELEASE)
	missing = str(tmp_path / "missing.safetensors")

	wsl_patch.apply_wsl_safetensors_patch()

	assert st_torch.load_file(missing) == {"via": "load_file"}
	assert calls == [("load_file", missing, "cpu")]
