from unittest.mock import MagicMock

import pytest

from python.nodes.base import AnyType, BaseNode, FlexibleOptionalInputType
from python.nodes.conditioning import PT_Conditioning
from python.nodes.dual_clip_encode import PT_DualCLIPEncode
from python.nodes.dynamic_any import PT_DynamicAny
from python.nodes.dynamic_bus import PT_DynamicBus
from python.nodes.dynamic_passthrough import PT_DynamicPassthrough
from python.nodes.dynamic_preview import PT_DynamicPreview
from python.nodes.multi_pass import PT_MultiPass


def test_base_node_defaults():
	assert BaseNode.FUNCTION == "run"
	assert BaseNode.CATEGORY == "Tojioo Passthrough"


	class NamedNode(BaseNode):
		NODE_NAME = "Named"


	class DefaultNode(BaseNode):
		pass


	assert NamedNode.get_display_name() == "Named"
	assert DefaultNode.get_display_name() == ""


def test_any_type_matches_strings():
	any_type = AnyType("*")
	assert any_type == "IMAGE"
	assert any_type == "MODEL"
	assert (any_type == 123) is False
	assert (any_type is None) is False
	assert hash(any_type) == hash("*")


def test_flexible_optional_input_type():
	flex = FlexibleOptionalInputType("TEST")
	assert "anything" in flex
	assert flex["image_5"] == ("TEST",)


@pytest.mark.parametrize(
	"inputs",
	[
		{},
		{"image": "img"},
		{"text": "hello", "float": 1.25},
		{"image": "img", "mask": "msk", "latent": "lat", "positive": "pos", "negative": "neg"},
	],
)
def test_multi_pass_connection_combinations(inputs):
	node = PT_MultiPass()
	result = node.run(**inputs)
	expected = tuple(inputs.get(k) for k in PT_MultiPass.RETURN_NAMES)
	assert result == expected


@pytest.mark.parametrize(
	"inputs,expected",
	[
		({}, (None, None)),
		({"positive": "pos"}, ("pos", None)),
		({"negative": "neg"}, (None, "neg")),
		({"positive": "pos", "negative": "neg"}, ("pos", "neg")),
	],
)
def test_conditioning_connection_combinations(inputs, expected):
	node = PT_Conditioning()
	assert node.run(**inputs) == expected


@pytest.mark.parametrize(
	"inputs,expected",
	[
		({}, (None,)),
		({"input": "value"}, ("value",)),
		({"input_1": "primary"}, ("primary",)),
		({"input": "fallback", "input_1": "primary"}, ("primary",)),
	],
)
def test_dynamic_any_connection_combinations(inputs, expected):
	node = PT_DynamicAny()
	assert node.run(**inputs) == expected


def test_dynamic_passthrough_connection_combinations():
	node = PT_DynamicPassthrough()
	result = node.run()
	assert len(result) == PT_DynamicPassthrough._MAX_SOCKETS
	assert all(value is None for value in result)

	result = node.run(input = "first", input_2 = "second")
	assert result[0] == "first"
	assert result[1] == "second"
	assert result[2] is None


def test_dynamic_bus_direct_inputs():
	node = PT_DynamicBus()
	result = node.run(input_1 = "a", input_2 = "b")
	bus = result[0]
	assert bus[0]["data"] == "a"
	assert bus[1]["data"] == "b"
	assert result[1] == "a"
	assert result[2] == "b"


def test_dynamic_bus_hints_match_bus_entries():
	node = PT_DynamicBus()
	bus = {
		0: "raw",
		1: {"data": "image", "type": "IMAGE"},
		2: {"data": "mask", "type": "MASK"},
	}
	result = node.run(bus = bus, _output_hints = "1:*,2:IMAGE,3:MASK")
	assert result[1] == "raw"
	assert result[2] == "image"
	assert result[3] == "mask"


def test_dynamic_bus_direct_input_overrides_bus():
	node = PT_DynamicBus()
	bus = {0: {"data": "old", "type": "IMAGE"}}
	result = node.run(bus = bus, input_1 = "new", _output_hints = "1:IMAGE:1")
	assert result[1] == "new"
	assert result[0][1]["data"] == "new"


def test_dynamic_preview_empty_result():
	node = PT_DynamicPreview()
	assert node.preview_images() == {"ui": {"preview_data": [], "text_data": []}}


