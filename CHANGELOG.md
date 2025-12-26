# Changelog
All notable changes are listed here.

## [1.5.0] - In Development
### New Features
- Added dynamic bus node
    - First slot is a static bus type that packs all subsequent inputs into a single bus output
    - Can be used to combine multiple inputs into a single output
    - Can be used to split a single bus input into multiple outputs
    - Input slots are dynamically added/removed
    - Outputs are typed based on connected inputs
- Added dynamic single node
    - Same as dynamic passthrough, but only allows a single input / output.
### Internal
- Reorganized codebase into modular `src_python/` and `js/` directories
    - Python modules now organized under `src_python/` (config, controllers, handlers, nodes, utils)
    - JavaScript handlers consolidated under `js/` with configuration and utilities
- Complete handler system for dynamic nodes
    - Dynamic Passthrough handler
    - Dynamic Bus handler
    - Dynamic Single handler
    - Batch Switch handler
    - Switch handler
    - Type resolution and graph utilities
- Configuration system:
    - Centralized type definitions (`types.py`)
    - Category hierarchy management (`categories.py`)
- Infrastructure improvements:
    - Added `BaseNode` class for consistent node implementation
    - Refactored logger and WSL patch utilities
    - Improved test structure and imports

## [1.4.0] - 2025-12-19
- Added dynamic passthrough node
    - Input slots are dynamically added/removed
    - Outputs are typed based on connected inputs
- Added widget versions of the primitive type passthrough nodes (Int, Float, Bool, String)

## [1.3.2] - 2025-12-12
- Fixed dynamic nodes behavior when connecting/disconnecting inputs again
- Added tests to the repository
- Added a silent "wsl_patch" node to reduce checkpoint loading time

## [1.3.1] - 2025-12-07
- Fixed dynamic nodes behavior when connecting/disconnecting inputs

## [1.3.0] - 2025-12-06
- Added new Any*Switch nodes (first-valid input passthrough, no batching):
	- Any Image Switch
    - Any Mask Switch
    - Any Latent Switch
	- Any CLIP Switch
    - Any Model Switch
    - Any VAE Switch
	- Any ControlNet Switch
    - Any SAM Model Switch
	- Any String Switch
    - Any Int Switch
    - Any Float Switch
    - Any Bool Switch
- These nodes return the first connected input (by slot number) and ignore disconnected/muted inputs

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