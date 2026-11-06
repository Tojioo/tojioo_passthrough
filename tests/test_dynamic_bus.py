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
