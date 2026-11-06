import pytest
import torch

from python.controllers.switch_controller import SwitchController


@pytest.fixture(scope = "module")
def switch_nodes():
	return SwitchController.create_nodes()


def test_batch_switch_merges_in_socket_index_order(switch_nodes):
	node = switch_nodes["PT_AnyImageBatchSwitch"]()
	zeros = torch.zeros(1, 8, 8, 3)
	ones = torch.ones(1, 8, 8, 3)
	twos = torch.full((1, 8, 8, 3), 2.0)

	merged = node.run(image_10 = twos, image_2 = ones, image_1 = zeros)[0]

	assert merged[:, 0, 0, 0].tolist() == [0.0, 1.0, 2.0]
