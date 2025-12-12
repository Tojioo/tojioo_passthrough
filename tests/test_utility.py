# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes - Utility Tests
# Copyright (c) 2025 Tojioo

import pytest


class TestUtilityNodeCreation:
	"""Test utility node factory."""

	def test_create_utility_nodes_returns_dict(self):
		"""Test that create_utility_nodes returns a dictionary."""
		from nodes.utility import create_utility_nodes

		node_ui_specs = {
			"PT_AnyImageBatchSwitch": {
				"node_name": "Any Image Batch Switch",
				"inputs_optional": [("image_1", "IMAGE")],
				"outputs": [("IMAGE", "IMAGE")],
			},
			"PT_AnyMaskBatchSwitch": {
				"node_name": "Any Mask Batch Switch",
				"inputs_optional": [("mask_1", "MASK")],
				"outputs": [("MASK", "MASK")],
			},
			"PT_AnyLatentBatchSwitch": {
				"node_name": "Any Latent Batch Switch",
				"inputs_optional": [("latent_1", "LATENT")],
				"outputs": [("LATENT", "LATENT")],
			},
			"PT_AnyConditioningBatchSwitch": {
				"node_name": "Any Conditioning Batch Switch",
				"inputs_optional": [("cond_1", "CONDITIONING")],
				"outputs": [("CONDITIONING", "CONDITIONING")],
			},
			"PT_AnyImageSwitch": {
				"node_name": "Any Image Switch",
				"inputs_optional": [("image_1", "IMAGE")],
				"outputs": [("IMAGE", "IMAGE")],
			},
		}

		result = create_utility_nodes(
			category="Test/Utility",
			node_ui_specs=node_ui_specs,
		)

		assert isinstance(result, dict)
		assert "PT_AnyImageBatchSwitch" in result
		assert "PT_AnyMaskBatchSwitch" in result
		assert "PT_AnyImageSwitch" in result

	def test_batch_switch_node_has_required_attributes(self):
		"""Test that batch switch nodes have required ComfyUI attributes."""
		from nodes.utility import create_utility_nodes

		node_ui_specs = {
			"PT_AnyImageBatchSwitch": {
				"node_name": "Any Image Batch Switch",
				"inputs_optional": [("image_1", "IMAGE")],
				"outputs": [("IMAGE", "IMAGE")],
			},
			"PT_AnyMaskBatchSwitch": {
				"node_name": "Any Mask Batch Switch",
				"inputs_optional": [("mask_1", "MASK")],
				"outputs": [("MASK", "MASK")],
			},
			"PT_AnyLatentBatchSwitch": {
				"node_name": "Any Latent Batch Switch",
				"inputs_optional": [("latent_1", "LATENT")],
				"outputs": [("LATENT", "LATENT")],
			},
			"PT_AnyConditioningBatchSwitch": {
				"node_name": "Any Conditioning Batch Switch",
				"inputs_optional": [("cond_1", "CONDITIONING")],
				"outputs": [("CONDITIONING", "CONDITIONING")],
			},
		}

		result = create_utility_nodes(
			category="Test/Utility",
			node_ui_specs=node_ui_specs,
		)

		node_class = result["PT_AnyImageBatchSwitch"]

		assert hasattr(node_class, "INPUT_TYPES")
		assert hasattr(node_class, "RETURN_TYPES")
		assert hasattr(node_class, "RETURN_NAMES")
		assert hasattr(node_class, "FUNCTION")
		assert hasattr(node_class, "CATEGORY")
		assert hasattr(node_class, "run")


