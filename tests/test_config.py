from python.config import categories as categories_config, types as types_config


def test_comfy_types_contains_expected_entries():
	expected = {
		"image": "IMAGE",
		"mask": "MASK",
		"latent": "LATENT",
		"clip": "CLIP",
		"model": "MODEL",
		"vae": "VAE",
		"control_net": "CONTROL_NET",
		"sam_model": "SAM_MODEL",
		"text": "STRING",
		"int": "INT",
		"float": "FLOAT",
		"boolean": "BOOLEAN",
		"conditioning": "CONDITIONING",
		"bus": "BUS",
		"any": "*",
	}
	for key, value in expected.items():
		assert types_config.COMFY_TYPES[key] == value


def test_type_specs_are_well_formed():
	assert isinstance(types_config.TYPE_SPECS, tuple)
	assert types_config.TYPE_SPECS
	for class_name, type_name, socket_name in types_config.TYPE_SPECS:
		assert class_name.startswith("PT_")
		assert isinstance(socket_name, str)
		assert type_name in types_config.COMFY_TYPES.values()


def test_force_input_types_are_known():
	for type_name in types_config.FORCE_INPUT_TYPES:
		assert type_name in types_config.COMFY_TYPES.values()


def test_batchable_types_are_known():
	for type_name in types_config.BATCHABLE_TYPES:
		assert type_name in types_config.COMFY_TYPES.values()


def test_categories_reference_main_category():
	assert categories_config.MAIN_CATEGORY == "Tojioo Passthrough"
	for category in categories_config.CATEGORIES.values():
		assert categories_config.MAIN_CATEGORY in category