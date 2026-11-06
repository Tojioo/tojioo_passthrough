import inspect
import json

import pytest

from python import NODE_CLASS_MAPPINGS
from python.nodes.base import AnyType, FlexibleOptionalInputType


_WIDGET_CHECK_KEYS = ("min", "max")


def _comfy_skips_widget_checks(node_cls, input_name):
	# Needed to mirror ComfyUI execution.validate_inputs, which skips min/max/combo checks for inputs the VALIDATE_INPUTS signature takes.
	validate = getattr(node_cls, "VALIDATE_INPUTS", None)
	if validate is None:
		return False
	spec = inspect.getfullargspec(validate)
	return input_name in spec.args or spec.varkw is not None


def _inputs_with_widget_limits():
	cases = []
	for class_name, node_cls in sorted(NODE_CLASS_MAPPINGS.items()):
		input_types = node_cls.INPUT_TYPES()
		for category in ("required", "optional"):
			for input_name, spec in dict(input_types.get(category, {})).items():
				options = spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}
				if any(key in options for key in _WIDGET_CHECK_KEYS):
					cases.append((class_name, input_name))
	return cases


def test_some_inputs_declare_widget_limits():
	assert ("PT_TiledVAESettings", "tile_size") in _inputs_with_widget_limits()


@pytest.mark.parametrize("class_name,input_name", _inputs_with_widget_limits())
def test_comfy_enforces_declared_widget_limits(class_name, input_name):
	assert not _comfy_skips_widget_checks(NODE_CLASS_MAPPINGS[class_name], input_name)


def _has_any_type_input(node_cls):
	for category in ("required", "optional"):
		inputs = node_cls.INPUT_TYPES().get(category, {})
		if isinstance(inputs, FlexibleOptionalInputType) and isinstance(inputs._type_spec, AnyType):
			return True
		if any(isinstance(spec[0], AnyType) for spec in dict(inputs).values()):
			return True
	return False


@pytest.mark.parametrize("class_name", sorted(NODE_CLASS_MAPPINGS))
def test_validation_bypass_only_on_any_type_nodes(class_name):
	# Because AnyType compares equal to "COMBO", ComfyUI's combo check would reject any constant on an AnyType input, which is the only reason to bypass.
	node_cls = NODE_CLASS_MAPPINGS[class_name]
	validate = getattr(node_cls, "VALIDATE_INPUTS", None)
	if validate is None or inspect.getfullargspec(validate).varkw is None:
		return
	assert _has_any_type_input(node_cls)


def _comfy_validated_input_names(node_cls):
	# Needed to mirror ComfyUI execution.validate_inputs, which only checks and walks upstream of the input names it gets by iterating INPUT_TYPES.
	input_types = node_cls.INPUT_TYPES()
	return set(input_types.get("required", {})).union(set(input_types.get("optional", {})))


@pytest.mark.parametrize(
	"class_name,input_names",
	[
		("PT_DynamicPreview", ["input_1", "input_2", "input_32"]),
		("PT_DynamicPassthrough", ["input_1", "input_2", "input_32"]),
		("PT_DynamicBus", ["bus", "input_1", "input_31"]),
		("PT_AnyImageSwitch", ["image_1", "image_2", "image_32"]),
		("PT_AnyStringSwitch", ["string_1", "string_2"]),
		("PT_AnyLatentBatchSwitch", ["latent_1", "latent_2", "latent_32"]),
	],
)
def test_comfy_validates_dynamic_inputs(class_name, input_names):
	validated = _comfy_validated_input_names(NODE_CLASS_MAPPINGS[class_name])
	assert set(input_names) <= validated


@pytest.mark.parametrize(
	"class_name,expected_optional",
	[
		("PT_DynamicPreview", []),
		("PT_DynamicPassthrough", []),
		("PT_DynamicBus", ["bus"]),
		("PT_AnyImageSwitch", ["image_1"]),
		("PT_AnyConditioningBatchSwitch", ["conditioning_1"]),
	],
)
def test_object_info_lists_only_static_inputs(class_name, expected_optional):
	# Because ComfyUI's /object_info serialises INPUT_TYPES with json and keys(), extra names there would make the frontend create sockets.
	optional = NODE_CLASS_MAPPINGS[class_name].INPUT_TYPES()["optional"]
	assert list(optional.keys()) == expected_optional
	assert list(json.loads(json.dumps(optional, default = str))) == expected_optional
