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


def test_dynamic_bus_overwrite_replaces_first_match():
	node = PT_DynamicBus()
	bus = {0: {"data": "old_image", "type": "IMAGE"}, 1: {"data": "mask", "type": "MASK"}}
	result = node.run(bus = bus, input_1 = "new_image", _slot_types = "1:IMAGE", _overwrite_mode = "1")
	out_bus = result[0]
	assert out_bus[0]["data"] == "new_image"
	assert out_bus[0]["type"] == "IMAGE"
	assert out_bus[1]["data"] == "mask"
	assert len(out_bus) == 2


def test_dynamic_bus_overwrite_appends_when_no_match():
	node = PT_DynamicBus()
	bus = {0: {"data": "mask", "type": "MASK"}}
	result = node.run(bus = bus, input_1 = "image", _slot_types = "1:IMAGE", _overwrite_mode = "1")
	out_bus = result[0]
	assert out_bus[0]["data"] == "mask"
	assert out_bus[1]["data"] == "image"
	assert len(out_bus) == 2


def test_dynamic_bus_overwrite_off_always_appends():
	node = PT_DynamicBus()
	bus = {0: {"data": "old_image", "type": "IMAGE"}}
	result = node.run(bus = bus, input_1 = "new_image", _slot_types = "1:IMAGE", _overwrite_mode = "0")
	out_bus = result[0]
	assert out_bus[0]["data"] == "old_image"
	assert out_bus[1]["data"] == "new_image"
	assert len(out_bus) == 2


def test_dynamic_bus_overwrite_replaces_first_of_multiple():
	node = PT_DynamicBus()
	bus = {0: {"data": "img_1", "type": "IMAGE"}, 1: {"data": "mask", "type": "MASK"}, 2: {"data": "img_2", "type": "IMAGE"}}
	result = node.run(bus = bus, input_1 = "replacement", _slot_types = "1:IMAGE", _overwrite_mode = "1")
	out_bus = result[0]
	assert out_bus[0]["data"] == "replacement"
	assert out_bus[1]["data"] == "mask"
	assert out_bus[2]["data"] == "img_2"
	assert len(out_bus) == 3


def test_dynamic_bus_overwrite_skips_untyped_local():
	"""Untyped local input (ANY_TYPE) always appends, even in overwrite mode."""
	node = PT_DynamicBus()
	bus = {0: {"data": "image", "type": "IMAGE"}}
	result = node.run(bus = bus, input_1 = "untyped", _slot_types = "1:*", _overwrite_mode = "1")
	out_bus = result[0]
	assert out_bus[0]["data"] == "image"
	assert out_bus[1]["data"] == "untyped"
	assert len(out_bus) == 2


def test_dynamic_bus_overwrite_two_locals_same_type():
	"""Two local IMAGEs: first replaces upstream IMAGE, second appends."""
	node = PT_DynamicBus()
	bus = {0: {"data": "old", "type": "IMAGE"}, 1: {"data": "mask", "type": "MASK"}}
	result = node.run(bus = bus, input_1 = "new_1", input_2 = "new_2", _slot_types = "1:IMAGE,2:IMAGE", _overwrite_mode = "1")
	out_bus = result[0]
	assert out_bus[0]["data"] == "new_1"
	assert out_bus[1]["data"] == "mask"
	assert out_bus[2]["data"] == "new_2"
	assert len(out_bus) == 3


def test_dynamic_bus_find_matching_index():
	bus = {0: {"data": "a", "type": "IMAGE"}, 1: {"data": "b", "type": "MASK"}, 2: {"data": "c", "type": "IMAGE"}}
	assert PT_DynamicBus._find_matching_index(bus, "IMAGE", set()) == 0
	assert PT_DynamicBus._find_matching_index(bus, "IMAGE", {0}) == 2
	assert PT_DynamicBus._find_matching_index(bus, "IMAGE", {0, 2}) is None
	assert PT_DynamicBus._find_matching_index(bus, "LATENT", set()) is None


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


