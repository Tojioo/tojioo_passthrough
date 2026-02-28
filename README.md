# Tojioo Passthrough Nodes for ComfyUI

Typed passthrough nodes to reduce wire clutter in subgraphs. Includes a multi-type dynamic passthrough, and utility nodes for batch switching among other various quality-of-life improvements.

### Nodes

* **Simple Passthroughs**: Image, Mask, Latent, CLIP, Model, VAE, ControlNet, SAM Model, String, Int, Float, Bool, and Conditioning (positive/negative). Muted or bypassed predecessors are treated as `None`.
* **Multi-Passthrough Hub**: Optional inputs with typed outputs.
* **Dynamic Passthrough**: Multi-input passthrough with automatic type mirroring.
* **Dynamic Any**: Single-input passthrough with type mirroring.
* **Dynamic Bus**: Carries multiple typed values through a single bus connection.
* **Dynamic Preview**: Tabbed viewer for inspecting any data type in-graph.
* **Batch Switch Nodes**: Combine compatible inputs into a single batch (Image, Mask, Latent, Conditioning).
* **Switch Nodes**: Return the first valid connected input by slot order.
* **Dual CLIP Text Encode**: Encodes positive and negative prompts using a shared CLIP model.
* **Tiled VAE Settings**: Exposes tiled VAE parameters as connectable outputs.

### Install

#### Manager

Open ComfyUI → Manager → Install Custom Nodes → search "Tojioo Passthrough" → Install → Restart.

#### Git

```
cd ComfyUI/custom_nodes
git clone https://github.com/Tojioo/tojioo_passthrough.git
```

Restart ComfyUI.

### Usage

**Category Structure:**

* `Tojioo Passthrough`: Multi-Passthrough hub
* `Tojioo Passthrough/Simple Passthrough`: All typed passthroughs, Conditioning Passthrough
* `Tojioo Passthrough/Simple Passthrough/Widget Variants`: Widget-based versions of primitive passthroughs
* `Tojioo Passthrough/Dynamic Nodes`: Dynamic Passthrough, Dynamic Bus, Dynamic Any
* `Tojioo Passthrough/Dynamic Nodes/Batch Switch Nodes`: Batch switching nodes
* `Tojioo Passthrough/Dynamic Nodes/Switch Nodes`: First-valid switching nodes

---

#### Dual CLIP Text Encode

* Purpose: Encode a positive and negative text prompt into conditioning using a single shared CLIP model, keeping the two encode nodes consolidated.
* Behaviour:
	+ Accepts one CLIP input and two text widgets (positive, negative)
	+ Outputs separate `positive` and `negative` CONDITIONING values

---

#### Tiled VAE Settings

* Purpose: Bundle tiled VAE encoding/decoding parameters into connectable outputs so they can be routed cleanly through subgraphs without wiring or promoting individual widgets.
* Behaviour:
	+ Exposes `tile_size`, `overlap`, `temporal_size`, and `temporal_overlap` as typed outputs
	+ Default values: tile_size 512, overlap 64, temporal_size 64, temporal_overlap 8
	+ All values are adjustable via the built-in widget controls

#### Example (Both `Dual CLIP Text Encode` and `Tiled VAE Settings`):

<img alt="v1 7 0_Nodes" src="https://github.com/user-attachments/assets/6c7f84a6-14dd-4578-bb8d-503e928fe6c7" />


---

#### Batch Switch Nodes

* Purpose: Combine multiple compatible inputs into a single batch while keeping wiring tidy.
* Behaviour:
	+ Starts with one slot, adds a new slot when the last one gets connected
	+ With a single connected input, passes through unchanged
	+ With multiple connected inputs, builds a batch when shapes are compatible
	+ Muted or bypassed upstream nodes are treated as missing and ignored

#### Example:

<img alt="image" src="https://github.com/user-attachments/assets/97cf66cd-307e-40e6-a8be-9a014b70a3c5" />

---

#### Switch Nodes

* Purpose: Select the first valid connected input, based on slot order.
* Behaviour:
	+ Dynamic inputs auto-add slots
	+ Returns the first connected input by slot number
	+ Muted or bypassed upstream nodes are treated as missing and ignored

#### Example:

<img alt="image" src="https://github.com/user-attachments/assets/4eabfea0-4ec4-4a38-83e8-fb391b60afeb" />

---

#### Dynamic Passthrough

* Purpose: A flexible multi-input passthrough where slot types mirror what you connect.
* Behaviour:
	+ Dynamic inputs and outputs, slots grow as you connect
	+ Output slot types mirror their corresponding connected input types
	+ Updates live as connections change

#### Example:

https://github.com/user-attachments/assets/6ca45029-c8a9-4b75-8250-ad577a09ddd8



---

#### Dynamic Preview

* Purpose: In-graph viewer for inspecting any value across multiple inputs.
* Behaviour:
	+ Accepts any input type, so slots grow dynamically as you connect
	+ Images and masks display visually, all other types (strings, tensors, conditioning, etc.) display as formatted text
	+ Switch between inputs via the built-in tab selector, which scrolls horizontally when tabs overflow the node width
	+ No outputs, this node is a pure viewer

---

#### Dynamic Bus

* Purpose: Pack multiple typed values into a single bus connection, unpack them downstream, or pass through.
* Behaviour:
	+ First slot is a static bus type, while subsequent slots are dynamic and grow as you connect
	+ Input values are added to the bus alongside any upstream bus contents
	+ Output slots unpack values from the bus by matching types
	+ Direct inputs take priority over bus values for same-slot outputs
	+ A global setting (Settings → Tojioo Passthrough → Dynamic Bus → Overwrite matching types) controls whether a local input replaces the first matching type on the upstream bus or appends as a new entry

#### Example (together with Dynamic Bus Node):

https://github.com/user-attachments/assets/1536665b-328c-4d78-821e-d5ff6191e438



---

### License

GPL-3.0-only. See [LICENSE](LICENSE).

### Changelog

See [CHANGELOG](CHANGELOG.md).