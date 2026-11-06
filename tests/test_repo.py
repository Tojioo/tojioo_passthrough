from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"


def load_workflow(name):
	return yaml.safe_load((WORKFLOWS_DIR / name).read_text(encoding = "utf-8-sig"))


def iter_steps(workflow):
	for job in workflow["jobs"].values():
		yield from job.get("steps", [])


def test_tests_workflow_does_not_upload_to_codecov():
	uses = [step.get("uses", "") for step in iter_steps(load_workflow("tests.yml"))]
	assert not [u for u in uses if u.startswith("codecov/")]