class TestConditioningTextExtraction:

	def test_direct_clip_text_encode(self):
		prompt = {
			"5": {"class_type": "CLIPTextEncode", "inputs": {"text": "a photo of a cat", "clip": ["3", 0]}},
		}
		result = PT_DynamicPreview._extract_prompt_text(prompt, "5", 0)
		assert result == "a photo of a cat"


	def test_through_passthrough_chain(self):
		prompt = {
			"5": {"class_type": "CLIPTextEncode", "inputs": {"text": "sunset over mountains", "clip": ["3", 0]}},
			"7": {"class_type": "PT_Conditioning", "inputs": {"positive": ["5", 0]}},
		}
		result = PT_DynamicPreview._extract_prompt_text(prompt, "7", 0)
		assert result == "sunset over mountains"


	def test_dual_clip_positive_output(self):
		prompt = {
			"5": {"class_type": "PT_DualCLIPEncode", "inputs": {"clip": ["3", 0], "positive": "good", "negative": "bad"}},
		}
		assert PT_DynamicPreview._extract_prompt_text(prompt, "5", 0) == "good"
		assert PT_DynamicPreview._extract_prompt_text(prompt, "5", 1) == "bad"


	def test_flux_encode_fields(self):
		prompt = {
			"5": {"class_type": "CLIPTextEncodeFlux", "inputs": {"t5xxl": "main prompt", "l": "clip_l text", "clip": ["3", 0]}},
		}
		result = PT_DynamicPreview._extract_prompt_text(prompt, "5", 0)
		assert "main prompt" in result
		assert "clip_l text" in result


	def test_sdxl_encode_fields(self):
		prompt = {
			"5": {"class_type": "CLIPTextEncodeSDXL", "inputs": {"text_g": "global", "text_l": "local", "clip": ["3", 0]}},
		}
		result = PT_DynamicPreview._extract_prompt_text(prompt, "5", 0)
		assert "global" in result
		assert "local" in result


	def test_unknown_node_returns_none(self):
		prompt = {
			"5": {"class_type": "SomeCustomNode", "inputs": {"value": 42}},
		}
		assert PT_DynamicPreview._extract_prompt_text(prompt, "5", 0) is None


	def test_missing_node_returns_none(self):
		assert PT_DynamicPreview._extract_prompt_text({}, "999", 0) is None
		assert PT_DynamicPreview._extract_prompt_text(None, "5", 0) is None


	def test_cycle_protection(self):
		prompt = {
			"5": {"class_type": "Reroute", "inputs": {"input": ["6", 0]}},
			"6": {"class_type": "Reroute", "inputs": {"input": ["5", 0]}},
		}
		assert PT_DynamicPreview._extract_prompt_text(prompt, "5", 0) is None


	def test_linked_text_field_not_resolved(self):
		prompt = {
			"5": {"class_type": "CLIPTextEncode", "inputs": {"text": ["8", 0], "clip": ["3", 0]}},
			"8": {"class_type": "PrimitiveNode", "inputs": {}},
		}
		assert PT_DynamicPreview._extract_prompt_text(prompt, "5", 0) is None


	def test_resolve_all_conditioning_texts(self):
		prompt = {
			"1": {"class_type": "PT_DynamicPreview", "inputs": {"input_1": ["5", 0], "input_2": ["6", 0]}},
			"5": {"class_type": "CLIPTextEncode", "inputs": {"text": "positive prompt", "clip": ["3", 0]}},
			"6": {"class_type": "CLIPTextEncode", "inputs": {"text": "negative prompt", "clip": ["3", 0]}},
		}
		node = PT_DynamicPreview()
		result = node._resolve_all_conditioning_texts(prompt, "1", {"input_1": "val1", "input_2": "val2"})
		assert result["input_1"] == "positive prompt"
		assert result["input_2"] == "negative prompt"


	def test_resolve_skips_non_link_inputs(self):
		prompt = {
			"1": {"class_type": "PT_DynamicPreview", "inputs": {"input_1": "direct_value"}},
		}
		node = PT_DynamicPreview()
		result = node._resolve_all_conditioning_texts(prompt, "1", {"input_1": "val"})
		assert result == {}


	def test_resolve_with_no_prompt(self):
		node = PT_DynamicPreview()
		assert node._resolve_all_conditioning_texts(None, "1", {"input_1": "val"}) == {}
		assert node._resolve_all_conditioning_texts({}, None, {"input_1": "val"}) == {}


	def test_preview_conditioning_with_prompt(self, torch_stub):
		cond_tensor = torch_stub.randn(1, 77, 768)
		cond_value = [(cond_tensor, {"pooled_output": torch_stub.randn(1, 768)})]

		prompt = {
			"1": {"class_type": "PT_DynamicPreview", "inputs": {"input_1": ["5", 0]}},
			"5": {"class_type": "CLIPTextEncode", "inputs": {"text": "a beautiful sunset", "clip": ["3", 0]}},
		}
		node = PT_DynamicPreview()
		result = node.preview_images(prompt = prompt, unique_id = "1", input_1 = cond_value)
		text = result["ui"]["text_data"][0]["text"]
		assert "Prompt: a beautiful sunset" in text
		assert "CONDITIONING" in text


	def test_preview_conditioning_without_prompt(self, torch_stub):
		cond_tensor = torch_stub.randn(1, 77, 768)
		cond_value = [(cond_tensor, {"pooled_output": torch_stub.randn(1, 768)})]

		node = PT_DynamicPreview()
		result = node.preview_images(input_1 = cond_value)
		text = result["ui"]["text_data"][0]["text"]
		assert "Prompt:" not in text
		assert "CONDITIONING" in text