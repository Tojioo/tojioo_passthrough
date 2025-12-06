# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes - Utility Module
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from typing import Dict, Any


def create_utility_nodes(
	category: str,
	node_ui_specs: Dict[str, Dict[str, Any]]
) -> Dict[str, type]:
	"""
	Factory to create all utility node classes.

	Args:
		category: Category prefix for nodes
		node_ui_specs: UI specifications for utility nodes

	Returns:
		Dictionary mapping class names to node classes
	"""

	def _dynamic_optional(node_key: str):
		spec = node_ui_specs[node_key]
		base_name, type_name = spec["inputs_optional"][0]
		prefix = "".join(ch for ch in base_name if not ch.isdigit())

		class DynamicOptional(dict):
			def __contains__(self, key):
				if isinstance(key, str) and key.startswith(prefix):
					return True
				return dict.__contains__(self, key)

			def __getitem__(self, key):
				if isinstance(key, str) and key.startswith(prefix):
					return (type_name,)
				return dict.__getitem__(self, key)

		return DynamicOptional({base_name: (type_name,)})

	class PT_AnyImageBatchSwitch:
		"""
		Fallback-or-batch for IMAGE inputs.
		Takes multiple optional IMAGE inputs.
		 - If only one valid input is connected, it passes it through.
		 - If multiple valid inputs are connected, it batches them into one IMAGE batch.
		Batching groups by matching HxWxC. It concatenates the largest compatible group along batch dim.
		"""
		DESCRIPTION = "IMAGE fallback with automatic batching when multiple inputs are present."
		_NODE_SPEC = node_ui_specs["PT_AnyImageBatchSwitch"]
		NODE_NAME = _NODE_SPEC.get("node_name", "Any Image Batch Switch")

		@classmethod
		def INPUT_TYPES(cls):
			opt = _dynamic_optional("PT_AnyImageBatchSwitch")
			return {"required": {}, "optional": opt}

		# Outputs derived from spec mapping
		_OUT = _NODE_SPEC["outputs"][0]
		RETURN_TYPES = (_OUT[1],)
		RETURN_NAMES = (_OUT[0],)
		FUNCTION = "run"
		CATEGORY = category

		def _ensure_4d(self, img):
			# ComfyUI IMAGE is typically [B,H,W,C]. If single, ensure batch dimension.
			if hasattr(img, "dim") and img.dim() == 3:
				return img.unsqueeze(0)
			return img

		def run(self, **kwargs):
			images = [v for v in kwargs.values() if v is not None]

			if not images:
				raise ValueError(f"{self.NODE_NAME}: no IMAGE inputs connected.")

			# If single valid input, pass through unchanged
			if len(images) == 1:
				return (images[0],)

			# Multiple inputs: batch by compatible spatial shape
			import torch

			prepped = []
			for img in images:
				t = self._ensure_4d(img)
				if not isinstance(t, torch.Tensor):
					raise TypeError(f"{self.NODE_NAME} expects IMAGE tensors.")
				prepped.append(t)

			# Group by HxWxC (ignore batch size)
			from collections import defaultdict

			def shape_key(t: "torch.Tensor"):
				if t.dim() != 4:
					raise ValueError(f"IMAGE must be 4D [B,H,W,C], got {t.shape}.")
				return int(t.shape[1]), int(t.shape[2]), int(t.shape[3])

			groups = defaultdict(list)
			for t in prepped:
				groups[shape_key(t)].append(t)

			# Pick the largest compatible group by total resulting batch size
			candidates = []
			for k, ts in groups.items():
				total_b = sum(int(t.shape[0]) for t in ts)
				candidates.append((total_b, k, ts))
			candidates.sort(reverse=True)  # highest total batch first

			_, _, best = candidates[0]

			if len(best) == 1:
				# Only one compatible source after shape check, pass it through
				return (best[0],)

			# Concatenate along batch dimension
			batched = torch.cat(best, dim=0)
			return (batched,)

	class PT_AnyMaskBatchSwitch:
		"""
		Fallback-or-batch for MASK inputs.
		Takes multiple optional MASK inputs.
		 - If only one valid input is connected, it passes it through.
		 - If multiple valid inputs are connected, it batches them into one MASK batch.
		Batching groups by matching HxW. It concatenates along batch dim.
		"""
		DESCRIPTION = "MASK fallback with automatic batching when multiple inputs are present."
		_NODE_SPEC = node_ui_specs["PT_AnyMaskBatchSwitch"]
		NODE_NAME = _NODE_SPEC.get("node_name", "Any Mask Batch Switch")

		@classmethod
		def INPUT_TYPES(cls):
			opt = _dynamic_optional("PT_AnyMaskBatchSwitch")
			return {"required": {}, "optional": opt}

		_OUT = _NODE_SPEC["outputs"][0]
		RETURN_TYPES = (_OUT[1],)
		RETURN_NAMES = (_OUT[0],)
		FUNCTION = "run"
		CATEGORY = category

		def _ensure_3d(self, m):
			# ComfyUI MASK is typically [H,W] or [B,H,W]. Ensure batch dim present.
			if hasattr(m, "dim") and m.dim() == 2:
				return m.unsqueeze(0)
			return m

		def run(self, **kwargs):
			masks = [v for v in kwargs.values() if v is not None]

			if not masks:
				raise ValueError(f"{self.NODE_NAME}: no MASK inputs connected.")

			if len(masks) == 1:
				return (masks[0],)

			import torch
			prepped = []
			for m in masks:
				t = self._ensure_3d(m)
				if not isinstance(t, torch.Tensor):
					raise TypeError(f"{self.NODE_NAME} expects MASK tensors.")
				prepped.append(t)

			from collections import defaultdict

			def shape_key(t: "torch.Tensor"):
				if t.dim() != 3:
					raise ValueError(f"MASK must be 3D [B,H,W], got {t.shape}.")
				return int(t.shape[1]), int(t.shape[2])

			groups = defaultdict(list)
			for t in prepped:
				groups[shape_key(t)].append(t)

			candidates = []
			for k, ts in groups.items():
				total_b = sum(int(t.shape[0]) for t in ts)
				candidates.append((total_b, k, ts))
			candidates.sort(reverse=True)

			_, _, best = candidates[0]
			if len(best) == 1:
				return (best[0],)

			batched = torch.cat(best, dim=0)
			return (batched,)

	class PT_AnyLatentBatchSwitch:
		"""
		Fallback-or-batch for LATENT inputs (dicts with 'samples': Tensor[B,C,H,W]).
		- If one input is connected, it passes it through.
		- If multiple inputs are connected, it batches by matching CxHxW and concatenates samples.
		Non-sample metadata is taken from the first input; potentially conflicting keys like
		'noise_mask' are dropped when batching multiple sources to avoid shape mismatches.
		"""
		DESCRIPTION = "LATENT fallback with automatic batching when multiple inputs are present."
		_NODE_SPEC = node_ui_specs["PT_AnyLatentBatchSwitch"]
		NODE_NAME = _NODE_SPEC.get("node_name", "Any Latent Batch Switch")

		@classmethod
		def INPUT_TYPES(cls):
			opt = _dynamic_optional("PT_AnyLatentBatchSwitch")
			return {"required": {}, "optional": opt}

		_OUT = _NODE_SPEC["outputs"][0]
		RETURN_TYPES = (_OUT[1],)
		RETURN_NAMES = (_OUT[0],)
		FUNCTION = "run"
		CATEGORY = category

		def _ensure_4d(self, t):
			if hasattr(t, "dim") and t.dim() == 3:
				return t.unsqueeze(0)
			return t

		def run(self, **kwargs):
			latents = [v for v in kwargs.values() if v is not None]

			if not latents:
				raise ValueError(f"{self.NODE_NAME}: no LATENT inputs connected.")

			if len(latents) == 1:
				return (latents[0],)

			import torch
			prepped = []
			for L in latents:
				if not isinstance(L, dict) or "samples" not in L:
					raise TypeError(f"{self.NODE_NAME} expects LATENT dicts with 'samples'.")
				s = self._ensure_4d(L["samples"])  # [B,C,H,W]
				if not isinstance(s, torch.Tensor):
					raise TypeError(f"{self.NODE_NAME} expects 'samples' to be a Tensor.")
				prepped.append((L, s))

			from collections import defaultdict

			def shape_key(t: "torch.Tensor"):
				if t.dim() != 4:
					raise ValueError(f"LATENT samples must be 4D [B,C,H,W], got {t.shape}.")
				return int(t.shape[1]), int(t.shape[2]), int(t.shape[3])

			groups = defaultdict(list)
			for L, s in prepped:
				groups[shape_key(s)].append((L, s))

			candidates = []
			for k, items in groups.items():
				total_b = sum(int(s.shape[0]) for _, s in items)
				candidates.append((total_b, k, items))
			candidates.sort(reverse=True)

			_, _, best = candidates[0]
			if len(best) == 1:
				return (best[0][0],)

			# Concatenate samples along batch dimension
			samples_list = [s for _, s in best]
			batched_samples = torch.cat(samples_list, dim=0)

			# Build output latent dict from first, drop conflicting keys
			out_latent = dict(best[0][0])
			out_latent["samples"] = batched_samples
			# Drop noise-related batch-dependent keys when mixing
			for k in ("noise_mask", "batch_index"):
				if k in out_latent:
					out_latent.pop(k)

			return (out_latent,)

	class PT_AnyConditioningBatchSwitch:
		"""
		Fallback-or-batch for CONDITIONING inputs.
		Each input is a CONDITIONING list. If multiple inputs are connected, it concatenates
		the lists, but only from the largest compatible group. Compatibility key is derived
		from the first element's conditioning tensor shape tail (sequence length and embedding dim),
		to avoid mixing different CLIP embeddings.
		"""
		DESCRIPTION = "CONDITIONING fallback with automatic batching when multiple inputs are present."
		_NODE_SPEC = node_ui_specs["PT_AnyConditioningBatchSwitch"]
		NODE_NAME = _NODE_SPEC.get("node_name", "Any Conditioning Batch Switch")

		@classmethod
		def INPUT_TYPES(cls):
			opt = _dynamic_optional("PT_AnyConditioningBatchSwitch")
			return {"required": {}, "optional": opt}

		_OUT = _NODE_SPEC["outputs"][0]
		RETURN_TYPES = (_OUT[1],)
		RETURN_NAMES = (_OUT[0],)
		FUNCTION = "run"
		CATEGORY = category

		def _cond_key(self, cond_list):
			# cond_list: list of (tensor, dict)
			if not cond_list:
				return (0, 0)  # empty list key
			first = cond_list[0][0] if isinstance(cond_list[0], (list, tuple)) and len(cond_list[0]) > 0 else None
			try:
				# try to use last two dims as key (seq_len, embed_dim)
				import torch  # local import to avoid overhead
				if isinstance(first, torch.Tensor):
					if first.dim() >= 2:
						return int(first.shape[-2]), int(first.shape[-1])
					elif first.dim() == 1:
						return 1, int(first.shape[-1])
			except Exception:
				pass
			return (len(cond_list), -1)

		def run(self, **kwargs):
			conds = [v for v in kwargs.values() if v is not None]

			if not conds:
				raise ValueError(f"{self.NODE_NAME}: no CONDITIONING inputs connected.")

			if len(conds) == 1:
				return (conds[0],)

			from collections import defaultdict

			groups = defaultdict(list)
			for c in conds:
				groups[self._cond_key(c)].append(c)

			candidates = []
			for k, lists in groups.items():
				total_len = sum(len(lst) for lst in lists)
				candidates.append((total_len, k, lists))
			candidates.sort(reverse=True)

			_, _, best = candidates[0]
			if len(best) == 1:
				return (best[0],)

			# Concatenate lists in order
			out = []
			for lst in best:
				out.extend(lst)
			return (out,)

	return {
		"PT_AnyImageBatchSwitch": PT_AnyImageBatchSwitch,
		"PT_AnyMaskBatchSwitch": PT_AnyMaskBatchSwitch,
		"PT_AnyLatentBatchSwitch": PT_AnyLatentBatchSwitch,
		"PT_AnyConditioningBatchSwitch": PT_AnyConditioningBatchSwitch,
	}
