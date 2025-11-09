# Changelog
All notable changes are listed here.

## [1.0.0] - 2025-10-19
- Initial release
- Nodes: Image, Mask, Latent, CLIP, Model, VAE, ControlNet, SAM Model, String, Int, Float, Bool
- Conditioning passthrough (positive, negative)
- Multi-passthrough hub with typed outputs and forceInput for primitives

## [1.0.1] - 2025-10-21
- Fixed return value error

## [1.0.2] - 2025-10-26
- Fixed issues with repo, as well as various minor issues

## [1.1.0] - 2025-10-27
- Added a new node "Any Image Batch Switch".
  - Handles multiple optional IMAGE inputs and batches them, or just passes through if it's a single input.