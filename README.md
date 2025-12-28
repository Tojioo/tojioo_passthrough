## Tojioo Passthrough Nodes for ComfyUI

Typed passthrough nodes to reduce wire clutter in subgraphs. Includes a multi-type dynamic passthrough, and utility nodes for batch switching among other various quality-of-life improvements.

### Nodes
- **Simple Passthroughs**: Image, Mask, Latent, CLIP, Model, VAE, ControlNet, SAM Model, String, Int, Float, Bool
- **Conditioning Passthrough**: Positive and negative conditioning
- **Multi-Passthrough Hub**: Optional inputs with typed outputs
- **Dynamic Nodes**:
    - Dynamic Passthrough: Flexible multi-input passthrough with type mirroring
    - Dynamic Single: Single input passthrough with type mirroring
    - Dynamic Bus (Beta): Context/bus for carrying multiple typed values
    - Dynamic Preview (Beta): Tabbed multi-input preview with interactive controls.
- **Batch Switch Nodes**: Any Image, Mask, Latent, Conditioning Batch Switch
- **Switch Nodes**: Any Image, Mask, Latent, CLIP, Model, VAE, ControlNet, SAM Model, String, Int, Float, Bool Switch

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
**Category Structure:**
- `Tojioo Passthrough`: Multi-Passthrough hub
- `Tojioo Passthrough/Simple Passthrough`: All typed passthroughs, Conditioning Passthrough
- `Tojioo Passthrough/Dynamic Nodes`: Dynamic Passthrough, Dynamic Bus, Dynamic Single Passthrough
- `Tojioo Passthrough/Dynamic Nodes/Batch Switch Nodes`: Batch switching nodes
- `Tojioo Passthrough/Dynamic Nodes/Switch Nodes`: First-valid switching nodes

#### Batch Switch Behavior:
- Dynamic inputs: start with one slot, auto-add on connection
- Single input: pass through unchanged
- Multiple inputs: automatically batch by compatible shape
- Muted inputs: ignored

#### Example:
<img width="873" height="884" alt="image" src="https://github.com/user-attachments/assets/97cf66cd-307e-40e6-a8be-9a014b70a3c5" />

#### Switch Behavior:
- Dynamic inputs: auto-add slots
- Returns first connected input by slot number
- Muted inputs: ignored

#### Example:
<img width="873" height="872" alt="image" src="https://github.com/user-attachments/assets/4eabfea0-4ec4-4a38-83e8-fb391b60afeb" />

#### Dynamic Passthrough:
- Dynamic multi-input/output
- Types adapt based on connections
- Output types mirror connected inputs

#### Example:
<img width="873" height="550" alt="image" src="https://github.com/user-attachments/assets/311f7d35-2895-4527-9113-d8c4eaa3aa96" />


### File Structure
```
tojioo-passthrough/
├── .github/
│   └── workflows/
├── example_workflows/
│   └── Tojioo Passthrough.json
├── js/
│   ├── config/
│   │   └── constants.js
│   ├── handlers/
│   │   ├── batch_switch.js
│   │   ├── dynamic_bus.js
│   │   ├── dynamic_passthrough.js
│   │   ├── dynamic_preview.js
│   │   ├── dynamic_single.js
│   │   └── switch.js
│   ├── utils/
│   │   ├── graph.js
│   │   ├── lifecycle.js
│   │   └── types.js
│   └── index.js
├── src_python/
│   ├── config/
│   │   ├── categories.py
│   │   └── types.py
│   ├── controllers/
│   │   ├── passthrough_controller.py
│   │   └── switch_controller.py
│   ├── handlers/
│   │   ├── batch_handler.py
│   │   └── type_handler.py
│   ├── nodes/
│   │   ├── base.py
│   │   ├── conditioning.py
│   │   ├── dynamic_bus.py
│   │   ├── dynamic_passthrough.py
│   │   ├── dynamic_preview.py
│   │   ├── dynamic_single.py
│   │   └── multi_pass.py
│   ├── utils/
│   │   ├── logger.py
│   │   └── wsl_patch.py
│   └── __init__.py
│   └── extensions.py
├── tests/
│   ├── conftest.py
│   ├── test_config.py
│   ├── test_controllers.py
│   ├── test_handlers.py
│   ├── test_logger.py
│   ├── test_nodes.py
│   └── test_utils.py
├── __init__.py
├── CHANGELOG.md
├── LICENSE
├── pyproject.toml
└── README.md
```

### License
GPL-3.0-only. See [LICENSE](LICENSE).

### Changelog
See [CHANGELOG](CHANGELOG.md).
