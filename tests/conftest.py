# SPDX-License-Identifier: GPL-3.0-only

import sys
import types
from pathlib import Path
from unittest.mock import MagicMock
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
import pytest


def _install_torch_stub(monkeypatch) -> None:
	class Tensor:
		def __init__(self, shape):
			self.shape = tuple(int(x) for x in shape)

		def dim(self) -> int:
			return len(self.shape)

		def unsqueeze(self, dim: int):
			if dim < 0:
				dim = len(self.shape) + 1 + dim
			new_shape = list(self.shape)
			new_shape.insert(dim, 1)
			return Tensor(tuple(new_shape))

	def randn(*shape):
		return Tensor(shape)

	def cat(tensors, dim=0):
		if not tensors:
			raise ValueError("torch.cat expects at least one tensor")
		if dim != 0:
			raise NotImplementedError("torch stub only supports cat(..., dim=0)")

		base = tensors[0].shape
		for t in tensors:
			if t.shape[1:] != base[1:]:
				raise ValueError("torch.cat shape mismatch in torch stub")

		batch = sum(int(t.shape[0]) for t in tensors)
		return Tensor((batch, *base[1:]))

	torch_stub = types.ModuleType("torch")
	torch_stub.Tensor = Tensor
	torch_stub.randn = randn
	torch_stub.cat = cat

	monkeypatch.setitem(sys.modules, "torch", torch_stub)


project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@pytest.fixture(autouse=True)
def mock_comfy_modules(monkeypatch):
	mock_comfy = MagicMock()
	mock_comfy.utils = MagicMock()
	mock_comfy.utils.set_progress_bar_global_hook = MagicMock()

	mock_safetensors = MagicMock()
	mock_safetensors.torch = MagicMock()
	mock_safetensors.torch.load_file = MagicMock()
	mock_safetensors.torch.load = MagicMock()

	monkeypatch.setitem(sys.modules, "comfy", mock_comfy)
	monkeypatch.setitem(sys.modules, "comfy.utils", mock_comfy.utils)
	monkeypatch.setitem(sys.modules, "safetensors", mock_safetensors)
	monkeypatch.setitem(sys.modules, "safetensors.torch", mock_safetensors.torch)

	_install_torch_stub(monkeypatch)


@pytest.fixture
def torch_stub():
	import torch
	return torch


def pytest_ignore_collect(collection_path, config):
	try:
		p = Path(str(collection_path))
	except Exception:
		return False

	root_init = Path(str(config.rootpath)) / "__init__.py"
	return p.resolve() == root_init.resolve()