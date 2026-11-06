from python.nodes.conditioning import PT_Conditioning


def test_conditioning_passthrough_is_not_an_output_node():
	# Because an output node is always executed, even when nothing uses its outputs.
	assert getattr(PT_Conditioning, "OUTPUT_NODE", False) is False
