# SPDX-License-Identifier: GPL-3.0-only


class TestTypeHandler:
	def test_create_input_spec_force_input(self):
		from py.handlers.type_handler import TypeHandler
		spec = TypeHandler.create_input_spec("INT", force_input=True)
		assert spec == ("INT", {"forceInput": True})

	def test_create_input_spec_no_force_input(self):
		from py.handlers.type_handler import TypeHandler
		spec = TypeHandler.create_input_spec("IMAGE", force_input=True)
		assert spec == ("IMAGE",)

	def test_create_input_spec_force_disabled(self):
		from py.handlers.type_handler import TypeHandler
		spec = TypeHandler.create_input_spec("INT", force_input=False)
		assert spec == ("INT",)


class TestBatchHandler:
	def test_can_batch_image(self):
		from py.handlers.batch_handler import BatchHandler
		assert BatchHandler.can_batch("IMAGE") is True

	def test_can_batch_non_batchable(self):
		from py.handlers.batch_handler import BatchHandler
		assert BatchHandler.can_batch("MODEL") is False

	def test_get_handler_returns_tuple(self):
		from py.handlers.batch_handler import BatchHandler
		handler = BatchHandler.get_handler("IMAGE")
		assert handler is not None
		assert len(handler) == 2

	def test_get_handler_none_for_invalid(self):
		from py.handlers.batch_handler import BatchHandler
		handler = BatchHandler.get_handler("INVALID_TYPE")
		assert handler is None

	def test_image_batch_merge(self, torch_stub):
		from py.handlers.batch_handler import BatchHandler
		handler = BatchHandler.get_handler("IMAGE")
		prep_fn, merge_fn = handler

		img1 = torch_stub.randn(1, 512, 512, 3)
		img2 = torch_stub.randn(1, 512, 512, 3)

		values = [img1, img2]
		prepped = [prep_fn(v) for v in values]
		result = merge_fn(values, prepped)

		assert result.shape == (2, 512, 512, 3)

	def test_conditioning_batch_merge(self):
		from py.handlers.batch_handler import BatchHandler
		handler = BatchHandler.get_handler("CONDITIONING")
		prep_fn, merge_fn = handler

		cond1 = [{"type": "test1"}]
		cond2 = [{"type": "test2"}]

		values = [cond1, cond2]
		prepped = [prep_fn(v) for v in values]
		result = merge_fn(values, prepped)

		assert len(result) == 2