import pytest

from python.config.categories import CATEGORIES
from python.config.types import COMFY_TYPES, FORCE_INPUT_TYPES, TYPE_SPECS
from python.controllers.passthrough_controller import PassthroughController
from python.controllers.switch_controller import SwitchController
from python.handlers.batch_handler import BatchHandler


@pytest.fixture
def passthrough_nodes():
	return PassthroughController.create_nodes()


@pytest.fixture
def switch_nodes():
	return SwitchController.create_nodes()


@pytest.mark.parametrize("class_name,type_name,socket_name", TYPE_SPECS)
def test_passthrough_nodes_exist(passthrough_nodes, class_name, type_name, socket_name):
	assert class_name in passthrough_nodes
	if type_name in FORCE_INPUT_TYPES:
		assert f"{class_name}Widget" in passthrough_nodes


@pytest.mark.parametrize("class_name,type_name,socket_name", TYPE_SPECS)
def test_passthrough_node_input_specs(passthrough_nodes, class_name, type_name, socket_name):
	node_cls = passthrough_nodes[class_name]
	input_types = node_cls.INPUT_TYPES()
	expected = (type_name, {"forceInput": True}) if type_name in FORCE_INPUT_TYPES else (type_name,)
	assert input_types["optional"][socket_name] == expected
	assert node_cls.CATEGORY == CATEGORIES["simple"]

	if type_name in FORCE_INPUT_TYPES:
		widget_cls = passthrough_nodes[f"{class_name}Widget"]
		widget_input = widget_cls.INPUT_TYPES()["optional"][socket_name]
		assert widget_input == (type_name,)
		assert widget_cls.CATEGORY == CATEGORIES["widgets"]


@pytest.mark.parametrize("class_name,type_name,socket_name", TYPE_SPECS)
def test_passthrough_node_run_returns_input(passthrough_nodes, class_name, type_name, socket_name):
	node_cls = passthrough_nodes[class_name]
	node = node_cls()
	value = f"{socket_name}_value"
	assert node.run(**{socket_name: value}) == (value,)
	assert node.run() == (None,)


@pytest.mark.parametrize(
	"class_name,type_key,input_prefix,output_name,display_name",
	SwitchController.SWITCH_SPECS,
)
def test_switch_nodes_choose_first_connected(switch_nodes, class_name, type_key, input_prefix, output_name, display_name):
	node_cls = switch_nodes[class_name]
	node = node_cls()
	assert node.run(**{f"{input_prefix}_2": "second", f"{input_prefix}_1": "first"}) == ("first",)
	assert node.run(**{f"{input_prefix}_3": "third"}) == ("third",)


@pytest.mark.parametrize(
	"class_name,type_key,input_prefix,output_name,display_name",
	SwitchController.SWITCH_SPECS,
)
def test_switch_nodes_require_input(switch_nodes, class_name, type_key, input_prefix, output_name, display_name):
	node_cls = switch_nodes[class_name]
	node = node_cls()
	with pytest.raises(ValueError):
		node.run()


@pytest.mark.parametrize(
	"class_name,type_key,input_prefix,output_name,display_name",
	SwitchController.SWITCH_SPECS,
)
def test_switch_nodes_dynamic_optional_inputs(
	switch_nodes, class_name, type_key, input_prefix, output_name, display_name
):
	node_cls = switch_nodes[class_name]
	optional = node_cls.INPUT_TYPES()["optional"]
	type_name = COMFY_TYPES[type_key]
	expected = (type_name, {"forceInput": True}) if type_name in FORCE_INPUT_TYPES else (type_name,)
	assert f"{input_prefix}_1" in optional
	assert f"{input_prefix}_99" in optional
	assert optional[f"{input_prefix}_42"] == expected


@pytest.mark.parametrize(
	"class_name,type_key,input_prefix,output_name,display_name",
	SwitchController.BATCH_SWITCH_SPECS,
)
def test_batch_switch_nodes_exist_when_batchable(
	switch_nodes, class_name, type_key, input_prefix, output_name, display_name
):
	type_name = COMFY_TYPES[type_key]
	if BatchHandler.can_batch(type_name):
		assert class_name in switch_nodes
	else:
		assert class_name not in switch_nodes


def _make_batch_values(type_name, torch_stub):
	if type_name == "IMAGE":
		return torch_stub.randn(64, 64, 3), torch_stub.randn(64, 64, 3)
	if type_name == "MASK":
		return torch_stub.randn(64, 64), torch_stub.randn(64, 64)
	if type_name == "LATENT":
		return (
			{"samples": torch_stub.randn(4, 64, 64), "noise_mask": None},
			{"samples": torch_stub.randn(4, 64, 64), "noise_mask": None},
		)
	if type_name == "CONDITIONING":
		return [{"type": "a"}], [{"type": "b"}]
	raise AssertionError(f"Unhandled type: {type_name}")


@pytest.mark.parametrize(
	"class_name,type_key,input_prefix,output_name,display_name",
	SwitchController.BATCH_SWITCH_SPECS,
)
def test_batch_switch_nodes_connection_combinations(
	switch_nodes, torch_stub, class_name, type_key, input_prefix, output_name, display_name
):
	type_name = COMFY_TYPES[type_key]
	if not BatchHandler.can_batch(type_name):
		pytest.skip("Not batchable")

	node_cls = switch_nodes[class_name]
	node = node_cls()
	value_1, value_2 = _make_batch_values(type_name, torch_stub)

	with pytest.raises(ValueError):
		node.run()

	assert node.run(**{f"{input_prefix}_1": value_1}) == (value_1,)

	merged = node.run(**{f"{input_prefix}_1": value_1, f"{input_prefix}_2": value_2})[0]
	if type_name in {"IMAGE", "MASK"}:
		assert merged.shape[0] == 2
	elif type_name == "LATENT":
		assert isinstance(merged, dict)
		assert merged["samples"].shape[0] == 2
	elif type_name == "CONDITIONING":
		assert len(merged) == 2