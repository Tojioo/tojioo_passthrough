import pytest

from python.controllers.passthrough_controller import PassthroughController


@pytest.fixture(scope = "module")
def passthrough_nodes():
	return PassthroughController.create_nodes()


@pytest.mark.parametrize(
	"class_name,display_name,description",
	[
		("PT_Image", "Image Passthrough", "Image passthrough."),
		("PT_ControlNet", "ControlNet Passthrough", "ControlNet passthrough."),
		("PT_SAMModel", "SAM Model Passthrough", "SAM Model passthrough."),
		("PT_CLIP", "CLIP Passthrough", "CLIP passthrough."),
		("PT_IntWidget", "Int Passthrough (Widget)", "Int passthrough."),
	],
)
def test_passthrough_names_are_readable(passthrough_nodes, class_name, display_name, description):
	node_cls = passthrough_nodes[class_name]
	assert node_cls.NODE_NAME == display_name
	assert node_cls.DESCRIPTION == description
