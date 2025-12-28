# SPDX-License-Identifier: GPL-3.0-only


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


class TestConditioning:
	def test_node_exists(self):
		from src_py.nodes.conditioning import PT_Conditioning
		assert PT_Conditioning is not None

	def test_returns_both_conditionings(self):
		from src_py.nodes.conditioning import PT_Conditioning
		node = PT_Conditioning()

		result = node.run(positive="pos", negative="neg")
		assert result == ("pos", "neg")


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
		# Bus uses numeric indices (0-based)
		assert 0 in bus
		assert 1 in bus


class TestDynamicSingle:
	def test_node_exists(self):
		from src_py.nodes.dynamic_single import PT_DynamicSingle
		assert PT_DynamicSingle is not None

	def test_returns_input(self):
		from src_py.nodes.dynamic_single import PT_DynamicSingle
		node = PT_DynamicSingle()

		result = node.run(input="test")
		assert result == ("test",)