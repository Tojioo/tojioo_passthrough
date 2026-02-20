import pytest

from python.config.types import BATCHABLE_TYPES
from python.handlers.batch_handler import BatchHandler
from python.handlers.type_handler import TypeHandler


@pytest.mark.parametrize(
	"type_name,force_input,expected",
	[
		("INT", True, ("INT", {"forceInput": True})),
		("FLOAT", True, ("FLOAT", {"forceInput": True})),
		("BOOLEAN", True, ("BOOLEAN", {"forceInput": True})),
		("STRING", True, ("STRING", {"forceInput": True})),
		("IMAGE", True, ("IMAGE",)),
		("MASK", False, ("MASK",)),
	],
)
def test_type_handler_create_input_spec(type_name, force_input, expected):
	assert TypeHandler.create_input_spec(type_name, force_input = force_input) == expected


@pytest.mark.parametrize("type_name", sorted(BATCHABLE_TYPES))
def test_batch_handler_can_batch(type_name):
	assert BatchHandler.can_batch(type_name) is True


@pytest.mark.parametrize("type_name", ["MODEL", "CLIP", "INVALID"])
def test_batch_handler_rejects_non_batchable(type_name):
	assert BatchHandler.can_batch(type_name) is False


@pytest.mark.parametrize("type_name", sorted(BATCHABLE_TYPES))
def test_batch_handler_get_handler_returns_tuple(type_name):
	handler = BatchHandler.get_handler(type_name)
	assert handler is not None
	assert len(handler) == 2


def test_batch_handler_get_handler_none_for_invalid():
	assert BatchHandler.get_handler("INVALID_TYPE") is None


@pytest.mark.parametrize("type_name", sorted(BATCHABLE_TYPES))
def test_batch_handler_merge_behavior(type_name, torch_stub):
	handler = BatchHandler.get_handler(type_name)
	prep_fn, merge_fn = handler

	if type_name == "IMAGE":
		values = [torch_stub.randn(64, 64, 3), torch_stub.randn(64, 64, 3)]
	elif type_name == "MASK":
		values = [torch_stub.randn(64, 64), torch_stub.randn(64, 64)]
	elif type_name == "LATENT":
		values = [
			{"samples": torch_stub.randn(4, 64, 64), "noise_mask": None},
			{"samples": torch_stub.randn(4, 64, 64), "noise_mask": None},
		]
	elif type_name == "CONDITIONING":
		values = [[{"type": "a"}], [{"type": "b"}]]
	else:
		raise AssertionError(f"Unhandled type: {type_name}")

	prepped = [prep_fn(v) for v in values]
	merged = merge_fn(values, prepped)

	if type_name in {"IMAGE", "MASK"}:
		assert merged.shape[0] == 2
	elif type_name == "LATENT":
		assert merged["samples"].shape[0] == 2
	elif type_name == "CONDITIONING":
		assert len(merged) == 2