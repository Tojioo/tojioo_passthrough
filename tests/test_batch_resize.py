import pytest
import torch

from python.controllers.switch_controller import SwitchController
from python.handlers import batch_handler


@pytest.fixture(scope = "module")
def switch_nodes():
	return SwitchController.create_nodes()


@pytest.fixture
def upscale_calls(monkeypatch):
	calls = []


	def common_upscale(samples, width, height, upscale_method, crop):
		# Assumption: a plain resize stands in for comfy.utils.common_upscale, which is not importable outside ComfyUI.
		calls.append((tuple(samples.shape), width, height, upscale_method, crop))
		return torch.nn.functional.interpolate(samples, size = (height, width), mode = "bilinear")


	monkeypatch.setattr(batch_handler, "common_upscale", common_upscale, raising = False)
	return calls


def test_image_batch_resizes_to_first_input(switch_nodes, upscale_calls):
	node = switch_nodes["PT_AnyImageBatchSwitch"]()
	small = torch.zeros(1, 8, 8, 3)
	large = torch.ones(2, 16, 12, 3)

	merged = node.run(image_1 = small, image_2 = large)[0]

	assert merged.shape == (3, 8, 8, 3)
	assert torch.equal(merged[0], small[0])
	assert torch.allclose(merged[1:], torch.ones(2, 8, 8, 3))
	assert upscale_calls == [((2, 3, 16, 12), 8, 8, "bilinear", "center")]


def test_image_batch_pads_missing_alpha_like_core(switch_nodes, upscale_calls):
	node = switch_nodes["PT_AnyImageBatchSwitch"]()

	merged = node.run(image_1 = torch.zeros(1, 8, 8, 4), image_2 = torch.zeros(1, 8, 8, 3))[0]

	assert merged.shape == (2, 8, 8, 4)
	assert torch.equal(merged[1, ..., 3], torch.ones(8, 8))
	assert upscale_calls == []


def test_mask_batch_resizes_to_first_input(switch_nodes, upscale_calls):
	node = switch_nodes["PT_AnyMaskBatchSwitch"]()

	merged = node.run(mask_1 = torch.zeros(16, 16), mask_2 = torch.ones(1, 8, 8))[0]

	assert merged.shape == (2, 16, 16)
	assert upscale_calls == [((1, 1, 8, 8), 16, 16, "bilinear", "center")]


def test_latent_batch_resizes_to_first_input(switch_nodes, upscale_calls):
	node = switch_nodes["PT_AnyLatentBatchSwitch"]()
	first = {"samples": torch.zeros(1, 4, 8, 8)}
	second = {"samples": torch.ones(2, 4, 16, 16)}

	merged = node.run(latent_1 = first, latent_2 = second)[0]

	assert merged["samples"].shape == (3, 4, 8, 8)
	assert upscale_calls == [((2, 4, 16, 16), 8, 8, "bilinear", "center")]


def test_latent_batch_keeps_metadata_of_first_input(switch_nodes, upscale_calls):
	node = switch_nodes["PT_AnyLatentBatchSwitch"]()
	latents = {
		"latent_1": {"samples": torch.zeros(1, 4, 8, 8), "meta": "A"},
		"latent_2": {"samples": torch.zeros(1, 4, 16, 16), "meta": "B"},
		"latent_3": {"samples": torch.zeros(1, 4, 16, 16), "meta": "C"},
	}

	merged = node.run(**latents)[0]

	assert merged["samples"].shape == (3, 4, 8, 8)
	assert merged["meta"] == "A"


def test_same_size_batch_does_not_resize(switch_nodes, upscale_calls):
	node = switch_nodes["PT_AnyImageBatchSwitch"]()
	a = torch.rand(1, 8, 8, 3)
	b = torch.rand(1, 8, 8, 3)

	merged = node.run(image_1 = a, image_2 = b)[0]

	assert torch.equal(merged, torch.cat([a, b]))
	assert upscale_calls == []
