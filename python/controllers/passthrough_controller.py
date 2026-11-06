from typing import Dict

from ..config.categories import CATEGORIES
from ..config.types import TYPE_SPECS, FORCE_INPUT_TYPES
from ..handlers.type_handler import TypeHandler


_LABEL_OVERRIDES = {"PT_SAMModel": "SAM Model"}


def _label(class_name: str) -> str:
	return _LABEL_OVERRIDES.get(class_name, class_name.replace("PT_", ""))


class PassthroughController:

	@staticmethod
	def create_nodes() -> Dict[str, type]:
		nodes = {}

		for class_name, type_name, socket_name in TYPE_SPECS:
			nodes[class_name] = PassthroughController._make_node(
				class_name, type_name, socket_name, _label(class_name), " Passthrough",
				use_force_input = True, category = CATEGORIES["simple"]
			)

		for class_name, type_name, socket_name in TYPE_SPECS:
			if type_name in FORCE_INPUT_TYPES:
				widget_class = f"{class_name}Widget"
				nodes[widget_class] = PassthroughController._make_node(
					widget_class, type_name, socket_name, _label(class_name), " Passthrough (Widget)",
					use_force_input = False, category = CATEGORIES["widgets"]
				)

		return nodes


	@staticmethod
	def _make_node(
		class_name: str, type_name: str, socket_name: str,
		label: str, display_suffix: str, use_force_input: bool, category: str):

		def _input_types(_cls):
			spec = TypeHandler.create_input_spec(type_name, use_force_input)
			return {
				"required": {},
				"optional": {socket_name: spec}
			}


		def _run(_self, **kwargs):
			return (kwargs.get(socket_name),)


		return type(
			class_name,
			(),
			{
				"__doc__": f"Pass {type_name} through unchanged.",
				"DESCRIPTION": f"{label} passthrough.",
				"NODE_NAME": label + display_suffix,
				"INPUT_TYPES": classmethod(_input_types),
				"RETURN_TYPES": (type_name,),
				"RETURN_NAMES": (socket_name,),
				"FUNCTION": "run",
				"CATEGORY": category,
				"run": _run,
			}
		)