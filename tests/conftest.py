# SPDX-License-Identifier: GPL-3.0-only

import sys
from pathlib import Path

import pytest


@pytest.fixture
def torch_stub():
	return sys.modules["torch"]


def pytest_ignore_collect(collection_path, config):
	try:
		p = Path(str(collection_path))
	except Exception:
		return False
	root_init = Path(str(config.rootpath)) / "__init__.py"
	return p.resolve() == root_init.resolve()