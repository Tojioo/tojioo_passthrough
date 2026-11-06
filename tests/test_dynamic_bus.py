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
