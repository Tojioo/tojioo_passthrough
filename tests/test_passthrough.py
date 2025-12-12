# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes - Passthrough Tests
# Copyright (c) 2025 Tojioo


class TestPassthroughNodeCreation:
	"""Test passthrough node factory."""

	def test_create_passthrough_nodes_returns_dict(self):
		"""Test that create_passthrough_nodes returns a dictionary."""
		from nodes.passthrough import create_passthrough_nodes

		type_specs = (
			("PT_Image", "IMAGE", "IMAGE"),
			("PT_Mask", "MASK", "MASK"),
		)
		force_input_types = {"INT", "FLOAT", "BOOLEAN", "STRING"}
		node_ui_specs = {
			"PT_MultiPass": {
				"inputs_optional": [("image", "IMAGE")],
				"outputs": [("image", "IMAGE")],
			},
			"PT_Conditioning": {
				"inputs_required": [("positive", "CONDITIONING"), ("negative", "CONDITIONING")],
				"outputs": [("positive", "CONDITIONING"), ("negative", "CONDITIONING")],
			},
		}

		result = create_passthrough_nodes(
			type_specs=type_specs,
			force_input_types=force_input_types,
			force_input=True,
			category="Test/Category",
			node_ui_specs=node_ui_specs,
		)

		assert isinstance(result, dict)
		assert "PT_Image" in result
		assert "PT_Mask" in result
		assert "PT_MultiPass" in result
		assert "PT_Conditioning" in result

	def test_passthrough_node_has_required_attributes(self):
		"""Test that generated nodes have required ComfyUI attributes."""
		from nodes.passthrough import create_passthrough_nodes

		type_specs = (("PT_Image", "IMAGE", "IMAGE"),)
		node_ui_specs = {
			"PT_MultiPass": {"inputs_optional": [], "outputs": []},
			"PT_Conditioning": {"inputs_required": [], "outputs": []},
		}

		result = create_passthrough_nodes(
			type_specs=type_specs,
			force_input_types=set(),
			force_input=False,
			category="Test",
			node_ui_specs=node_ui_specs,
		)

		node_class = result["PT_Image"]

		assert hasattr(node_class, "INPUT_TYPES")
		assert hasattr(node_class, "RETURN_TYPES")
		assert hasattr(node_class, "RETURN_NAMES")
		assert hasattr(node_class, "FUNCTION")
		assert hasattr(node_class, "CATEGORY")
		assert hasattr(node_class, "run")

	def test_passthrough_node_run_returns_input(self):
		"""Test that passthrough node returns the same value."""
		from nodes.passthrough import create_passthrough_nodes

		type_specs = (("PT_Image", "IMAGE", "IMAGE"),)
		node_ui_specs = {
			"PT_MultiPass": {"inputs_optional": [], "outputs": []},
			"PT_Conditioning": {"inputs_required": [], "outputs": []},
		}

		result = create_passthrough_nodes(
			type_specs=type_specs,
			force_input_types=set(),
			force_input=False,
			category="Test",
			node_ui_specs=node_ui_specs,
		)

		node = result["PT_Image"]()
		test_value = "test_image_data"
		output = node.run(IMAGE=test_value)

		assert output == (test_value,)


class TestConditioningPassthrough:
	"""Test conditioning passthrough node."""

	def test_conditioning_passthrough_returns_both_values(self):
		"""Test that conditioning passthrough returns both positive and negative."""
		from nodes.passthrough import create_passthrough_nodes

		type_specs = ()
		node_ui_specs = {
			"PT_MultiPass": {"inputs_optional": [], "outputs": []},
			"PT_Conditioning": {
				"inputs_required": [("positive", "CONDITIONING"), ("negative", "CONDITIONING")],
				"outputs": [("positive", "CONDITIONING"), ("negative", "CONDITIONING")],
			},
		}

		result = create_passthrough_nodes(
			type_specs=type_specs,
			force_input_types=set(),
			force_input=False,
			category="Test",
			node_ui_specs=node_ui_specs,
		)

		node = result["PT_Conditioning"]()
		pos = "positive_data"
		neg = "negative_data"
		output = node.run(positive=pos, negative=neg)

		assert output == (pos, neg)