# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

import sys
import types
from unittest.mock import MagicMock


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


def _randn(*shape):
	return Tensor(shape)


def _cat(tensors, dim=0):
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
torch_stub.randn = _randn
torch_stub.cat = _cat
sys.modules["torch"] = torch_stub

folder_paths_stub = MagicMock()
folder_paths_stub.get_output_directory = MagicMock(return_value="/tmp/output")
folder_paths_stub.get_input_directory = MagicMock(return_value="/tmp/input")
folder_paths_stub.get_temp_directory = MagicMock(return_value="/tmp/temp")
sys.modules["folder_paths"] = folder_paths_stub

comfy_stub = MagicMock()
comfy_stub.utils = MagicMock()
comfy_stub.utils.set_progress_bar_global_hook = MagicMock()
sys.modules["comfy"] = comfy_stub
sys.modules["comfy.utils"] = comfy_stub.utils

safetensors_stub = MagicMock()
safetensors_stub.torch = MagicMock()
safetensors_stub.torch.load_file = MagicMock()
safetensors_stub.torch.load = MagicMock()
sys.modules["safetensors"] = safetensors_stub
sys.modules["safetensors.torch"] = safetensors_stub.torch