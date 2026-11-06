from python.nodes.tiled_vae_settings import PT_TiledVAESettings


def test_run_returns_each_setting_on_its_named_output():
	values = {"tile_size": 768, "overlap": 96, "temporal_size": 32, "temporal_overlap": 4}

	result = PT_TiledVAESettings.run(**values)

	assert result == tuple(values[name] for name in PT_TiledVAESettings.RETURN_NAMES)


def test_inputs_match_outputs_and_documented_defaults():
	required = PT_TiledVAESettings.INPUT_TYPES()["required"]

	assert tuple(required) == PT_TiledVAESettings.RETURN_NAMES
	assert {name: spec[1]["default"] for name, spec in required.items()} == {
		"tile_size": 512, "overlap": 64, "temporal_size": 64, "temporal_overlap": 8,
	}
