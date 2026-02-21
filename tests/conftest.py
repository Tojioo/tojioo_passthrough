import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest


# Add the python directory to path so tojioo_passthrough is importable
python_dir = Path(__file__).parent.parent
if str(python_dir) not in sys.path:
	sys.path.insert(0, str(python_dir))


def mock_if_missing(mod_names):
	for mod_name in mod_names:
		if mod_name not in sys.modules:
			try:
				__import__(mod_name)
			except ImportError:
				sys.modules[mod_name] = MagicMock()


mock_if_missing(["folder_paths", "comfy", "comfy.utils"])
mock_if_missing(
	["torch", "numpy", "PIL", "PIL.Image", "PIL.PngImagePlugin", "safetensors", "safetensors.torch"]
)

import folder_paths


if isinstance(folder_paths, MagicMock):
	temp_dir = tempfile.gettempdir()
	folder_paths.get_temp_directory.return_value = temp_dir
	folder_paths.get_save_image_path.return_value = (temp_dir, "preview", 0, "", "")

import torch


# Stubs torch functions for shape inference and concatenation
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


		def cpu(self):
			return self


		def detach(self):
			return self


		def expand(self, *sizes):
			new_shape = []
			for i, s in enumerate(sizes):
				if s == -1:
					new_shape.append(self.shape[i])
				else:
					new_shape.append(s)
			return TensorStub(tuple(new_shape))


		def permute(self, *dims):
			if not dims:
				return self
			return TensorStub(tuple(self.shape[d] for d in dims))


		def numpy(self):
			import numpy

			if isinstance(numpy, MagicMock):
				return MagicMock()
			return numpy.zeros(self.shape)


	torch.Tensor = TensorStub
	torch.randn = lambda *args: TensorStub(args)
	torch.cat = lambda tensors, dim = 0: TensorStub(
		(sum(t.shape[0] for t in tensors), *tensors[0].shape[1:])
	)


@pytest.fixture
def torch_stub():
	import torch

	return torch


def pytest_ignore_collect(collection_path, config):
	try:
		candidate = Path(str(collection_path))
	except Exception:
		return False
	root_init = Path(str(config.rootpath)) / "__init__.py"
	return candidate.resolve() == root_init.resolve()