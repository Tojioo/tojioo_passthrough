# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from ..config.types import FORCE_INPUT_TYPES

class TypeHandler:
	@staticmethod
	def create_input_spec(type_name: str, force_input: bool = True):
		if force_input and type_name in FORCE_INPUT_TYPES:
			return (type_name, {"forceInput": True})
		return (type_name,)