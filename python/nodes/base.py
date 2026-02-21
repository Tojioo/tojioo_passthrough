from typing import Any, Dict


class BaseNode:
	"""Base class for all Tojioo Passthrough nodes."""

	FUNCTION: str = "run"
	NODE_NAME: str = ""
	DESCRIPTION: str = ""
	CATEGORY: str = "Tojioo Passthrough"


	@classmethod
	def get_display_name(cls) -> str:
		return getattr(cls, "NODE_NAME", cls.__name__)


	@classmethod
	def INPUT_TYPES(cls) -> Dict[str, Any]:
		raise NotImplementedError


	@classmethod
	def VALIDATE_INPUTS(cls, **kwargs) -> bool:
		"""Bypass validation for AnyType inputs."""
		return True


class AnyType(str):
	"""A type that matches any other type for dynamic node connections."""


	def __eq__(self, other: object) -> bool:
		return isinstance(other, str)


	def __ne__(self, other: object) -> bool:
		return False


	def __hash__(self) -> int:
		return hash("*")


class FlexibleOptionalInputType(dict):
	"""Dict-like that accepts any key, returning the same type spec."""
	def __init__(self, type_spec: Any, static_keys: dict | None = None) -> None:
		super().__init__()
		self._type_spec = type_spec
		if static_keys:
			self.update(static_keys)

	def __contains__(self, key: object) -> bool:
		return True

	def __getitem__(self, key: str) -> tuple:
		if key in dict.keys(self):
			return dict.__getitem__(self, key)
		return (self._type_spec,)