def test_dynamic_preview_connected_inputs(monkeypatch, torch_stub):
	from PIL import Image
	import tempfile
	import folder_paths

	if not isinstance(Image, MagicMock):
		monkeypatch.setattr(Image.Image, "save", lambda *args, **kwargs: None, raising = False)

	temp_dir = tempfile.gettempdir()
	monkeypatch.setattr(folder_paths, "get_temp_directory", lambda: temp_dir, raising = False)
	monkeypatch.setattr(
		folder_paths,
		"get_save_image_path",
		lambda *args, **kwargs: (temp_dir, "preview", 0, "", ""),
		raising = False,
	)

	node = PT_DynamicPreview()
	image_a = torch_stub.randn(64, 64, 3)
	image_b = torch_stub.randn(64, 64, 3)
	result = node.preview_images(input_1 = image_a, input_2 = image_b)
	assert "ui" in result
	assert len(result["ui"]["preview_data"]) == 2
	assert all("slot" in entry for entry in result["ui"]["preview_data"])
	assert result["ui"]["text_data"] == []


def test_dynamic_preview_mask_input(monkeypatch, torch_stub):
	from PIL import Image
	import tempfile
	import folder_paths

	if not isinstance(Image, MagicMock):
		monkeypatch.setattr(Image.Image, "save", lambda *args, **kwargs: None, raising = False)

	temp_dir = tempfile.gettempdir()
	monkeypatch.setattr(folder_paths, "get_temp_directory", lambda: temp_dir, raising = False)
	monkeypatch.setattr(
		folder_paths,
		"get_save_image_path",
		lambda *args, **kwargs: (temp_dir, "preview", 0, "", ""),
		raising = False,
	)

	node = PT_DynamicPreview()
	mask = torch_stub.randn(64, 64)
	result = node.preview_images(input_1 = mask)
	assert len(result["ui"]["preview_data"]) == 1
	assert result["ui"]["preview_data"][0]["slot"] == 0
	assert result["ui"]["text_data"] == []


def test_dynamic_preview_text_input():
	node = PT_DynamicPreview()
	result = node.preview_images(input_1 = "hello world")
	assert result["ui"]["preview_data"] == []
	assert len(result["ui"]["text_data"]) == 1
	assert result["ui"]["text_data"][0]["slot"] == 0
	assert result["ui"]["text_data"][0]["text"] == "hello world"


def test_dynamic_preview_mixed_inputs(monkeypatch, torch_stub):
	from PIL import Image
	import tempfile
	import folder_paths

	if not isinstance(Image, MagicMock):
		monkeypatch.setattr(Image.Image, "save", lambda *args, **kwargs: None, raising = False)

	temp_dir = tempfile.gettempdir()
	monkeypatch.setattr(folder_paths, "get_temp_directory", lambda: temp_dir, raising = False)
	monkeypatch.setattr(
		folder_paths,
		"get_save_image_path",
		lambda *args, **kwargs: (temp_dir, "preview", 0, "", ""),
		raising = False,
	)

	node = PT_DynamicPreview()
	image = torch_stub.randn(64, 64, 3)
	result = node.preview_images(input_1 = image, input_2 = {"key": "value"})
	assert len(result["ui"]["preview_data"]) == 1
	assert len(result["ui"]["text_data"]) == 1
	assert result["ui"]["text_data"][0]["slot"] == 1
	assert "key" in result["ui"]["text_data"][0]["text"]


def test_dynamic_preview_dict_text():
	node = PT_DynamicPreview()
	result = node.preview_images(input_1 = {"a": 1, "b": [2, 3]})
	text = result["ui"]["text_data"][0]["text"]
	assert '"a": 1' in text
	assert '"b"' in text


def test_dual_clip_encode_round_trip():
	class ClipStub:

		@staticmethod
		def tokenize(text):
			return f"tokens:{text}"


		@staticmethod
		def encode_from_tokens_scheduled(tokens):
			return f"cond:{tokens}"


	node = PT_DualCLIPEncode()
	result = node.run(ClipStub(), "pos", "neg")
	assert result == ("cond:tokens:pos", "cond:tokens:neg")


def test_dual_clip_encode_requires_clip():
	node = PT_DualCLIPEncode()
	with pytest.raises(RuntimeError):
		node.run(None, "pos", "neg")