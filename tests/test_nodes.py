# SPDX-License-Identifier: GPL-3.0-only


class TestBaseNode:
	def test_base_node_exists(self):
		from src_py.nodes.base import BaseNode
		assert BaseNode is not None

	def test_base_node_defaults(self):
		from src_py.nodes.base import BaseNode
		assert BaseNode.FUNCTION == "run"
		assert BaseNode.CATEGORY == "Tojioo Passthrough"


class TestAnyType:
	def test_any_type_equals_any_string(self):
		from src_py.nodes.base import AnyType
		any_type = AnyType("*")
		assert any_type == "IMAGE"
		assert any_type == "MODEL"
		assert any_type == "ANYTHING"

	def test_any_type_not_equals_non_string(self):
		from src_py.nodes.base import AnyType
		any_type = AnyType("*")
		assert (any_type == 123) is False
		assert (any_type == None) is False

	def test_any_type_hash(self):
		from src_py.nodes.base import AnyType
		any_type = AnyType("*")
		assert hash(any_type) == hash("*")


class TestFlexibleOptionalInputType:
	def test_contains_any_key(self):
		from src_py.nodes.base import FlexibleOptionalInputType
		flex = FlexibleOptionalInputType("TEST")
		assert "anything" in flex
		assert "image_5" in flex
		assert "random_key" in flex

	def test_getitem_returns_tuple(self):
		from src_py.nodes.base import FlexibleOptionalInputType
		flex = FlexibleOptionalInputType("TEST")
		assert flex["anything"] == ("TEST",)
		assert flex["image"] == ("TEST",)


class TestMultiPass:
	def test_node_exists(self):
		from src_py.nodes.multi_pass import PT_MultiPass
		assert PT_MultiPass is not None

	def test_has_required_attributes(self):
		from src_py.nodes.multi_pass import PT_MultiPass
		assert hasattr(PT_MultiPass, "INPUT_TYPES")
		assert hasattr(PT_MultiPass, "RETURN_TYPES")
		assert hasattr(PT_MultiPass, "CATEGORY")

	def test_returns_all_inputs(self):
		from src_py.nodes.multi_pass import PT_MultiPass
		node = PT_MultiPass()
		result = node.run(image="img", mask="msk", clip="clp")
		assert result[0] == "img"
		assert result[1] == "msk"

	def test_returns_none_for_missing(self):
		from src_py.nodes.multi_pass import PT_MultiPass
		node = PT_MultiPass()
		result = node.run(image="img")
		assert result[0] == "img"
		assert result[1] is None


class TestConditioning:
	def test_node_exists(self):
		from src_py.nodes.conditioning import PT_Conditioning
		assert PT_Conditioning is not None

	def test_returns_both_conditionings(self):
		from src_py.nodes.conditioning import PT_Conditioning
		node = PT_Conditioning()
		result = node.run(positive="pos", negative="neg")
		assert result == ("pos", "neg")

	def test_returns_none_when_no_input(self):
		from src_py.nodes.conditioning import PT_Conditioning
		node = PT_Conditioning()
		result = node.run()
		assert result == (None, None)


class TestDynamicPassthrough:
	def test_node_exists(self):
		from src_py.nodes.dynamic_passthrough import PT_DynamicPassthrough
		assert PT_DynamicPassthrough is not None

	def test_outputs_match_inputs(self):
		from src_py.nodes.dynamic_passthrough import PT_DynamicPassthrough
		node = PT_DynamicPassthrough()
		result = node.run(input="a", input_2="b", input_3="c")
		assert result[0] == "a"
		assert result[1] == "b"
		assert result[2] == "c"

	def test_pads_to_max_sockets(self):
		from src_py.nodes.dynamic_passthrough import PT_DynamicPassthrough
		node = PT_DynamicPassthrough()
		result = node.run(input="a")
		assert len(result) == PT_DynamicPassthrough._MAX_SOCKETS
		assert result[0] == "a"
		assert result[1] is None


class TestDynamicBus:
	def test_node_exists(self):
		from src_py.nodes.dynamic_bus import PT_DynamicBus
		assert PT_DynamicBus is not None

	def test_creates_bus_dict(self):
		from src_py.nodes.dynamic_bus import PT_DynamicBus
		node = PT_DynamicBus()
		result = node.run(input="a", input_2="b")
		bus = result[0]
		assert isinstance(bus, dict)
		assert 0 in bus
		assert 1 in bus

	def test_unpacks_existing_bus(self):
		from src_py.nodes.dynamic_bus import PT_DynamicBus
		node = PT_DynamicBus()
		existing_bus = {0: "first", 1: "second"}
		result = node.run(bus=existing_bus)
		assert result[0] == existing_bus
		assert result[1] == "first"
		assert result[2] == "second"

	def test_overrides_bus_with_direct_input(self):
		from src_py.nodes.dynamic_bus import PT_DynamicBus
		node = PT_DynamicBus()
		existing_bus = {0: "old"}
		result = node.run(bus=existing_bus, input="new")
		assert result[0][0] == "new"
		assert result[1] == "new"


class TestParseSlotOccurrence:
	def test_simple_key(self):
		from src_py.nodes.dynamic_bus import parse_slot_occurrence
		assert parse_slot_occurrence("image") == 1

	def test_numbered_key(self):
		from src_py.nodes.dynamic_bus import parse_slot_occurrence
		assert parse_slot_occurrence("image_2") == 2
		assert parse_slot_occurrence("model_3") == 3

	def test_non_numeric_suffix(self):
		from src_py.nodes.dynamic_bus import parse_slot_occurrence
		assert parse_slot_occurrence("some_name") == 1


class TestDynamicSingle:
	def test_node_exists(self):
		from src_py.nodes.dynamic_single import PT_DynamicSingle
		assert PT_DynamicSingle is not None

	def test_returns_input(self):
		from src_py.nodes.dynamic_single import PT_DynamicSingle
		node = PT_DynamicSingle()
		result = node.run(input="test")
		assert result == ("test",)

	def test_returns_none_when_no_input(self):
		from src_py.nodes.dynamic_single import PT_DynamicSingle
		node = PT_DynamicSingle()
		result = node.run()
		assert result == (None,)


class TestDynamicPreview:
	def test_node_exists(self):
		from src_py.nodes.dynamic_preview import PT_DynamicPreview
		assert PT_DynamicPreview is not None

	def test_has_required_attributes(self):
		from src_py.nodes.dynamic_preview import PT_DynamicPreview
		assert hasattr(PT_DynamicPreview, "INPUT_TYPES")
		assert hasattr(PT_DynamicPreview, "RETURN_TYPES")
		assert hasattr(PT_DynamicPreview, "CATEGORY")
		assert hasattr(PT_DynamicPreview, "FUNCTION")
		assert PT_DynamicPreview.OUTPUT_NODE is True

	def test_empty_input_returns_empty(self):
		from src_py.nodes.dynamic_preview import PT_DynamicPreview
		node = PT_DynamicPreview()
		result = node.preview_images()
		assert result == {"ui": {"preview_data": []}}

	def test_parse_slot_order(self):
		from src_py.nodes.dynamic_preview import PT_DynamicPreview
		assert PT_DynamicPreview._parse_slot_order("image") == 1
		assert PT_DynamicPreview._parse_slot_order("image_2") == 2
		assert PT_DynamicPreview._parse_slot_order("image_10") == 10