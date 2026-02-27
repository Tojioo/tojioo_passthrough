# Changelog
All notable changes are listed here.

## [1.7.1] - 2026-02-26
### Improved
- **Dynamic Preview**:
	- Removed "Beta" label.
	- Accepts any input type, not just IMAGE. Images and masks display visually, all other types display as formatted text.
	- Rewrote preview rendering to DOM widgets, fixing text overflow and tab button occlusion.
	- Tab bar scrolls horizontally when tabs overflow and centers when they fit.
- **Dynamic Nodes**:
	- All dynamic nodes (Passthrough, Any, Bus, Preview) now appear in the slot menu when dragging a link, and auto-connect on creation.

### Internal
- Reorganized and standardized internal logging.
- Expanded test coverage for DOM widgets, clone handling, and dynamic node behavior.

## [1.7.0] - 2026-02-20
### New Features
- Added Dual CLIP Text Encode
	- Encodes a positive and negative text prompt into conditioning using a shared CLIP model.
- Added Tiled VAE Settings
	- Provides tiled VAE encoding/decoding settings as connectable outputs for use in subgraphs.

### Improved
- **Frontend**:
	- Compacted `Dynamic Bus` gaps and refined slot pruning logic to keep slots tidy.
	- Simplified deferred synchronization in `Dynamic Bus` nodes.
	- Fixed `Dynamic Bus` nodes with only output slots disconnecting on reload.
	- Fixed slot reset logic and connection pruning in `Dynamic Bus`.

### Internal
- **Frontend**:
	- Added Vitest-based TypeScript unit tests for core utilities (lifecycle, types).
	- Added lightweight handler simulation tests to mimic user connections in ComfyUI (dynamic_any, dynamic_passthrough, dynamic_bus, dynamic_preview, switch, batch_switch).
	- Standardized function naming conventions and centralized imports.
- **General**:
	- Added GitHub Actions job `web-tests` to install web deps and run Vitest on Node 20.
	- Centralized versioning and improved task organization via refactored workflows.
- **Backend**:
	- Moved python package into separate "python" folder to mirror frontend structure approach.
	- Added formatted internal logger.
	- Improved Python handler and controller test coverage; deleted outdated tests.

## [1.6.1] - 2026-01-03
### Improved
- **Python Backend**:
  - Enhanced `Dynamic Any` node to support both legacy (`input`) and stable (`input_1`) parameter names for improved backwards compatibility.
- **Frontend**:
  - Refined `Dynamic Bus` input/output slot naming and management to correctly track bus indices across slots.
  - Improved slot pruning logic to preserve slots with active connections while removing truly disconnected ones.
  - Enhanced bus type propagation to properly handle chained `Dynamic Bus` nodes by introducing `onBusChanged` callbacks for downstream updates.
  - Strengthened graph access safety in dynamic node handlers by introducing utility functions (`GetGraph`, `GetNodeById`, `GetInputLink`, `GetLink`) to prevent crashes during edge cases.
  - Improved `Dynamic Bus` type labeling to ensure consistent naming across multi-type connections (e.g., `image`, `image_2`).

### Fixed
- Fixed slot naming collisions and re-indexing inconsistencies in `Dynamic Bus` nodes.
- Fixed potential crashes during undo/redo operations by safely accessing graph and link references.

### Renamed
- Renamed "Dynamic Single" to "Dynamic Any" to better reflect its capability of passing through any data type.

## [1.6.0] - 2026-01-02
### Improved
- **Python Backend**:
  - Simple passthrough nodes (Image, Mask, Latent, etc.) now gracefully handle muted or bypassed predecessor nodes by treating them as `None` instead of failing.
  - Improved `Conditioning Passthrough` to handle missing/muted inputs.
- **Frontend**:
  - Node size updates now only expand the node to fit new slots, preventing accidental shrinking and preserving manual resizing (especially important for `Dynamic Preview`).
  - Improved immediate UI feedback when connecting inputs to dynamic nodes.

### Fixed
- **Frontend**:
  - Fixed an issue where output slot labels were not correctly updated in the ComfyUI frontend when a node was renamed or its type changed.
  - Fixed a bug where dynamic nodes would reset to their default small size when loading a workflow, potentially hiding the preview area in `Dynamic Preview`.

### Internal
- Migrated the entire frontend extension to TypeScript for better maintainability and type safety.
- Consolidated web assets under a modern `web/` directory with a Vite build system.

## [1.5.1] - 2025-12-28
### Improved
- Dynamic Preview Node:
  - Replaced the bottom navigation bar with a new tabbed interface for easier switching between multiple previews.
  - Improved layout logic to prevent preview overlapping with input slots.
  - Optimized canvas redrawing and hit detection for UI elements.
- Dynamic Single Node:
  - Enhanced type resolution logic to correctly mirror types from both upstream and downstream connections.
  - Improved reliability during initial workflow loading.
  - Renamed internal display name to "Dynamic Single Passthrough" for consistency with other dynamic nodes.

### Fixed
- Fixed issues where dynamic nodes would occasionally lose their type state when the graph was reloading.
- Resolved a bug in Dynamic Preview where the node size would stay "locked" even after all inputs were disconnected.

## [1.5.0] - 2025-12-28
### New Features
- Added dynamic single node
  - Same as dynamic passthrough, but only allows a single input / output.
- Added dynamic bus (Beta, currently in development)
  - First slot is a static bus type that packs all subsequent inputs into a single bus output
  - Can be used to combine multiple inputs into a single output
  - Can be used to split a single bus input into multiple outputs
  - Input slots are dynamically added/removed
  - Outputs are typed based on connected inputs
- Added dynamic preview node (Beta, currently in development)
  - Allows multiple dynamic inputs with tabs to choose which input to preview.

### Internal
- Refined dynamic node logic for better stability and edge-case handling.
- Reorganized codebase into modular `src_python/` and `src_js/` directories.
  - Python modules now organized under `src_python/` (config, controllers, handlers, nodes, utils)
  - JavaScript handlers consolidated under `src_js/` with configuration and utilities.
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
