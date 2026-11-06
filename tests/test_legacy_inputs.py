import pytest

from python.controllers.passthrough_controller import PassthroughController
from python.nodes.multi_pass import PT_MultiPass


@pytest.mark.parametrize("class_name", ["PT_String", "PT_StringWidget"])
def test_string_passthrough_accepts_new_and_legacy_input_name(class_name):
	node = PassthroughController.create_nodes()[class_name]()
	assert node.run(string = "new") == ("new",)
	# Needed because workflows saved before the rename still send the old 'text' key.
	assert node.run(text = "old") == ("old",)


def test_multi_pass_accepts_legacy_text_input():
	result = PT_MultiPass().run(text = "old")
	assert result[PT_MultiPass.RETURN_NAMES.index("string")] == "old"


def test_multi_pass_prefers_new_string_input():
	result = PT_MultiPass().run(string = "new", text = "old")
	assert result[PT_MultiPass.RETURN_NAMES.index("string")] == "new"
