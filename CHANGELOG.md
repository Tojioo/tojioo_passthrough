# Changelog
All notable changes are listed here.

## [1.2.2] - 2025-12-06
- Dynamic Batch Switch inputs: Fix handling of disconnecting inputs, ensuring trailing empty slots are removed correctly

## [1.2.1] - 2025-12-06
- Dynamic Batch Switch inputs: Nodes now start with a single input slot; new slots are automatically added when connecting to the last available slot
- Added frontend JavaScript extension for dynamic input handling
- Internal improvements and code cleanup

## [1.2.0] - 2025-12-06
- Added new Batch Switch utility nodes:
  - Any Mask Batch Switch
  - Any Latent Batch Switch
  - Any Conditioning Batch Switch
- Internal refactor and cleanup:
  - Split implementation into passthrough.py (typed passthroughs) and utility.py (batch/fallback utilities)
  - Centralized node UI specifications and registration in __init__.py
- Category structure updates:
  - Utility nodes now appear under Tojioo/Passthrough/Utility
- Misc:
  - Minor metadata tweaks (icon URL) in pyproject

## [1.1.0] - 2025-10-27
- Added a new node "Any Image Batch Switch".
  - Handles multiple optional IMAGE inputs and batches them, or just passes through if it's a single input.

## [1.0.2] - 2025-10-26
- Fixed issues with repo, as well as various minor issues

## [1.0.1] - 2025-10-21
- Fixed return value error

## [1.0.0] - 2025-10-19
- Initial release
- Nodes: Image, Mask, Latent, CLIP, Model, VAE, ControlNet, SAM Model, String, Int, Float, Bool
- Conditioning passthrough (positive, negative)
- Multi-passthrough hub with typed outputs and forceInput for primitives