class TestBatchSwitchFunctionality:
	"""Test batch switch node functionality."""

	def test_image_batch_switch_single_input(self, torch_stub):
		"""Test that single input passes through unchanged."""
		from nodes.utility import create_utility_nodes

		node_ui_specs = {
			"PT_AnyImageBatchSwitch": {
				"node_name": "Any Image Batch Switch",
				"inputs_optional": [("image_1", "IMAGE")],
				"outputs": [("IMAGE", "IMAGE")],
			},
			"PT_AnyMaskBatchSwitch": {
				"node_name": "Any Mask Batch Switch",
				"inputs_optional": [("mask_1", "MASK")],
				"outputs": [("MASK", "MASK")],
			},
			"PT_AnyLatentBatchSwitch": {
				"node_name": "Any Latent Batch Switch",
				"inputs_optional": [("latent_1", "LATENT")],
				"outputs": [("LATENT", "LATENT")],
			},
			"PT_AnyConditioningBatchSwitch": {
				"node_name": "Any Conditioning Batch Switch",
				"inputs_optional": [("cond_1", "CONDITIONING")],
				"outputs": [("CONDITIONING", "CONDITIONING")],
			},
		}

		result = create_utility_nodes(
			category="Test/Utility",
			node_ui_specs=node_ui_specs,
		)

		node = result["PT_AnyImageBatchSwitch"]()
		test_image = torch_stub.randn(1, 512, 512, 3)
		output = node.run(image_1=test_image)

		assert output[0] is test_image

	def test_image_batch_switch_no_input_raises_error(self):
		"""Test that no input raises ValueError."""
		from nodes.utility import create_utility_nodes

		node_ui_specs = {
			"PT_AnyImageBatchSwitch": {
				"node_name": "Any Image Batch Switch",
				"inputs_optional": [("image_1", "IMAGE")],
				"outputs": [("IMAGE", "IMAGE")],
			},
			"PT_AnyMaskBatchSwitch": {
				"node_name": "Any Mask Batch Switch",
				"inputs_optional": [("mask_1", "MASK")],
				"outputs": [("MASK", "MASK")],
			},
			"PT_AnyLatentBatchSwitch": {
				"node_name": "Any Latent Batch Switch",
				"inputs_optional": [("latent_1", "LATENT")],
				"outputs": [("LATENT", "LATENT")],
			},
			"PT_AnyConditioningBatchSwitch": {
				"node_name": "Any Conditioning Batch Switch",
				"inputs_optional": [("cond_1", "CONDITIONING")],
				"outputs": [("CONDITIONING", "CONDITIONING")],
			},
		}

		result = create_utility_nodes(
			category="Test/Utility",
			node_ui_specs=node_ui_specs,
		)

		node = result["PT_AnyImageBatchSwitch"]()

		with pytest.raises(ValueError, match="no IMAGE inputs connected"):
			node.run()

	def test_image_batch_switch_multiple_inputs_batches(self, torch_stub):
		"""Test that multiple inputs are batched."""
		from nodes.utility import create_utility_nodes

		node_ui_specs = {
			"PT_AnyImageBatchSwitch": {
				"node_name": "Any Image Batch Switch",
				"inputs_optional": [("image_1", "IMAGE")],
				"outputs": [("IMAGE", "IMAGE")],
			},
			"PT_AnyMaskBatchSwitch": {
				"node_name": "Any Mask Batch Switch",
				"inputs_optional": [("mask_1", "MASK")],
				"outputs": [("MASK", "MASK")],
			},
			"PT_AnyLatentBatchSwitch": {
				"node_name": "Any Latent Batch Switch",
				"inputs_optional": [("latent_1", "LATENT")],
				"outputs": [("LATENT", "LATENT")],
			},
			"PT_AnyConditioningBatchSwitch": {
				"node_name": "Any Conditioning Batch Switch",
				"inputs_optional": [("cond_1", "CONDITIONING")],
				"outputs": [("CONDITIONING", "CONDITIONING")],
			},
		}

		result = create_utility_nodes(
			category="Test/Utility",
			node_ui_specs=node_ui_specs,
		)

		node = result["PT_AnyImageBatchSwitch"]()
		img1 = torch_stub.randn(1, 512, 512, 3)
		img2 = torch_stub.randn(1, 512, 512, 3)

		output = node.run(image_1=img1, image_2=img2)

		# Should be batched - batch size of 2
		assert output[0].shape[0] == 2
		assert output[0].shape[1:] == (512, 512, 3)