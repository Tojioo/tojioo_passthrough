# SPDX-License-Identifier: GPL-3.0-only

import sys
from pathlib import Path
from unittest.mock import MagicMock

# --- Mocking Infrastructure ---

def mock_if_missing(mod_names):
	for mod_name in mod_names:
		if mod_name not in sys.modules:
			try:
				# Try real import first
				__import__(mod_name)
			except ImportError:
				# Mock if not found
				sys.modules[mod_name] = MagicMock()

# 1. Mock ComfyUI internals (never available on PyPI)
mock_if_missing(["folder_paths", "comfy", "comfy.utils"])

# 2. Mock optional/heavy dependencies (fallbacks)
mock_if_missing(["torch", "numpy", "PIL", "PIL.Image", "PIL.PngImagePlugin", "safetensors", "safetensors.torch"])

# --- Configure Specific Mock Behaviors ---

# Setup folder_paths mock defaults
import folder_paths
if isinstance(folder_paths, MagicMock):
	folder_paths.get_temp_directory.return_value = "/tmp"
	folder_paths.get_save_image_path.return_value = ("/tmp", "preview", 0, "", "")

# Setup torch stub if it's a mock
import torch
if isinstance(torch, MagicMock):
	class TensorStub:
		def __init__(self, shape):
			self.shape = tuple(int(x) for x in shape)
		def dim(self) -> int:
			return len(self.shape)
		def unsqueeze(self, dim: int):
			new_shape = list(self.shape)
			new_shape.insert(dim if dim >= 0 else len(self.shape) + 1 + dim, 1)
			return TensorStub(tuple(new_shape))
		def cpu(self): return self
		def numpy(self):
			import numpy
			if isinstance(numpy, MagicMock):
				return MagicMock()
			return numpy.zeros(self.shape)

	torch.Tensor = TensorStub
	torch.randn = lambda *args: TensorStub(args)
	torch.cat = lambda tensors, dim=0: TensorStub((sum(t.shape[0] for t in tensors), *tensors[0].shape[1:]))

# --- Pytest Hooks ---

import pytest

@pytest.fixture
def torch_stub():
	import torch
	return torch

def pytest_ignore_collect(collection_path, config):
	try:
		p = Path(str(collection_path))
	except Exception:
		return False
	# Ignore root __init__.py if it exists
	root_init = Path(str(config.rootpath)) / "__init__.py"
	if p.resolve() == root_init.resolve():
		return True
	return False