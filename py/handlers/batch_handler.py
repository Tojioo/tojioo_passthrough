# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

from collections import defaultdict

import torch

from ..config.types import BATCHABLE_TYPES

class BatchHandler:
	@staticmethod
	def can_batch(type_name: str) -> bool:
		return type_name in BATCHABLE_TYPES

	@staticmethod
	def get_handler(type_name: str):
		handlers = {
			"IMAGE": (
				lambda img: img.unsqueeze(0) if img.dim() == 3 else img,
				BatchHandler._tensor_merge()
			),
			"MASK": (
				lambda m: m.unsqueeze(0) if m.dim() == 2 else m,
				BatchHandler._tensor_merge()
			),
			"LATENT": (
				lambda L: L["samples"].unsqueeze(0) if L["samples"].dim() == 3 else L["samples"],
				BatchHandler._tensor_merge(
					lambda orig, t: {k: v for k, v in orig.items()
										if k not in ("samples", "noise_mask", "batch_index")} | {"samples": t}
				)
			),
			"CONDITIONING": (
				lambda c: c,
				lambda vals, _: [item for cond in vals for item in cond]
			)
		}
		return handlers.get(type_name)

	@staticmethod
	def _group_and_batch(prepped):
		groups = defaultdict(list)
		for i, t in enumerate(prepped):
			groups[t.shape[1:]].append((i, t))

		best = max(groups.values(), key=lambda g: sum(t.shape[0] for _, t in g))
		if len(best) == 1:
			return best[0][0], best[0][1]
		return None, torch.cat([t for _, t in best], dim=0)

	@staticmethod
	def _tensor_merge(wrap_fn=None):
		def merge(vals, prepped):
			idx, batched = BatchHandler._group_and_batch(prepped)
			result = vals[idx] if idx is not None else batched
			return wrap_fn(vals[0], result) if wrap_fn and idx is None else result
		return merge