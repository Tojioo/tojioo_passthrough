# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from typing import Dict

from ..config.categories import CATEGORIES
from ..config.types import TYPE_SPECS, FORCE_INPUT_TYPES
from ..handlers.type_handler import TypeHandler


class PassthroughController:
	@staticmethod
	def create_nodes() -> Dict[str, type]:
		nodes = {}

		for class_name, type_name, socket_name in TYPE_SPECS:
			display_name = (
					class_name.replace("PT_", "")
					.replace("String", "Text") + " Passthrough"
			)
			nodes[class_name] = PassthroughController._make_node(
				class_name, type_name, socket_name, display_name,
				use_force_input=True, category=CATEGORIES["simple"]
			)

		for class_name, type_name, socket_name in TYPE_SPECS:
			if type_name in FORCE_INPUT_TYPES:
				widget_class = f"{class_name}Widget"
				display_name = (
						class_name.replace("PT_", "")
						.replace("String", "Text") + " Passthrough (Widget)"
				)
				nodes[widget_class] = PassthroughController._make_node(
					widget_class, type_name, socket_name, display_name,
					use_force_input=False, category=CATEGORIES["widgets"]
				)

		return nodes

	@staticmethod
	def _make_node(class_name: str, type_name: str, socket_name: str,
		display_name: str, use_force_input: bool, category: str):

		def _input_types(_cls):
			spec = TypeHandler.create_input_spec(type_name, use_force_input)
			return {"required": {socket_name: spec}}

		def _run(_self, **kwargs):
			return (kwargs[socket_name],)

		return type(
			class_name,
			(),
			{
				"__doc__": f"Pass {type_name} through unchanged.",
				"DESCRIPTION": f"{type_name.lower().capitalize()} passthrough.",
				"NODE_NAME": display_name,
				"INPUT_TYPES": classmethod(_input_types),
				"RETURN_TYPES": (type_name,),
				"RETURN_NAMES": (socket_name,),
				"FUNCTION": "run",
				"CATEGORY": category,
				"run": _run,
			}
		)