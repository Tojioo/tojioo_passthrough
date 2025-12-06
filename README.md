## Tojioo Passthrough Nodes for ComfyUI

Typed passthrough nodes to reduce wire clutter in subgraphs. Includes a multi-type hub and a dual-conditioning passthrough.

### Nodes
- Simple passthroughs: Image, Mask, Latent, CLIP, Model, VAE, ControlNet, SAM Model, String, Int, Float, Bool
- Conditioning passthrough: positive and negative
- Multi-Passthrough hub: optional inputs, typed outputs
- Utility Batch Switch nodes: Any Image Batch Switch, Any Mask Batch Switch, Any Latent Batch Switch, Any Conditioning Batch Switch

### Install
#### Manager
Open ComfyUI → Manager → Install Custom Nodes → search “Tojioo Passthrough” after it is listed → Install → Restart.

#### Git
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Tojioo/tojioo_passthrough.git
```
Restart ComfyUI.

### Usage
- Category structure:
  - `Tojioo/Passthrough`: all simple passthroughs, Conditioning Passthrough, and Multi-Passthrough
  - `Tojioo/Passthrough/Utility`: Batch Switch nodes (Any Image/Mask/Latent/Conditioning Batch Switch)
- Use single-type nodes for strict typing.
- Use `Conditioning Passthrough` to route positive and negative.
- Use `Multi-Passthrough` as a hub and wire only needed sockets.
- Batch Switch nodes behavior:
  - If only one valid input is connected, they pass it through unchanged.
  - If multiple compatible inputs are connected, they are automatically batched (grouped by compatible shapes/types).
  - If an input is connected, but the source node is muted, it gets ignored and treated as if not connected.
  - Designed for flexible graph wiring without manual Merge steps.

### Files
```
tojioo_passthrough\
⌊__ CHANGELOG.md
⌊__ LICENSE
⌊__ README.md
⌊__ __init__.py
⌊__ passthrough.py
⌊__ utility.py
⌊__ pyproject.toml
```
### License
GPL-3.0-only.  
See [LICENSE](LICENSE).
### Changelog
See [CHANGELOG](CHANGELOG.md).
