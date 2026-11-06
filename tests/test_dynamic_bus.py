from python.nodes.dynamic_bus import PT_DynamicBus


def test_dynamic_bus_run_writes_nothing_to_console(capfd):
	bus = {0: {"data": "image", "type": "IMAGE"}}
	PT_DynamicBus().run(
		bus = bus, input_1 = "mask", _slot_types = "1:MASK", _output_hints = "2:IMAGE",
		prompt = {"7": {"inputs": {}}}, unique_id = "7",
	)
	assert capfd.readouterr().out == ""


def test_dynamic_bus_does_not_request_prompt_or_unique_id():
	hidden = PT_DynamicBus.INPUT_TYPES().get("hidden", {})
	assert "prompt" not in hidden
	assert "unique_id" not in hidden


def test_dynamic_bus_hidden_inputs_are_comfy_hidden_kinds():
	# Because ComfyUI reads only kinds like "PROMPT" from "hidden"; widget specs there are never used.
	hidden = PT_DynamicBus.INPUT_TYPES().get("hidden", {})
	assert all(isinstance(spec, str) for spec in hidden.values())


def test_dynamic_bus_slot_types_keep_union_types():
	result = PT_DynamicBus().run(input_1 = "a", input_2 = "b", _slot_types = "1:IMAGE,MASK,2:LATENT")
	assert result[0][0] == {"data": "a", "type": "IMAGE,MASK"}
	assert result[0][1] == {"data": "b", "type": "LATENT"}


def test_dynamic_bus_output_hints_keep_union_types():
	bus = {0: {"data": "image", "type": "IMAGE"}, 1: {"data": "union", "type": "IMAGE,MASK"}}
	result = PT_DynamicBus().run(bus = bus, _output_hints = "1:IMAGE,MASK,2:IMAGE:0")
	assert result[1] == "union"
	assert result[2] == "image"


def test_dynamic_bus_output_hint_with_input_flag_and_union_type():
	result = PT_DynamicBus().run(input_1 = "local", _slot_types = "1:IMAGE,MASK", _output_hints = "1:IMAGE,MASK:1")
	assert result[1] == "local"


def test_dynamic_bus_overwrite_keeps_two_locals_of_same_type_without_upstream():
	result = PT_DynamicBus().run(
		bus = None, input_1 = "img_A", input_2 = "img_B", _slot_types = "1:IMAGE,2:IMAGE", _overwrite_mode = "1",
	)
	assert result[0] == {0: {"data": "img_A", "type": "IMAGE"}, 1: {"data": "img_B", "type": "IMAGE"}}


def test_dynamic_bus_overwrite_second_local_appends_after_upstream_is_used():
	bus = {0: {"data": "old", "type": "IMAGE"}}
	result = PT_DynamicBus().run(
		bus = bus, input_1 = "new_1", input_2 = "new_2", input_3 = "new_3",
		_slot_types = "1:IMAGE,2:IMAGE,3:IMAGE", _overwrite_mode = "1",
	)
	assert [entry["data"] for _, entry in sorted(result[0].items())] == ["new_1", "new_2", "new_3"]
