class TestPassthroughController:

	def test_create_nodes_returns_dict(self):
		from python.tojioo_passthrough.controllers.passthrough_controller import PassthroughController

		nodes = PassthroughController.create_nodes()
		assert isinstance(nodes, dict)
		assert len(nodes) > 0


	def test_creates_simple_passthroughs(self):
		from python.tojioo_passthrough.controllers.passthrough_controller import PassthroughController

		nodes = PassthroughController.create_nodes()
		assert "PT_Image" in nodes
		assert "PT_Mask" in nodes
		assert "PT_CLIP" in nodes


	def test_creates_widget_variants(self):
		from python.tojioo_passthrough.controllers.passthrough_controller import PassthroughController

		nodes = PassthroughController.create_nodes()
		assert "PT_IntWidget" in nodes
		assert "PT_FloatWidget" in nodes
		assert "PT_StringWidget" in nodes
		assert "PT_BoolWidget" in nodes


	def test_node_has_required_attributes(self):
		from python.tojioo_passthrough.controllers.passthrough_controller import PassthroughController

		nodes = PassthroughController.create_nodes()
		node_class = nodes["PT_Image"]

		assert hasattr(node_class, "INPUT_TYPES")
		assert hasattr(node_class, "RETURN_TYPES")
		assert hasattr(node_class, "RETURN_NAMES")
		assert hasattr(node_class, "FUNCTION")
		assert hasattr(node_class, "CATEGORY")
		assert hasattr(node_class, "run")


	def test_passthrough_returns_input(self):
		from python.tojioo_passthrough.controllers.passthrough_controller import PassthroughController

		nodes = PassthroughController.create_nodes()
		node = nodes["PT_Image"]()

		test_value = "test_image"
		output = node.run(image = test_value)
		assert output == (test_value,)


class TestSwitchController:

	def test_create_nodes_returns_dict(self):
		from python.tojioo_passthrough.controllers.switch_controller import SwitchController

		nodes = SwitchController.create_nodes()
		assert isinstance(nodes, dict)
		assert len(nodes) > 0


	def test_creates_switch_nodes(self):
		from python.tojioo_passthrough.controllers.switch_controller import SwitchController

		nodes = SwitchController.create_nodes()
		assert "PT_AnyImageSwitch" in nodes
		assert "PT_AnyModelSwitch" in nodes
		assert "PT_AnyIntSwitch" in nodes


	def test_creates_batch_switch_nodes(self):
		from python.tojioo_passthrough.controllers.switch_controller import SwitchController

		nodes = SwitchController.create_nodes()
		assert "PT_AnyImageBatchSwitch" in nodes
		assert "PT_AnyLatentBatchSwitch" in nodes


	def test_switch_returns_first_connected(self):
		from python.tojioo_passthrough.controllers.switch_controller import SwitchController

		nodes = SwitchController.create_nodes()
		node = nodes["PT_AnyImageSwitch"]()

		output = node.run(image_2 = "second", image_1 = "first")
		assert output == ("first",)


	def test_batch_switch_single_input(self, torch_stub):
		from python.tojioo_passthrough.controllers.switch_controller import SwitchController

		nodes = SwitchController.create_nodes()
		node = nodes["PT_AnyImageBatchSwitch"]()

		img = torch_stub.randn(1, 512, 512, 3)
		output = node.run(image_1 = img)
		assert output[0] is img


	def test_batch_switch_multiple_inputs(self, torch_stub):
		from python.tojioo_passthrough.controllers.switch_controller import SwitchController

		nodes = SwitchController.create_nodes()
		node = nodes["PT_AnyImageBatchSwitch"]()

		img1 = torch_stub.randn(1, 512, 512, 3)
		img2 = torch_stub.randn(1, 512, 512, 3)
		output = node.run(image_1 = img1, image_2 = img2)

		assert output[0].shape == (2, 512, 512, 3)