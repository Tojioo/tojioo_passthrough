import re
from pathlib import Path


_PACK_PYTHON = Path(__file__).resolve().parent.parent / "python"
_PLACEHOLDER = re.compile(r"#\s*todo\b|^\s*#\s*[A-Za-z_][\w.]*\s*=\s*\S", re.IGNORECASE)


def test_python_sources_have_no_todo_or_commented_out_code():
	offenders = [
		f"{path.relative_to(_PACK_PYTHON)}:{number}"
		for path in sorted(_PACK_PYTHON.rglob("*.py"))
		for number, line in enumerate(path.read_text(encoding = "utf-8-sig").splitlines(), 1)
		if _PLACEHOLDER.search(line)
	]
	assert offenders == []


def test_dynamic_bus_has_no_unused_bus_type():
	from python.nodes import dynamic_bus

	assert not hasattr(dynamic_bus, "bus_type")
