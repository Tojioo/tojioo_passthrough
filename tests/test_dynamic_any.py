from python.nodes.dynamic_any import PT_DynamicAny


def test_dynamic_any_accepts_input_renamed_by_frontend():
	# Because the frontend renames the input slot to the connected type, the prompt key is e.g. "image".
	assert PT_DynamicAny().run(image = "img") == ("img",)
	assert PT_DynamicAny().run(string = "hello") == ("hello",)


def test_dynamic_any_ignores_unconnected_inputs():
	assert PT_DynamicAny().run(input = None, image = "img") == ("img",)
