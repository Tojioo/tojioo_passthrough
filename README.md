## Tojioo Passthrough Nodes for ComfyUI

Typed passthrough nodes to reduce wire clutter in subgraphs. Includes a multi-type hub and a dual-conditioning passthrough.

### Nodes
- Simple passthroughs: Image, Mask, Latent, CLIP, Model, VAE, ControlNet, SAM Model, String, Int, Float, Bool
- Conditioning passthrough: positive and negative
- Multi passthrough: optional inputs, typed outputs
- Int, Float, Boolean use `forceInput` so they appear as sockets

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
- Nodes are under `Tojioo/Passthrough`.
- Use single-type nodes for strict typing.
- Use `Passthrough: Conditioning` to route positive and negative.
- Use `Passthrough: Multi` as a hub and wire only needed sockets.
- INT, FLOAT, BOOLEAN show as sockets via `forceInput`.

### Files
```
"tojioo_passthrough"
⌊___"CHANGELOG.md"
⌊___"LICENSE"
⌊___"README.md"
⌊___"__init__.py"
⌊___"pyproject.toml"
```
### License
GPL-3.0-only.  
See [LICENSE](LICENSE).
### Changelog
See [CHANGELOG](CHANGELOG.md).
