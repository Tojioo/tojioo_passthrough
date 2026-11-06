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
