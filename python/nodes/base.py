from typing import Any, Dict, Iterable, Iterator


# Invariant: matches MAX_SOCKETS in web/src/types/tojioo.ts, the frontend's cap on dynamic sockets.
MAX_DYNAMIC_INPUTS = 32


def iter_dynamic_input_names(static_keys: Iterable[str], prefix: str) -> Iterator[str]:
	"""Yields the static input names, then prefix_1..prefix_N for the dynamic sockets."""
	static = list(static_keys)
	yield from static
	for i in range(1, MAX_DYNAMIC_INPUTS + 1):
		name = f"{prefix}_{i}"
		if name not in static:
			yield name


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
	def __init__(self, type_spec: Any, static_keys: dict | None = None, dynamic_prefix: str = "input") -> None:
		super().__init__()
		self._type_spec = type_spec
		self._dynamic_prefix = dynamic_prefix
		if static_keys:
			self.update(static_keys)

	def __contains__(self, key: object) -> bool:
		return True

	def __iter__(self) -> Iterator[str]:
		# Because ComfyUI validates, and walks upstream of, only the names it gets by iterating; keys() stays static so /object_info adds no sockets.
		return iter_dynamic_input_names(dict.keys(self), self._dynamic_prefix)

	def __getitem__(self, key: str) -> tuple:
		if key in dict.keys(self):
			return dict.__getitem__(self, key)
		return (self._type_spec,)