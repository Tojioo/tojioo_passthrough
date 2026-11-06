from pathlib import Path

import pytest
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


# Because these are the first majors that run on the Node 24 action runtime.
MIN_ACTION_MAJORS = {
	"actions/checkout": 5,
	"actions/setup-python": 6,
	"actions/setup-node": 5,
}


@pytest.mark.parametrize("workflow_name", sorted(p.name for p in WORKFLOWS_DIR.glob("*.yml")))
def test_workflows_use_node24_action_versions(workflow_name):
	for step in iter_steps(load_workflow(workflow_name)):
		action, _, ref = step.get("uses", "").partition("@")
		if action in MIN_ACTION_MAJORS:
			assert int(ref.lstrip("v").split(".")[0]) >= MIN_ACTION_MAJORS[action], step["uses"]


@pytest.mark.parametrize("workflow_name", sorted(p.name for p in WORKFLOWS_DIR.glob("*.yml")))
def test_workflows_use_supported_node_version(workflow_name):
	for step in iter_steps(load_workflow(workflow_name)):
		if step.get("uses", "").startswith("actions/setup-node@"):
			assert int(str(step["with"]["node-version"]).split(".")[0]) >= 22
