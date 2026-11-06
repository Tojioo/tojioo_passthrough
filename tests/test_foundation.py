import importlib.util
import sys
from pathlib import Path

import pytest


def test_folder_paths_stub_survives_monkeypatch_undo():
	import folder_paths

	patch = pytest.MonkeyPatch()
	patch.setattr(folder_paths, "get_temp_directory", lambda: "patched", raising = False)
	patch.undo()

	assert isinstance(folder_paths.get_temp_directory(), str)


def test_pack_loads_as_custom_node_without_global_python_package(monkeypatch):
	pack_dir = Path(__file__).resolve().parent.parent
	# Needed so the pack has to import itself the way ComfyUI loads it, not through the test path setup.
	monkeypatch.setattr(sys, "path", [p for p in sys.path if Path(p or ".").resolve() != pack_dir])
	for name in [n for n in sys.modules if n == "python" or n.startswith("python.")]:
		monkeypatch.delitem(sys.modules, name)
	path_before = list(sys.path)

	module_name = str(pack_dir).replace(".", "_x_")
	spec = importlib.util.spec_from_file_location(module_name, pack_dir / "__init__.py")
	module = importlib.util.module_from_spec(spec)
	monkeypatch.setitem(sys.modules, module_name, module)
	try:
		spec.loader.exec_module(module)

		assert sys.path == path_before
		assert "python" not in sys.modules
		assert len(module.NODE_CLASS_MAPPINGS) == 40
		assert module.NODE_DISPLAY_NAME_MAPPINGS.keys() == module.NODE_CLASS_MAPPINGS.keys()
	finally:
		for name in [n for n in sys.modules if n.startswith(module_name + ".")]:
			del sys.modules[name]