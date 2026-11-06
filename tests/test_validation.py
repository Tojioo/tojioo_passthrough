import inspect

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
