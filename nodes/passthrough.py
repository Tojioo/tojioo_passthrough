# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes - Passthrough Module
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from typing import Dict, Tuple, Any


def create_passthrough_nodes(
	type_specs: Tuple[Tuple[str, str, str], ...],
	force_input_types: set,
	force_input: bool,
	category: str,
	node_ui_specs: Dict[str, Dict[str, Any]]
) -> Dict[str, type]:
	"""
	Factory to create all passthrough node classes.

	Args:
		type_specs: Tuple of (class_name, type_name, socket_name) specifications
		force_input_types: Set of types that should force socket input
		force_input: Whether to force input for all types
		category: Category prefix for nodes
		node_ui_specs: UI specifications for multi-node passthroughs

	Returns:
		Dictionary mapping class names to node classes
	"""

	def _make_passthrough(class_name: str, type_name: str, socket_name: str):
		"""Create a single passthrough node class."""

		def _input_types(_cls):
			spec = (
				(type_name, {"forceInput": force_input})
				if type_name in force_input_types
				else (type_name,)
			)
			return {"required": {socket_name: spec}}

		def _func(_self, **kwargs):
			return (kwargs[socket_name],)

		return type(
			class_name,
			(),
			{
				"__doc__": f"Pass {type_name} through unchanged.",
				"DESCRIPTION": f"{type_name.lower().capitalize()} passthrough. One input, one output. No changes.",
				"INPUT_TYPES": classmethod(_input_types),
				"RETURN_TYPES": (type_name,),
				"RETURN_NAMES": (socket_name,),
				"FUNCTION": "run",
				"CATEGORY": category,
				"run": _func,
			},
		)

	# Generate all simple passthrough nodes
	generated = {spec[0]: _make_passthrough(*spec) for spec in type_specs}

	# Create multi-node passthrough classes
	class PT_Conditioning:
		"""
		Pass positive and negative conditioning unchanged.
		Two inputs, two outputs. Useful to route both branches together.
		"""
		DESCRIPTION = "Passthrough for positive and negative conditioning."

		@classmethod
		def INPUT_TYPES(cls):
			spec = node_ui_specs["PT_Conditioning"]
			req = {name: (typ,) for name, typ in spec.get("inputs_required", [])}
			return {"required": req}

		# Outputs derived from spec mapping
		_spec_out = node_ui_specs["PT_Conditioning"]["outputs"]
		RETURN_TYPES = tuple(typ for _, typ in _spec_out)
		RETURN_NAMES = tuple(name for name, _ in _spec_out)
		FUNCTION = "run"
		CATEGORY = category

		def run(self, positive, negative):
			return positive, negative

	class PT_MultiPass:
		"""
		Multi-type passthrough hub. Wire only the sockets you need.
		Provides separate positive and negative conditioning.
		Outputs are statically typed.
		"""
		DESCRIPTION = (
			"Multi-type passthrough. Wire only the sockets you need. "
			"Includes separate positive and negative conditioning."
		)

		@classmethod
		def INPUT_TYPES(cls):
			spec = node_ui_specs["PT_MultiPass"]
			opt: Dict[str, Any] = {}
			for item in spec.get("inputs_optional", []):
				if len(item) == 3:
					name, typ, opts = item
					opt[name] = (typ, opts)
				else:
					name, typ = item
					opt[name] = (typ,)
			return {"required": {}, "optional": opt}

		# Outputs derived from spec mapping
		_spec_out = node_ui_specs["PT_MultiPass"]["outputs"]
		RETURN_TYPES = tuple(typ for _, typ in _spec_out)
		RETURN_NAMES = tuple(name for name, _ in _spec_out)
		FUNCTION = "run"
		CATEGORY = category

		def run(self, **kwargs):
			order = tuple(name for name, _ in node_ui_specs["PT_MultiPass"]["outputs"])
			return tuple(kwargs.get(k) for k in order)

	# Combine all passthrough nodes
	return {
		"PT_MultiPass": PT_MultiPass,
		"PT_Conditioning": PT_Conditioning,
		**generated,
	}
