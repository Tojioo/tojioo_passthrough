import sys
import types

import pytest

from python.nodes.conditioning import PT_Conditioning
from python.nodes.dynamic_preview import PT_DynamicPreview


class ControlNetApplyAdvancedStub:
	RETURN_NAMES = ("positive", "negative")


@pytest.fixture
def comfy_nodes(monkeypatch):
	module = types.ModuleType("nodes")
	module.NODE_CLASS_MAPPINGS = {
		"PT_Conditioning": PT_Conditioning,
		"ControlNetApplyAdvanced": ControlNetApplyAdvancedStub,
	}
	monkeypatch.setitem(sys.modules, "nodes", module)


@pytest.fixture
def no_comfy_nodes(monkeypatch):
	monkeypatch.setitem(sys.modules, "nodes", None)


def _dual_clip_through_conditioning():
	return {
		"5": {"class_type": "PT_DualCLIPEncode", "inputs": {"clip": ["3", 0], "positive": "good", "negative": "bad"}},
		"7": {"class_type": "PT_Conditioning", "inputs": {"positive": ["5", 0], "negative": ["5", 1]}},
	}


def test_trace_follows_matching_output_of_multi_input_node(comfy_nodes):
	prompt = _dual_clip_through_conditioning()
	assert PT_DynamicPreview._extract_prompt_text(prompt, "7", 0) == "good"
	assert PT_DynamicPreview._extract_prompt_text(prompt, "7", 1) == "bad"


def test_trace_through_controlnet_apply_negative(comfy_nodes):
	prompt = {
		"5": {"class_type": "CLIPTextEncode", "inputs": {"text": "good", "clip": ["3", 0]}},
		"6": {"class_type": "CLIPTextEncode", "inputs": {"text": "bad", "clip": ["3", 0]}},
		"8": {"class_type": "ControlNetApplyAdvanced", "inputs": {
			"positive": ["5", 0], "negative": ["6", 0], "control_net": ["9", 0], "image": ["10", 0], "strength": 1.0,
		}},
	}
	assert PT_DynamicPreview._extract_prompt_text(prompt, "8", 0) == "good"
	assert PT_DynamicPreview._extract_prompt_text(prompt, "8", 1) == "bad"


def test_trace_shows_nothing_when_inputs_are_ambiguous(no_comfy_nodes):
	prompt = _dual_clip_through_conditioning()
	assert PT_DynamicPreview._extract_prompt_text(prompt, "7", 1) is None


def test_trace_single_text_source_still_found(no_comfy_nodes):
	prompt = _dual_clip_through_conditioning()
	prompt["7"]["inputs"].pop("negative")
	assert PT_DynamicPreview._extract_prompt_text(prompt, "7", 0) == "good"


def test_trace_handles_long_shared_chains(no_comfy_nodes):
	# Needed because every node here feeds the next one twice, which explodes a trace without memoisation.
	prompt = {"0": {"class_type": "CLIPTextEncode", "inputs": {"text": "root", "clip": ["c", 0]}}}
	for i in range(1, 60):
		prompt[str(i)] = {"class_type": "Combine", "inputs": {"a": [str(i - 1), 0], "b": [str(i - 1), 0]}}
	assert PT_DynamicPreview._extract_prompt_text(prompt, "59", 0) == "root"
