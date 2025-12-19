## Tojioo Passthrough Nodes for ComfyUI

Typed passthrough nodes to reduce wire clutter in subgraphs. Includes a multi-type dynamic passthrough, and utility nodes for batch switching among other various qol improvements.

### Nodes
- Simple passthroughs: Image, Mask, Latent, CLIP, Model, VAE, ControlNet, SAM Model, String, Int, Float, Bool
- Conditioning passthrough: positive and negative
- Multi-Passthrough hub: optional inputs, typed outputs
- Utility Batch Switch nodes: Any Image Batch Switch, Any Mask Batch Switch, Any Latent Batch Switch, Any Conditioning Batch Switch
- Utility Switch nodes (first-valid passthrough): Any Image Switch, Any Mask Switch, Any Latent Switch, Any CLIP Switch, Any Model Switch, Any VAE Switch, Any ControlNet Switch, Any SAM Model Switch, Any String Switch, Any Int Switch, Any Float Switch, Any Bool Switch
- Dynamic Passthrough: flexible input handling, type mirroring.

### Install
#### Manager
Open ComfyUI → Manager → Install Custom Nodes → search "Tojioo Passthrough" → Install → Restart.

#### Git
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Tojioo/tojioo_passthrough.git
```
Restart ComfyUI.

### Usage
- Category structure:
  - `Tojioo/Passthrough`: all simple passthroughs, Conditioning Passthrough, and Multi-Passthrough
  - `Tojioo/Passthrough/Utility`: Switch nodes and Batch Switch nodes (Any Image/Mask/Latent/Conditioning Batch Switch)
- Use single-type nodes for strict typing.
- Use `Conditioning Passthrough` to route positive and negative.
- Use `Multi-Passthrough` as a hub and wire only needed sockets.

#### Batch Switch nodes behavior:
- Dynamic inputs: Nodes start with a single input slot. When you connect to the last available slot, a new one is automatically added.
- If only one valid input is connected, they pass it through unchanged.
- If multiple compatible inputs are connected, they are automatically batched (grouped by compatible shapes/types).
- If an input is connected, but the source node is muted, it gets ignored and treated as if not connected.
- Designed for flexible graph wiring without manual Merge steps.

#### (Example) AnyImageBatchSwitch node:
<img width="876" height="887" alt="image" src="https://github.com/user-attachments/assets/97cf66cd-307e-40e6-a8be-9a014b70a3c5" />

#### Switch nodes behavior (non-batch):
- Dynamic inputs: Same as Batch Switch nodes -> new slots appear automatically.
- Returns the first connected input by slot number (lowest index wins).
- If an input is connected but muted, it is ignored.
- Useful for conditional workflows where only one of several branches should provide output.

#### (Example) AnyImageSwitch node:
<img width="873" height="872" alt="image" src="https://github.com/user-attachments/assets/4eabfea0-4ec4-4a38-83e8-fb391b60afeb" />

#### Dynamic Passthrough:
- Dynamic inputs, same as Batch Switch / Switch nodes.
- Takes any type of input.
- Upon connection, the type is determined and the input / output slots are updated accordingly.
- The type of the output mirrors the connected input.

#### (Example) Dynamic Passthrough node:
*image will be added soon*

### Files
```
tojioo-passthrough/
├── .github/
│ └── workflows/
│ ├── publish_action.yml
│ └── tests.yml
├── js/
│ └── tojioo_passthrough_dynamic.js
├── nodes/
│ ├── __init__.py
│ ├── passthrough.py
│ ├── utility.py
│ └── wsl_patch.py
├── tests/
│ ├── __init__.py
│ ├── conftest.py
│ ├── test_logger.py
│ ├── test_passthrough.py
│ └── test_utility.py
├── __init__.py
├── CHANGELOG.md
├── LICENSE
├── README.md
├── logger.py
└── pyproject.toml
```
### License
GPL-3.0-only.
See [LICENSE](LICENSE).
### Changelog
See [CHANGELOG](CHANGELOG.md).
