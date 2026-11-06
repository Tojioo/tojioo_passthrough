import pytest
import torch

from python.nodes.dynamic_preview import PT_DynamicPreview


@pytest.fixture
def temp_output(monkeypatch, tmp_path):
	import folder_paths

	monkeypatch.setattr(folder_paths, "get_temp_directory", lambda: str(tmp_path), raising = False)
	counter = iter(range(1000))
	monkeypatch.setattr(
		folder_paths,
		"get_save_image_path",
		lambda *args, **kwargs: (str(tmp_path), "preview", next(counter), "", ""),
		raising = False,
	)
	return tmp_path


@pytest.mark.parametrize("shape", [(1, 8, 8, 1), (1, 1, 8, 8), (8, 8, 1)])
def test_preview_single_channel_image(temp_output, shape):
	result = PT_DynamicPreview().preview_images(input_1 = torch.rand(*shape))
	assert len(result["ui"]["preview_data"]) == 1
	assert result["ui"]["text_data"] == []


@pytest.mark.parametrize("batch", [3, 4])
def test_preview_mask_batch_of_three_or_four_shows_each_mask(temp_output, batch):
	result = PT_DynamicPreview().preview_images(input_1 = torch.rand(batch, 8, 8))
	assert len(result["ui"]["preview_data"]) == batch


def test_preview_does_not_print_to_console(capfd):
	PT_DynamicPreview().preview_images(input_1 = "hello")
	assert capfd.readouterr().out == ""


def _saved_png_text(tmp_path, result):
	from PIL import Image

	with Image.open(tmp_path / result["ui"]["preview_data"][0]["filename"]) as img:
		return dict(img.text)


@pytest.mark.parametrize("disabled", [True, False])
def test_preview_png_metadata_follows_disable_metadata(monkeypatch, temp_output, disabled):
	import sys
	import types

	cli_args = types.ModuleType("comfy.cli_args")
	cli_args.args = types.SimpleNamespace(disable_metadata = disabled)
	monkeypatch.setitem(sys.modules, "comfy.cli_args", cli_args)

	result = PT_DynamicPreview().preview_images(
		prompt = {"1": {"class_type": "X", "inputs": {}}},
		extra_pnginfo = {"workflow": {"nodes": []}},
		input_1 = torch.rand(1, 8, 8, 3),
	)
	text = _saved_png_text(temp_output, result)
	if disabled:
		assert text == {}
	else:
		assert "prompt" in text and "workflow" in text
