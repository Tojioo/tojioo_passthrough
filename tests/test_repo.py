import shutil
import subprocess
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


def _web_job_commands():
	steps = load_workflow("tests.yml")["jobs"]["web-tests"]["steps"]
	return [step.get("run", "") for step in steps]


def test_web_ci_typechecks():
	assert any("npm run typecheck" in run for run in _web_job_commands())


def test_web_ci_fails_when_committed_bundle_is_stale():
	commands = _web_job_commands()
	build = next(i for i, run in enumerate(commands) if "npm run build" in run)
	assert any("git status --porcelain" in run and "web/js" in run for run in commands[build:])


def _triggers(workflow):
	# Because YAML 1.1 reads the bare key "on" as boolean True.
	return workflow.get("on", workflow.get(True))


def test_publish_runs_only_after_tests_pass():
	jobs = load_workflow("publish_action.yml")["jobs"]
	test_jobs = {name for name, job in jobs.items() if job.get("uses") == "./.github/workflows/tests.yml"}
	assert test_jobs
	assert "workflow_call" in _triggers(load_workflow("tests.yml"))

	for job in jobs.values():
		if any("node publish" in step.get("run", "") for step in job.get("steps", [])):
			needs = job.get("needs", [])
			assert test_jobs & set([needs] if isinstance(needs, str) else needs)


DEV_ONLY_PREFIXES = (".github/", ".run/", "tests/", "web/src/", "web/tests/")
DEV_ONLY_FILES = {"web/package.json", "web/package-lock.json", "web/tsconfig.json", "web/vite.config.mts"}
RUNTIME_FILES = {"__init__.py", "pyproject.toml", "LICENSE", "README.md", "web/js/extension.js"}


def _git_files(*args):
	result = subprocess.run(["git", "-C", str(REPO_ROOT), "ls-files", *args], capture_output = True, text = True, check = True)
	return set(result.stdout.splitlines())


@pytest.mark.skipif(shutil.which("git") is None or not (REPO_ROOT / ".git").exists(), reason = "needs a git checkout")
def test_registry_package_ships_only_runtime_files():
	ignore_file = REPO_ROOT / ".comfyignore"
	assert ignore_file.is_file()

	# Needed because comfy node publish zips the git-tracked files minus .comfyignore (gitwildmatch) matches.
	tracked = _git_files()
	shipped = tracked - _git_files("--cached", "--ignored", f"--exclude-from={ignore_file}")

	assert RUNTIME_FILES <= shipped
	assert {f for f in tracked if f.startswith("python/") and f.endswith(".py")} <= shipped
	assert not {f for f in shipped if f.startswith(DEV_ONLY_PREFIXES) or f in DEV_ONLY_FILES}


@pytest.mark.skipif(shutil.which("git") is None or not (REPO_ROOT / ".git").exists(), reason = "needs a git checkout")
@pytest.mark.parametrize("artifact", [".coverage", "coverage.xml", "htmlcov/index.html", "web/coverage/index.html"])
def test_coverage_artifacts_are_gitignored(artifact):
	result = subprocess.run(["git", "-C", str(REPO_ROOT), "check-ignore", "--no-index", "-q", artifact])
	assert result.returncode == 0
