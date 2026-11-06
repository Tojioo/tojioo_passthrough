import pytest


def test_folder_paths_stub_survives_monkeypatch_undo():
	import folder_paths

	patch = pytest.MonkeyPatch()
	patch.setattr(folder_paths, "get_temp_directory", lambda: "patched", raising = False)
	patch.undo()

	assert isinstance(folder_paths.get_temp_directory(), str)