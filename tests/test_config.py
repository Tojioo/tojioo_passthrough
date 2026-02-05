class TestTypes:

	def test_comfy_types_defined(self):
		from python.config.types import COMFY_TYPES

		assert isinstance(COMFY_TYPES, dict)
		assert "image" in COMFY_TYPES
		assert COMFY_TYPES["image"] == "IMAGE"


	def test_type_specs_defined(self):
		from python.config.types import TYPE_SPECS

		assert isinstance(TYPE_SPECS, tuple)
		assert len(TYPE_SPECS) > 0
		assert TYPE_SPECS[0] == ("PT_Image", "IMAGE", "image")


	def test_force_input_types(self):
		from python.config.types import FORCE_INPUT_TYPES

		assert "INT" in FORCE_INPUT_TYPES
		assert "FLOAT" in FORCE_INPUT_TYPES
		assert "BOOLEAN" in FORCE_INPUT_TYPES
		assert "STRING" in FORCE_INPUT_TYPES


	def test_batchable_types(self):
		from python.config.types import BATCHABLE_TYPES

		assert "IMAGE" in BATCHABLE_TYPES
		assert "MASK" in BATCHABLE_TYPES
		assert "LATENT" in BATCHABLE_TYPES
		assert "CONDITIONING" in BATCHABLE_TYPES


class TestCategories:

	def test_main_category_defined(self):
		from python.config.categories import MAIN_CATEGORY

		assert MAIN_CATEGORY == "Tojioo Passthrough"


	def test_categories_defined(self):
		from python.config.categories import CATEGORIES

		assert isinstance(CATEGORIES, dict)
		assert "simple" in CATEGORIES
		assert "widgets" in CATEGORIES
		assert "dynamic" in CATEGORIES
		assert "batch" in CATEGORIES
		assert "switch" in CATEGORIES