import { app } from "../../scripts/app.js";
const ANY_TYPE$3 = "*";
function GetGraph(node) {
  return (node.rootGraph ?? node.graph) || window.app?.graph;
}
function GetLink(node, linkId) {
  if (linkId == null) {
    return null;
  }
  const g = GetGraph(node);
  if (!g || !g.links) {
    return null;
  }
  return g.links[linkId] ?? null;
}
function GetInputLink(node, slotIndex) {
  if (!node.inputs || !node.inputs[slotIndex]) {
    return null;
  }
  return GetLink(node, node.inputs[slotIndex].link);
}
function GetNodeById(node, id) {
  const g = GetGraph(node);
  return g?.getNodeById?.(id) ?? null;
}
function SetLinkType(node, linkId, type) {
  const g = GetGraph(node);
  const link = g?.links?.[linkId];
  if (!link) {
    return;
  }
  link.type = type;
}
function GetLinkTypeFromEndpoints(node, link) {
  if (!link) {
    return ANY_TYPE$3;
  }
  const origin = GetNodeById(node, link.origin_id);
  const oSlot = origin?.outputs?.[link.origin_slot];
  if (oSlot?.type && oSlot.type !== ANY_TYPE$3 && oSlot.type !== -1) {
    return oSlot.type;
  }
  const target = GetNodeById(node, link.target_id);
  const tSlot = target?.inputs?.[link.target_slot];
  if (tSlot?.type && tSlot.type !== ANY_TYPE$3 && tSlot.type !== -1) {
    return tSlot.type;
  }
  const linkType = link.type;
  if (linkType && linkType !== ANY_TYPE$3 && linkType !== -1) {
    return linkType;
  }
  return ANY_TYPE$3;
}
const LG_INPUT = 1;
const LG_OUTPUT = 2;
const LG_NODE_SLOT_HEIGHT = 20;
function getLiteGraph() {
  if (typeof LiteGraph !== "undefined") {
    return LiteGraph;
  }
  if (typeof window !== "undefined" && window.LiteGraph) {
    return window.LiteGraph;
  }
  return null;
}
function getLgInput() {
  const lg = getLiteGraph();
  return lg?.INPUT ?? LG_INPUT;
}
function getLgOutput() {
  const lg = getLiteGraph();
  return lg?.OUTPUT ?? LG_OUTPUT;
}
function getLgSlotHeight() {
  const lg = getLiteGraph();
  return lg?.NODE_SLOT_HEIGHT ?? LG_NODE_SLOT_HEIGHT;
}
function isNodes2Mode() {
  try {
    const app2 = window.app;
    if (app2?.extensionManager?.setting?.get) {
      const setting = app2.extensionManager.setting.get("Comfy.UseNewMenu");
      if (setting === "Top" || setting === "Bottom") {
        return true;
      }
    }
    const lg = getLiteGraph();
    if (!lg) {
      return true;
    }
    if (typeof document !== "undefined") {
      const vueCanvas = document.querySelector("[data-comfy-graph-canvas]");
      if (vueCanvas) {
        return true;
      }
    }
  } catch {
  }
  return false;
}
const ANY_TYPE$2 = "*";
let _graphLoading = false;
let _pendingCanvasUpdate = null;
let _pendingSizeUpdates = /* @__PURE__ */ new Set();
let _sizeUpdateTimer = null;
function InstallGraphLoadingHook(app2) {
  const original = app2?.loadGraphData;
  if (typeof original !== "function") {
    return;
  }
  if (original.__tojioo_wrapped) {
    return;
  }
  const wrapped = async function(...args) {
    _graphLoading = true;
    try {
      return await original.apply(this, args);
    } finally {
      _graphLoading = false;
    }
  };
  wrapped.__tojioo_wrapped = true;
  app2.loadGraphData = wrapped;
}
function IsGraphLoading() {
  return _graphLoading;
}
function DeferMicrotask(fn) {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fn);
    return;
  }
  Promise.resolve().then(fn);
}
function deriveDynamicPrefixFromNodeData(nodeData) {
  const opt = nodeData?.input?.optional;
  if (!opt) {
    return null;
  }
  const keys = Object.keys(opt);
  if (keys.length === 0) {
    return null;
  }
  const suffixNumberOrInfinity = (s) => {
    const m = String(s).match(/(\d+)$/);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  };
  keys.sort((a, b) => suffixNumberOrInfinity(a) - suffixNumberOrInfinity(b));
  const baseName = keys[0];
  return baseName.replace(/_\d+$/, "").replace(/\d+$/, "");
}
function resolveInputType(node, inputIndex) {
  const inp = node.inputs?.[inputIndex];
  if (!inp) {
    return ANY_TYPE$2;
  }
  const linkId = inp.link;
  if (linkId == null) {
    return ANY_TYPE$2;
  }
  const g = GetGraph(node);
  const link = g?.links?.[linkId];
  if (!link) {
    return ANY_TYPE$2;
  }
  const inferredType = GetLinkTypeFromEndpoints(node, link);
  if (inferredType && inferredType !== ANY_TYPE$2) {
    return inferredType;
  }
  const sourceNode = g?.getNodeById?.(link.origin_id);
  const sourceSlot = sourceNode?.outputs?.[link.origin_slot];
  if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE$2 && sourceSlot.type !== -1) {
    return sourceSlot.type;
  }
  return ANY_TYPE$2;
}
function ScheduleCanvasUpdate(node) {
  if (_pendingCanvasUpdate !== null) {
    return;
  }
  _pendingCanvasUpdate = requestAnimationFrame(() => {
    _pendingCanvasUpdate = null;
    const g = GetGraph(node);
    g?.setDirtyCanvas?.(true, true);
  });
}
function ScheduleSizeUpdate(node) {
  _pendingSizeUpdates.add(node);
  if (_sizeUpdateTimer !== null) {
    return;
  }
  _sizeUpdateTimer = requestAnimationFrame(() => {
    _sizeUpdateTimer = null;
    const nodes = Array.from(_pendingSizeUpdates);
    _pendingSizeUpdates.clear();
    for (const n of nodes) {
      UpdateNodeSizeImmediate(n);
    }
  });
}
function UpdateNodeSizeImmediate(node, expandOnly) {
  try {
    if (typeof node.computeSize !== "function" || typeof node.setSize !== "function") {
      return;
    }
    const isPreview = node.type === "PT_DynamicPreview";
    const useExpandOnly = expandOnly !== void 0 ? expandOnly : isPreview;
    const size = node.computeSize();
    if (useExpandOnly && node.size) {
      size[0] = Math.max(size[0], node.size[0]);
      size[1] = Math.max(size[1], node.size[1]);
    }
    node.setSize(size);
  } catch {
  }
}
function applySwitchDynamicTypes(node, inputPrefix) {
  if (!node.inputs || node.inputs.length === 0) {
    return;
  }
  let resolvedType = ANY_TYPE$2;
  const inputTypes = [];
  for (let i = 0; i < node.inputs.length; i++) {
    const t = resolveInputType(node, i);
    inputTypes.push(t);
    if (t && t !== ANY_TYPE$2 && resolvedType === ANY_TYPE$2) {
      resolvedType = t;
    }
  }
  for (let i = 0; i < node.inputs.length; i++) {
    const inp = node.inputs[i];
    const currentType = inputTypes[i];
    const effectiveType = currentType !== ANY_TYPE$2 ? currentType : resolvedType;
    inp.type = effectiveType;
    const label = effectiveType !== ANY_TYPE$2 ? i === 0 ? effectiveType.toLowerCase() : `${effectiveType.toLowerCase()}_${i + 1}` : i === 0 ? `${inputPrefix}` : `${inputPrefix}_${i + 1}`;
    inp.name = `input_${i + 1}`;
    inp.label = label;
    const linkId = inp.link;
    if (linkId != null && effectiveType !== ANY_TYPE$2) {
      SetLinkType(node, linkId, effectiveType);
    }
  }
  if (node.outputs && node.outputs.length > 0) {
    for (let i = 0; i < node.outputs.length; i++) {
      const out = node.outputs[i];
      out.type = resolvedType;
      if (resolvedType !== ANY_TYPE$2) {
        out.name = "output_1";
        out.label = resolvedType.toLowerCase();
      }
      const outLinks = out.links ?? [];
      for (const linkId of outLinks) {
        if (linkId != null && resolvedType !== ANY_TYPE$2) {
          SetLinkType(node, linkId, resolvedType);
        }
      }
    }
  }
  ScheduleCanvasUpdate(node);
  ScheduleSizeUpdate(node);
}
function UpdateNodeSize(node, expandOnly) {
  if (IsGraphLoading()) {
    return;
  }
  ScheduleSizeUpdate(node);
}
function UpdatePreviewNodeSize(node) {
  if (IsGraphLoading() || node.__tojioo_skip_resize) {
    return;
  }
  ScheduleSizeUpdate(node);
}
function normalizeInputs(node) {
  if (!node.inputs) {
    return;
  }
  let lastConnectedIndex = -1;
  for (let i = node.inputs.length - 1; i >= 0; i--) {
    if (node.inputs[i]?.link != null) {
      lastConnectedIndex = i;
      break;
    }
  }
  const keepCount = Math.max(1, lastConnectedIndex + 2);
  while (node.inputs.length > keepCount) {
    if (typeof node.removeInput === "function") {
      node.removeInput(node.inputs.length - 1);
    } else {
      break;
    }
  }
  ScheduleSizeUpdate(node);
}
function RegisterSlotMenuEntries(type, nodeTypes) {
  const lg = getLiteGraph();
  if (!lg) {
    return;
  }
  if (!lg.slot_types_default_out) {
    lg.slot_types_default_out = {};
  }
  if (!lg.slot_types_default_in) {
    lg.slot_types_default_in = {};
  }
  if (!lg.slot_types_default_out[type]) {
    lg.slot_types_default_out[type] = [];
  }
  if (!lg.slot_types_default_in[type]) {
    lg.slot_types_default_in[type] = [];
  }
  for (const nodeType of nodeTypes) {
    if (!lg.slot_types_default_out[type].includes(nodeType)) {
      lg.slot_types_default_out[type].push(nodeType);
    }
    if (!lg.slot_types_default_in[type].includes(nodeType)) {
      lg.slot_types_default_in[type].push(nodeType);
    }
  }
}
const ANY_TYPE$1 = "*";
const BUS_TYPE = "BUS";
const MAX_SOCKETS = 32;
const TAB_BAR_HEIGHT = 28;
const TAB_PADDING = 10;
const TAB_GAP = 4;
function isBatchSwitch(nodeData) {
  const n = nodeData?.name ?? "";
  return n.startsWith("PT_Any") && n.endsWith("BatchSwitch");
}
function configureBatchSwitchNodes() {
  return {
    name: "Tojioo.Passthrough.Dynamic.BatchSwitchNodes",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (!isBatchSwitch(nodeData)) {
        return;
      }
      const inputPrefix = deriveDynamicPrefixFromNodeData(nodeData);
      if (!inputPrefix) {
        return;
      }
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (!link_info || type !== getLgInput()) {
          return;
        }
        const node = this;
        if (!isConnected) {
          DeferMicrotask(() => {
            if (!node.inputs?.length || index < 0 || index >= node.inputs.length) {
              normalizeInputs(node);
              applySwitchDynamicTypes(node, inputPrefix);
              return;
            }
            if (node.inputs[index]?.link != null) {
              normalizeInputs(node);
              applySwitchDynamicTypes(node, inputPrefix);
              return;
            }
            const hasConnectionsAfter = node.inputs.slice(index + 1).some((i) => i?.link != null);
            if (hasConnectionsAfter && typeof node.removeInput === "function") {
              node.removeInput(index);
            }
            normalizeInputs(node);
            applySwitchDynamicTypes(node, inputPrefix);
          });
          return;
        }
        normalizeInputs(node);
        applySwitchDynamicTypes(node, inputPrefix);
        const lastIndex = node.inputs.length - 1;
        if (index === lastIndex && node.inputs[lastIndex]?.link != null && typeof node.addInput === "function") {
          const resolvedType = resolveInputType(node, lastIndex);
          const socketType = resolvedType !== ANY_TYPE$1 ? resolvedType : node.inputs[0]?.type ?? ANY_TYPE$1;
          node.addInput(`${inputPrefix}_${node.inputs.length + 1}`, socketType);
          normalizeInputs(node);
          applySwitchDynamicTypes(node, inputPrefix);
        }
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        if (!this.inputs?.length) {
          return;
        }
        normalizeInputs(this);
        applySwitchDynamicTypes(this, inputPrefix);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        normalizeInputs(this);
        applySwitchDynamicTypes(this, inputPrefix);
      };
    }
  };
}
const ANY_TYPE = "*";
function ResolvePairType(node, zeroBasedIndex) {
  const out = node.outputs?.[zeroBasedIndex];
  const inp = node.inputs?.[zeroBasedIndex];
  const hasOutputLink = (out?.links?.length ?? 0) > 0;
  const hasInputLink = inp?.link != null;
  if (!hasOutputLink && !hasInputLink) {
    return ANY_TYPE;
  }
  const outLinkId = out?.links?.[0];
  const outLink = GetLink(node, outLinkId ?? null);
  if (outLink) {
    let outType = GetLinkTypeFromEndpoints(node, outLink);
    if (outType === ANY_TYPE) {
      const targetNode = GetNodeById(node, outLink.target_id);
      const targetSlot = targetNode?.inputs?.[outLink.target_slot];
      if (targetSlot?.type && targetSlot.type !== ANY_TYPE && targetSlot.type !== -1) {
        outType = targetSlot.type;
      }
    }
    if (outType && outType !== ANY_TYPE) {
      return outType;
    }
  }
  const inLinkId = inp?.link;
  const inLink = GetLink(node, inLinkId ?? null);
  if (inLink) {
    let inType = GetLinkTypeFromEndpoints(node, inLink);
    if (inType === ANY_TYPE) {
      const sourceNode = GetNodeById(node, inLink.origin_id);
      const sourceSlot = sourceNode?.outputs?.[inLink.origin_slot];
      if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE && sourceSlot.type !== -1) {
        inType = sourceSlot.type;
      }
    }
    if (inType && inType !== ANY_TYPE) {
      return inType;
    }
  }
  return ANY_TYPE;
}
function UpdateLinkTypesForSlot(node, zeroBasedIndex, type) {
  const inLinkId = node.inputs?.[zeroBasedIndex]?.link;
  if (inLinkId != null) {
    SetLinkType(node, inLinkId, type);
  }
  const outLinks = node.outputs?.[zeroBasedIndex]?.links ?? [];
  for (const linkId of outLinks) {
    if (linkId != null) {
      SetLinkType(node, linkId, type);
    }
  }
}
function ResolveConnectedType(node, inp, out) {
  const isConcrete = (t) => t != null && t !== ANY_TYPE && t !== -1;
  const hasInputLink = inp?.link != null;
  const hasOutputLink = (out?.links?.length ?? 0) > 0;
  if (!hasInputLink && !hasOutputLink) {
    return ANY_TYPE;
  }
  const tryFromLink = (linkId, peer) => {
    if (linkId == null) {
      return;
    }
    const link = GetLink(node, linkId);
    if (!link) {
      return;
    }
    const endpointType = GetLinkTypeFromEndpoints(node, link);
    if (isConcrete(endpointType)) {
      return endpointType;
    }
    if (peer === "origin") {
      const peerNode2 = GetNodeById(node, link.origin_id);
      const peerSlot2 = peerNode2?.outputs?.[link.origin_slot];
      return isConcrete(peerSlot2?.type) ? peerSlot2.type : void 0;
    }
    const peerNode = GetNodeById(node, link.target_id);
    const peerSlot = peerNode?.inputs?.[link.target_slot];
    return isConcrete(peerSlot?.type) ? peerSlot.type : void 0;
  };
  const inType = tryFromLink(inp?.link, "origin");
  if (inType) {
    return inType;
  }
  const outType = tryFromLink(out?.links?.[0], "target");
  if (outType) {
    return outType;
  }
  if (hasInputLink && isConcrete(inp?.type)) {
    return inp.type;
  }
  if (hasOutputLink && isConcrete(out?.type)) {
    return out.type;
  }
  return ANY_TYPE;
}
function ProcessTypeNames(types, i, typeCounters, inputNames, outputNames) {
  const t = types[i];
  const isTyped = t && t !== ANY_TYPE;
  if (isTyped) {
    const baseLabel = t.toLowerCase();
    if (typeCounters[t] === void 0) {
      typeCounters[t] = 1;
    }
    const occurrence = typeCounters[t];
    typeCounters[t]++;
    const name = occurrence === 1 ? baseLabel : `${baseLabel}_${occurrence}`;
    inputNames.push(name);
    outputNames.push(name);
  } else {
    if (typeCounters["__untyped__"] === void 0) {
      typeCounters["__untyped__"] = 1;
    }
    const occurrence = typeCounters["__untyped__"];
    typeCounters["__untyped__"]++;
    inputNames.push(occurrence === 1 ? "input" : `input_${occurrence}`);
    outputNames.push(occurrence === 1 ? "output" : `output_${occurrence}`);
  }
}
function AssignTypeAndName(types, i, node, inputNames, outputNames) {
  const currentType = types[i];
  const isBusNode = node.type === "PT_DynamicBus";
  if (node.inputs?.[i]) {
    node.inputs[i].type = currentType;
    if (isBusNode && i === 0) {
      node.inputs[i].name = "bus";
    } else {
      let idx = isBusNode ? i : i + 1;
      if (isBusNode && node.inputs[i].name) {
        const m = node.inputs[i].name.match(/input_(\d+)/);
        if (m) idx = parseInt(m[1]);
      }
      node.inputs[i].name = `input_${idx}`;
    }
    node.inputs[i].label = inputNames[i];
  }
  if (node.outputs?.[i]) {
    node.outputs[i].type = currentType;
    if (isBusNode && i === 0) {
      node.outputs[i].name = "bus";
    } else {
      let idx = isBusNode ? i : i + 1;
      if (isBusNode && node.outputs[i].name) {
        const m = node.outputs[i].name.match(/output_(\d+)/);
        if (m) idx = parseInt(m[1]);
      }
      node.outputs[i].name = `output_${idx}`;
    }
    node.outputs[i].label = outputNames[i];
  }
  return currentType;
}
function ApplyDynamicTypes(node) {
  const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
  const types = [];
  for (let i = 0; i < count; i++) {
    types.push(ResolvePairType(node, i));
  }
  const inputNames = [];
  const outputNames = [];
  const typeCounters = {};
  for (let i = 0; i < count; i++) {
    ProcessTypeNames(types, i, typeCounters, inputNames, outputNames);
  }
  for (let i = 0; i < count; i++) {
    const currentType = AssignTypeAndName(types, i, node, inputNames, outputNames);
    if (currentType && currentType !== ANY_TYPE) {
      UpdateLinkTypesForSlot(node, i, currentType);
    }
  }
  const g = GetGraph(node);
  g?.setDirtyCanvas?.(true, true);
  node.type === "PT_DynamicPreview";
  UpdateNodeSize(node);
}
function configureDynamicBus() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicBus",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (nodeData.name !== "PT_DynamicBus") {
        return;
      }
      function getSourceBusTypes(node) {
        const busInput = node.inputs?.[0];
        if (!busInput || busInput.link == null) {
          return null;
        }
        const link = GetInputLink(node, 0);
        if (!link) {
          return null;
        }
        const sourceNode = GetNodeById(node, link.origin_id);
        return sourceNode?.properties?._bus_slot_types ?? null;
      }
      function resolveSlotType(node, slotIndex, busTypes) {
        const inp = node.inputs?.[slotIndex];
        const out = node.outputs?.[slotIndex];
        const t = ResolveConnectedType(node, inp, out);
        if (t !== ANY_TYPE$1) {
          return t;
        }
        const isConnected = inp?.link != null || (out?.links?.length ?? 0) > 0;
        if (isConnected) {
          const busIndex = slotIndex - 1;
          if (busTypes?.[busIndex] !== void 0) {
            return busTypes[busIndex];
          }
        }
        return ANY_TYPE$1;
      }
      function normalizeIO(node) {
        if (!node.inputs) node.inputs = [];
        if (!node.outputs) node.outputs = [];
        const slotsToKeep = /* @__PURE__ */ new Set();
        slotsToKeep.add(0);
        const maxLen = Math.max(node.inputs.length, node.outputs.length);
        for (let i = 1; i < maxLen; i++) {
          const inputConnected = i < node.inputs.length && node.inputs[i]?.link != null;
          const outputConnected = i < node.outputs.length && (node.outputs[i]?.links?.length ?? 0) > 0;
          if (inputConnected || outputConnected) {
            slotsToKeep.add(i);
          }
        }
        for (let i = maxLen - 1; i >= 1; i--) {
          if (!slotsToKeep.has(i)) {
            if (i < node.inputs.length && typeof node.removeInput === "function") {
              node.removeInput(i);
            }
            if (i < node.outputs.length && typeof node.removeOutput === "function") {
              node.removeOutput(i);
            }
          }
        }
        if (node.inputs.length === 0 && typeof node.addInput === "function") {
          node.addInput("bus", BUS_TYPE);
        } else if (node.inputs[0]) {
          node.inputs[0].name = "bus";
          node.inputs[0].label = "bus";
          node.inputs[0].type = BUS_TYPE;
        }
        if (node.outputs.length === 0 && typeof node.addOutput === "function") {
          node.addOutput("bus", BUS_TYPE);
        } else if (node.outputs[0]) {
          node.outputs[0].name = "bus";
          node.outputs[0].label = "bus";
          node.outputs[0].type = BUS_TYPE;
        }
        const busTypes = getSourceBusTypes(node) || {};
        const occupiedInBus = new Set(Object.keys(busTypes).map(Number));
        const localIndicesInUse = /* @__PURE__ */ new Set();
        for (let i = 1; i < node.inputs.length; i++) {
          const input = node.inputs[i];
          let currentIdx = -1;
          const m = input.name?.match(/input_(\d+)/);
          if (m) currentIdx = parseInt(m[1]) - 1;
          const isInputConnected = input.link != null;
          const isOutputConnected = (node.outputs?.[i]?.links?.length ?? 0) > 0;
          if (currentIdx === -1 || localIndicesInUse.has(currentIdx) || (isInputConnected || isOutputConnected) && occupiedInBus.has(currentIdx)) {
            let nextIdx = 0;
            while (occupiedInBus.has(nextIdx) || localIndicesInUse.has(nextIdx)) nextIdx++;
            input.name = `input_${nextIdx + 1}`;
            if (node.outputs[i]) node.outputs[i].name = `output_${nextIdx + 1}`;
            localIndicesInUse.add(nextIdx);
          } else {
            localIndicesInUse.add(currentIdx);
          }
        }
        let nextBusIdx = 0;
        while (occupiedInBus.has(nextBusIdx) || localIndicesInUse.has(nextBusIdx)) nextBusIdx++;
        if (typeof node.addInput === "function") {
          node.addInput("input", ANY_TYPE$1);
          node.inputs[node.inputs.length - 1].name = `input_${nextBusIdx + 1}`;
          node.inputs[node.inputs.length - 1].label = "input";
        }
        if (typeof node.addOutput === "function") {
          node.addOutput("output", ANY_TYPE$1);
          node.outputs[node.outputs.length - 1].name = `output_${nextBusIdx + 1}`;
          node.outputs[node.outputs.length - 1].label = "output";
        }
        UpdateNodeSize(node, node.__tojioo_dynamic_io_size_fixed || false);
        node.__tojioo_dynamic_io_size_fixed = true;
      }
      function AssignBusTypeAndName(types, i, node, inputNames, outputNames) {
        const currentType = types[i];
        if (node.inputs?.[i]) {
          node.inputs[i].type = currentType;
          if (i === 0) {
            node.inputs[i].name = "bus";
          } else {
            let idx = i;
            if (node.inputs[i].name) {
              const m = node.inputs[i].name.match(/input_(\d+)/);
              if (m) idx = parseInt(m[1]);
            }
            node.inputs[i].name = `input_${idx}`;
          }
          node.inputs[i].label = inputNames[i];
        }
        if (node.outputs?.[i]) {
          node.outputs[i].type = currentType;
          if (i === 0) {
            node.outputs[i].name = "bus";
          } else {
            let idx = i;
            if (node.outputs[i].name) {
              const m = node.outputs[i].name.match(/output_(\d+)/);
              if (m) idx = parseInt(m[1]);
            }
            node.outputs[i].name = `output_${idx}`;
          }
          node.outputs[i].label = outputNames[i];
        }
        return currentType;
      }
      function applyBusDynamicTypes(node) {
        const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
        const busTypes = getSourceBusTypes(node) || {};
        const types = [BUS_TYPE];
        for (let i = 1; i < count; i++) {
          types.push(resolveSlotType(node, i, busTypes));
        }
        for (let i = 1; i < count; i++) {
          if (types[i] !== ANY_TYPE$1 && node.outputs?.[i]) {
            node.outputs[i].type = types[i];
          }
        }
        const typeCounters = {};
        const inputNames = ["bus"];
        const outputNames = ["bus"];
        const slotIdxToBusIdx = /* @__PURE__ */ new Map();
        const busIdxToSlotIdx = /* @__PURE__ */ new Map();
        for (let i = 1; i < count; i++) {
          const m = node.inputs[i]?.name?.match(/input_(\d+)/);
          if (m) {
            const busIdx = parseInt(m[1]) - 1;
            slotIdxToBusIdx.set(i, busIdx);
            busIdxToSlotIdx.set(busIdx, i);
          }
        }
        let maxIdx = -1;
        for (const idxStr of Object.keys(busTypes)) {
          maxIdx = Math.max(maxIdx, parseInt(idxStr));
        }
        for (const busIdx of slotIdxToBusIdx.values()) {
          maxIdx = Math.max(maxIdx, busIdx);
        }
        const orderedInputLabels = {};
        const orderedOutputLabels = {};
        for (let idx = 0; idx <= maxIdx; idx++) {
          const slotI = busIdxToSlotIdx.get(idx);
          const t = slotI !== void 0 ? types[slotI] : busTypes[idx];
          if (!t) continue;
          const isTyped = t !== ANY_TYPE$1;
          const baseLabel = isTyped ? t.toLowerCase() : "input";
          const counterKey = isTyped ? t : "__untyped__";
          typeCounters[counterKey] = (typeCounters[counterKey] || 0) + 1;
          const occurrence = typeCounters[counterKey];
          const label = occurrence === 1 ? baseLabel : `${baseLabel}_${occurrence}`;
          if (slotI !== void 0) {
            orderedInputLabels[slotI] = label;
            orderedOutputLabels[slotI] = label;
          }
        }
        for (let i = 1; i < count; i++) {
          inputNames[i] = orderedInputLabels[i] || "input";
          outputNames[i] = orderedOutputLabels[i] || "output";
        }
        for (let i = 0; i < count; i++) {
          const currentType = AssignBusTypeAndName(types, i, node, inputNames, outputNames);
          if (i > 0 && currentType !== ANY_TYPE$1) {
            const inLink = GetInputLink(node, i);
            if (inLink) {
              inLink.type = currentType;
            }
            for (const linkId of node.outputs?.[i]?.links ?? []) {
              const link = GetLink(node, linkId);
              if (link) {
                link.type = currentType;
              }
            }
          }
        }
        const busInLink = GetInputLink(node, 0);
        if (busInLink) {
          busInLink.type = BUS_TYPE;
        }
        for (const linkId of node.outputs?.[0]?.links ?? []) {
          const link = GetLink(node, linkId);
          if (link) {
            link.type = BUS_TYPE;
          }
        }
        if (!node.properties) node.properties = {};
        node.properties._bus_slot_types = {};
        if (busTypes) {
          for (const [idx, t] of Object.entries(busTypes)) {
            node.properties._bus_slot_types[idx] = t;
          }
        }
        for (let i = 1; i < count; i++) {
          if (types[i] !== ANY_TYPE$1) {
            const m = node.inputs[i]?.name?.match(/input_(\d+)/);
            const busIdx = m ? parseInt(m[1]) - 1 : i - 1;
            node.properties._bus_slot_types[busIdx] = types[i];
          }
        }
        GetGraph(node)?.setDirtyCanvas?.(true, true);
        UpdateNodeSize(node);
        const busOutLinks = node.outputs?.[0]?.links;
        if (busOutLinks && busOutLinks.length > 0) {
          for (const linkId of busOutLinks) {
            const link = GetLink(node, linkId);
            if (link) {
              const targetNode = GetNodeById(node, link.target_id);
              if (targetNode && targetNode.onBusChanged) {
                DeferMicrotask(() => {
                  targetNode.onBusChanged();
                });
              }
            }
          }
        }
      }
      nodeType.prototype.onBusChanged = function() {
        normalizeIO(this);
        applyBusDynamicTypes(this);
      };
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        const node = this;
        const LG_INPUT2 = getLgInput();
        const LG_OUTPUT2 = getLgOutput();
        if (type === LG_INPUT2 && isConnected && index > 0) {
          try {
            const link = link_info ?? GetInputLink(node, index);
            if (link) {
              const sourceNode = GetNodeById(node, link.origin_id);
              const sourceSlot = sourceNode?.outputs?.[link.origin_slot];
              const inferredType = sourceSlot?.type && sourceSlot.type !== ANY_TYPE$1 && sourceSlot.type !== -1 ? sourceSlot.type : GetLinkTypeFromEndpoints(node, link);
              if (inferredType !== ANY_TYPE$1) {
                const n = inferredType.toLowerCase();
                if (node.inputs[index]) {
                  node.inputs[index].type = inferredType;
                  node.inputs[index].label = n;
                }
                if (node.outputs[index]) {
                  node.outputs[index].type = inferredType;
                  node.outputs[index].label = n;
                }
                const linkId = link_info?.id ?? node.inputs?.[index]?.link;
                const linkObj = GetLink(node, linkId);
                if (linkObj) linkObj.type = inferredType;
              }
            }
          } catch {
          }
        }
        if (type === LG_OUTPUT2 && isConnected && index > 0) {
          try {
            const linkId = link_info?.id;
            const link = link_info ?? (linkId != null ? GetLink(node, linkId) : null);
            if (link) {
              const targetNode = GetNodeById(node, link.target_id);
              const targetSlot = targetNode?.inputs?.[link.target_slot];
              const inferredType = targetSlot?.type && targetSlot.type !== ANY_TYPE$1 && targetSlot.type !== -1 ? targetSlot.type : GetLinkTypeFromEndpoints(node, link);
              if (inferredType !== ANY_TYPE$1) {
                const n = inferredType.toLowerCase();
                if (node.outputs[index]) {
                  node.outputs[index].type = inferredType;
                  node.outputs[index].label = n;
                }
                if (node.inputs[index]) {
                  node.inputs[index].type = inferredType;
                  node.inputs[index].label = n;
                }
                const linkObj = GetLink(node, linkId);
                if (linkObj) linkObj.type = inferredType;
              }
            }
          } catch {
          }
        }
        if (!isConnected && index > 0) {
          const isInput = type === LG_INPUT2;
          DeferMicrotask(() => {
            const slotStillConnected = isInput ? node.inputs?.[index]?.link != null : (node.outputs?.[index]?.links?.length ?? 0) > 0;
            if (slotStillConnected) {
              normalizeIO(node);
              applyBusDynamicTypes(node);
              return;
            }
            const pairConnected = isInput ? (node.outputs?.[index]?.links?.length ?? 0) > 0 : node.inputs?.[index]?.link != null;
            const maxLen = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
            let hasConnectionsAfter = false;
            for (let i = index + 1; i < maxLen; i++) {
              if (node.inputs?.[i]?.link != null || (node.outputs?.[i]?.links?.length ?? 0) > 0) {
                hasConnectionsAfter = true;
                break;
              }
            }
            if (hasConnectionsAfter && !pairConnected) {
              if (typeof node.removeInput === "function") node.removeInput(index);
              if (typeof node.removeOutput === "function") node.removeOutput(index);
            }
            normalizeIO(node);
            applyBusDynamicTypes(node);
          });
          return;
        }
        DeferMicrotask(() => {
          normalizeIO(node);
          applyBusDynamicTypes(node);
        });
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        this.__tojioo_dynamic_io_size_fixed = false;
        DeferMicrotask(() => {
          try {
            normalizeIO(this);
            applyBusDynamicTypes(this);
          } catch (e) {
            console.error("Tojioo.DynamicBus: error in configure", e);
          }
        });
        setTimeout(() => {
          try {
            this.__tojioo_dynamic_io_size_fixed = false;
            normalizeIO(this);
            applyBusDynamicTypes(this);
          } catch {
          }
        }, 100);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        this.__tojioo_dynamic_io_size_fixed = false;
        DeferMicrotask(() => {
          try {
            normalizeIO(this);
            applyBusDynamicTypes(this);
          } catch (e) {
            console.error("Tojioo.DynamicBus: error in onAdded", e);
          }
        });
      };
    }
  };
}
function configureDynamicPassthrough() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicPassthrough",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (nodeData?.name !== "PT_DynamicPassthrough") {
        return;
      }
      function normalizeIO(node) {
        if (!node.inputs) node.inputs = [];
        if (!node.outputs) node.outputs = [];
        let lastConnectedInput = -1;
        for (let i = node.inputs.length - 1; i >= 0; i--) {
          if (node.inputs[i]?.link != null) {
            lastConnectedInput = i;
            break;
          }
        }
        let lastConnectedOutput = -1;
        for (let i = node.outputs.length - 1; i >= 0; i--) {
          const links = node.outputs[i]?.links;
          if (links && links.length > 0) {
            lastConnectedOutput = i;
            break;
          }
        }
        const lastConnected = Math.max(lastConnectedInput, lastConnectedOutput);
        const desiredCount = Math.min(MAX_SOCKETS, Math.max(1, lastConnected + 2));
        while (node.inputs.length > desiredCount && typeof node.removeInput === "function") {
          node.removeInput(node.inputs.length - 1);
        }
        while (node.outputs.length > desiredCount && typeof node.removeOutput === "function") {
          node.removeOutput(node.outputs.length - 1);
        }
        while (node.inputs.length < desiredCount && typeof node.addInput === "function") {
          node.addInput("input", ANY_TYPE$1);
          node.inputs[node.inputs.length - 1].label = "input";
        }
        while (node.outputs.length < desiredCount && typeof node.addOutput === "function") {
          node.addOutput("output", ANY_TYPE$1);
          node.outputs[node.outputs.length - 1].label = "output";
        }
        UpdateNodeSize(node, node.__tojioo_dynamic_io_size_fixed || false);
        node.__tojioo_dynamic_io_size_fixed = true;
      }
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        const node = this;
        if (type === getLgInput() && isConnected) {
          try {
            const g = GetGraph(node);
            const linkId = link_info?.id ?? node.inputs?.[index]?.link;
            const linkObj = link_info ?? GetLink(node, linkId);
            const inferredType = GetLinkTypeFromEndpoints(node, linkObj);
            if (linkId != null && g?.links?.[linkId] && inferredType && inferredType !== ANY_TYPE$1) {
              g.links[linkId].type = inferredType;
              if (node.outputs?.[index]) {
                node.outputs[index].type = inferredType;
                const n = inferredType.toLowerCase();
                node.outputs[index].name = `output_${index + 1}`;
                node.outputs[index].label = n;
                if (node.inputs?.[index]) {
                  node.inputs[index].type = inferredType;
                  node.inputs[index].name = `input_${index + 1}`;
                  node.inputs[index].label = n;
                }
              }
            }
          } catch (e) {
            console.error(e);
          }
          DeferMicrotask(() => {
            normalizeIO(this);
            ApplyDynamicTypes(this);
          });
          return;
        }
        if (!isConnected) {
          const disconnectedIndex = index;
          DeferMicrotask(() => {
            if (!node.inputs || node.inputs.length === 0) {
              return;
            }
            if (disconnectedIndex < 0 || disconnectedIndex >= node.inputs.length) {
              return;
            }
            if (node.inputs[disconnectedIndex]?.link != null) {
              normalizeIO(this);
              ApplyDynamicTypes(this);
              return;
            }
            let hasConnectionsAfter = false;
            for (let i = disconnectedIndex + 1; i < Math.max(node.inputs.length, node.outputs.length); i++) {
              if (node.inputs?.[i]?.link != null || (node.outputs?.[i]?.links?.length ?? 0) > 0) {
                hasConnectionsAfter = true;
                break;
              }
            }
            if (hasConnectionsAfter) {
              if (typeof node.removeInput === "function") node.removeInput(disconnectedIndex);
              if (typeof node.removeOutput === "function") node.removeOutput(disconnectedIndex);
            }
            normalizeIO(this);
            ApplyDynamicTypes(this);
          });
          return;
        }
        DeferMicrotask(() => {
          normalizeIO(node);
          ApplyDynamicTypes(node);
        });
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        this.__tojioo_dynamic_io_size_fixed = false;
        DeferMicrotask(() => {
          try {
            normalizeIO(this);
            ApplyDynamicTypes(this);
          } catch (e) {
            console.error("Tojioo.DynamicPassthrough: error in configure", e);
          }
        });
        setTimeout(() => {
          try {
            this.__tojioo_dynamic_io_size_fixed = false;
            normalizeIO(this);
            ApplyDynamicTypes(this);
          } catch {
          }
        }, 100);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        this.__tojioo_dynamic_io_size_fixed = false;
        DeferMicrotask(() => {
          try {
            normalizeIO(this);
            ApplyDynamicTypes(this);
          } catch (e) {
            console.error("Tojioo.DynamicPassthrough: error in onAdded", e);
          }
        });
      };
    }
  };
}
function configureDynamicPreview() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicPreview",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (nodeData?.name !== "PT_DynamicPreview") {
        return;
      }
      nodeType.prototype._currentImageIndex = 0;
      nodeType.prototype._imageElements = [];
      nodeType.prototype._totalImages = 0;
      nodeType.prototype._tabHitAreas = [];
      function normalizeInputs2(node) {
        if (!node.inputs) node.inputs = [];
        if (!node.__tojioo_dynamic_io_rebuilt) {
          node.__tojioo_dynamic_io_rebuilt = true;
          const hasAnyLinks = node.inputs?.some((i) => i?.link != null);
          if (!hasAnyLinks && typeof node.removeInput === "function") {
            while (node.inputs.length) {
              node.removeInput(node.inputs.length - 1);
            }
          }
        }
        let lastConnectedIndex = -1;
        for (let i = node.inputs.length - 1; i >= 0; i--) {
          if (node.inputs[i]?.link != null) {
            lastConnectedIndex = i;
            break;
          }
        }
        const desiredCount = Math.min(MAX_SOCKETS, Math.max(1, lastConnectedIndex + 2));
        while (node.inputs.length > desiredCount && typeof node.removeInput === "function") {
          node.removeInput(node.inputs.length - 1);
        }
        while (node.inputs.length < desiredCount && typeof node.addInput === "function") {
          node.addInput("image", ANY_TYPE$1);
          node.inputs[node.inputs.length - 1].label = "image";
        }
        UpdatePreviewNodeSize(node);
      }
      function applyDynamicTypes(node) {
        if (!node.inputs?.length) return;
        const types = [];
        const typeCounters = {};
        for (let i = 0; i < node.inputs.length; i++) {
          const link = GetInputLink(node, i);
          let resolvedType = ANY_TYPE$1;
          if (link) {
            const t = GetLinkTypeFromEndpoints(node, link);
            if (t !== ANY_TYPE$1) resolvedType = t;
          }
          types.push(resolvedType);
        }
        for (let i = 0; i < node.inputs.length; i++) {
          const inp = node.inputs[i];
          const t = types[i];
          const isTyped = t !== ANY_TYPE$1;
          inp.type = t;
          let label;
          if (isTyped) {
            const baseLabel = t.toLowerCase();
            typeCounters[t] = (typeCounters[t] ?? 0) + 1;
            label = typeCounters[t] === 1 ? baseLabel : `${baseLabel}_${typeCounters[t]}`;
          } else {
            typeCounters["__untyped__"] = (typeCounters["__untyped__"] ?? 0) + 1;
            const n = typeCounters["__untyped__"];
            label = n === 1 ? "image" : `image_${n}`;
          }
          inp.name = `input_${i + 1}`;
          inp.label = label;
        }
        GetGraph(node)?.setDirtyCanvas?.(true, true);
      }
      function measureTabWidths(ctx, count) {
        ctx.font = "12px Arial";
        const widths = [];
        for (let i = 1; i <= count; i++) {
          widths.push(ctx.measureText(String(i)).width + TAB_PADDING * 2);
        }
        return widths;
      }
      nodeType.prototype.selectImage = function(index) {
        if (index < 0 || index >= this._totalImages) return;
        this._currentImageIndex = index;
        this.graph?.setDirtyCanvas?.(true, true);
      };
      const prevOnDrawForeground = nodeType.prototype.onDrawForeground;
      nodeType.prototype.onDrawForeground = function(ctx, canvas, canvasElement) {
        prevOnDrawForeground?.call(this, ctx, canvas, canvasElement);
        if (!ctx || isNodes2Mode()) return;
        const node = this;
        if (!node._imageElements?.length || node._totalImages === 0) return;
        const imgs = node._imageElements;
        const idx = Math.min(node._currentImageIndex, imgs.length - 1);
        const img = imgs[idx];
        if (!img?.complete || img.naturalWidth === 0) return;
        const slotHeight = getLgSlotHeight();
        const inputsHeight = (node.inputs?.length || 1) * slotHeight + 10;
        const showTabs = node._totalImages >= 2;
        const tabBarHeight = showTabs ? TAB_BAR_HEIGHT : 0;
        const previewY = inputsHeight + tabBarHeight;
        const previewHeight = node.size[1] - previewY;
        const previewWidth = node.size[0];
        if (previewHeight < 50) return;
        const scale = Math.min(previewWidth / img.width, previewHeight / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const drawX = (previewWidth - drawWidth) / 2;
        const drawY = previewY + (previewHeight - drawHeight) / 2;
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        if (showTabs) {
          const tabY = inputsHeight;
          const tabWidths = measureTabWidths(ctx, node._totalImages);
          const totalTabWidth = tabWidths.reduce((a, b) => a + b, 0) + TAB_GAP * (node._totalImages - 1);
          let tabX = (node.size[0] - totalTabWidth) / 2;
          node._tabHitAreas = [];
          for (let i = 0; i < node._totalImages; i++) {
            const tabWidth = tabWidths[i];
            const isSelected = i === node._currentImageIndex;
            ctx.fillStyle = isSelected ? "rgba(80, 120, 200, 0.9)" : "rgba(60, 60, 60, 0.8)";
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(tabX, tabY + 2, tabWidth, TAB_BAR_HEIGHT - 4, 4);
            } else {
              ctx.rect(tabX, tabY + 2, tabWidth, TAB_BAR_HEIGHT - 4);
            }
            ctx.fill();
            ctx.fillStyle = isSelected ? "#fff" : "#aaa";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(i + 1), tabX + tabWidth / 2, tabY + TAB_BAR_HEIGHT / 2);
            node._tabHitAreas.push({ x: tabX, y: tabY, width: tabWidth, height: TAB_BAR_HEIGHT, index: i });
            tabX += tabWidth + TAB_GAP;
          }
        }
      };
      const prevOnMouseDown = nodeType.prototype.onMouseDown;
      nodeType.prototype.onMouseDown = function(e, pos, canvas) {
        if (this._tabHitAreas?.length) {
          for (const area of this._tabHitAreas) {
            if (pos[0] >= area.x && pos[0] <= area.x + area.width && pos[1] >= area.y && pos[1] <= area.y + area.height) {
              this.selectImage(area.index);
              return true;
            }
          }
        }
        return prevOnMouseDown?.call(this, e, pos, canvas) ?? false;
      };
      const prevOnExecuted = nodeType.prototype.onExecuted;
      nodeType.prototype.onExecuted = function(message) {
        prevOnExecuted?.call(this, message);
        const node = this;
        node.imgs = null;
        const images = message?.preview_data;
        if (!images?.length) {
          node._imageElements = [];
          node._totalImages = 0;
          node._currentImageIndex = 0;
          node._tabHitAreas = [];
          return;
        }
        node._totalImages = images.length;
        node._currentImageIndex = Math.min(node._currentImageIndex, node._totalImages - 1);
        node._imageElements = images.map((imgInfo) => {
          const img = new Image();
          img.src = `/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(
            imgInfo.subfolder || ""
          )}&type=${encodeURIComponent(imgInfo.type || "output")}`;
          return img;
        });
        this.graph?.setDirtyCanvas?.(true, true);
      };
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) return;
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (type !== getLgInput()) return;
        const node = this;
        if (isConnected) {
          try {
            const link = link_info ?? GetInputLink(node, index);
            if (link) {
              const inferredType = GetLinkTypeFromEndpoints(node, link);
              const linkId = link_info?.id ?? node.inputs?.[index]?.link;
              const linkObj = GetLink(node, linkId);
              if (linkObj && inferredType !== ANY_TYPE$1) {
                linkObj.type = inferredType;
                if (node.inputs[index]) {
                  node.inputs[index].type = inferredType;
                  const n = inferredType.toLowerCase();
                  node.inputs[index].name = n;
                  node.inputs[index].label = n;
                }
              }
            }
          } catch {
          }
          DeferMicrotask(() => {
            normalizeInputs2(node);
            applyDynamicTypes(node);
          });
          return;
        }
        DeferMicrotask(() => {
          if (!node.inputs?.length || index < 0 || index >= node.inputs.length) return;
          if (node.inputs[index]?.link != null) {
            normalizeInputs2(node);
            applyDynamicTypes(node);
            return;
          }
          const hasConnectionsAfter = node.inputs.slice(index + 1).some((i) => i?.link != null);
          if (hasConnectionsAfter && typeof node.removeInput === "function") {
            node.removeInput(index);
          }
          const hasAny = node.inputs?.some((inp) => inp?.link != null);
          if (!hasAny) {
            node._currentImageIndex = 0;
            node._imageElements = [];
            node._totalImages = 0;
            node._tabHitAreas = [];
          }
          normalizeInputs2(node);
          applyDynamicTypes(node);
        });
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        const loading = IsGraphLoading();
        DeferMicrotask(() => {
          if (loading) this.__tojioo_skip_resize = true;
          try {
            normalizeInputs2(this);
            applyDynamicTypes(this);
          } catch (e) {
            console.error("Tojioo.DynamicPreview: error in configure", e);
          } finally {
            this.__tojioo_skip_resize = false;
          }
        });
        setTimeout(() => {
          try {
            normalizeInputs2(this);
            applyDynamicTypes(this);
          } catch {
          }
        }, 100);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        if (this.widgets) {
          const imgWidgetIndex = this.widgets.findIndex((w) => w.name === "image" || w.type === "preview");
          if (imgWidgetIndex !== -1) this.widgets.splice(imgWidgetIndex, 1);
        }
        this.imgs = null;
        const loading = IsGraphLoading();
        DeferMicrotask(() => {
          if (loading) this.__tojioo_skip_resize = true;
          try {
            normalizeInputs2(this);
            applyDynamicTypes(this);
          } catch (e) {
            console.error("Tojioo.DynamicPreview: error in onAdded", e);
          } finally {
            this.__tojioo_skip_resize = false;
          }
        });
      };
    }
  };
}
function configureDynamicAny() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicAny",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (nodeData?.name !== "PT_DynamicAny") {
        return;
      }
      function applyType(node) {
        const t = ResolveConnectedType(node, node.inputs?.[0], node.outputs?.[0]);
        const isTyped = t !== ANY_TYPE$1;
        const slotType = isTyped ? t : ANY_TYPE$1;
        const slotName = isTyped ? t.toLowerCase() : "input";
        if (node.inputs?.[0]) {
          node.inputs[0].type = slotType;
          node.inputs[0].name = slotName;
          node.inputs[0].label = slotName;
        }
        if (node.outputs?.[0]) {
          node.outputs[0].type = slotType;
          const n = isTyped ? t.toLowerCase() : "output";
          node.outputs[0].name = n;
          node.outputs[0].label = n;
        }
        const inLink = GetInputLink(node, 0);
        if (inLink && slotType !== ANY_TYPE$1) {
          inLink.type = slotType;
        }
        for (const linkId of node.outputs?.[0]?.links ?? []) {
          const link = GetLink(node, linkId);
          if (link && slotType !== ANY_TYPE$1) {
            link.type = slotType;
          }
        }
        GetGraph(node)?.setDirtyCanvas?.(true, true);
      }
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        DeferMicrotask(() => applyType(this));
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        const loading = IsGraphLoading();
        DeferMicrotask(() => {
          if (loading) this.__tojioo_skip_resize = true;
          try {
            applyType(this);
          } catch (e) {
            console.error("Tojioo.DynamicAny: error in configure", e);
          } finally {
            this.__tojioo_skip_resize = false;
          }
        });
        setTimeout(() => {
          try {
            applyType(this);
          } catch {
          }
        }, 100);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        const loading = IsGraphLoading();
        DeferMicrotask(() => {
          if (loading) this.__tojioo_skip_resize = true;
          try {
            applyType(this);
          } catch (e) {
            console.error("Tojioo.DynamicAny: error in onAdded", e);
          } finally {
            this.__tojioo_skip_resize = false;
          }
        });
      };
    }
  };
}
function isSwitch(nodeData) {
  const n = nodeData?.name ?? "";
  return n.startsWith("PT_Any") && n.endsWith("Switch") && !n.endsWith("BatchSwitch");
}
function configureSwitchNodes() {
  return {
    name: "Tojioo.Passthrough.Dynamic.SwitchNodes",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (!isSwitch(nodeData)) {
        return;
      }
      const inputPrefix = deriveDynamicPrefixFromNodeData(nodeData);
      if (!inputPrefix) {
        return;
      }
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (!link_info || type !== getLgInput()) {
          return;
        }
        const node = this;
        if (!isConnected) {
          DeferMicrotask(() => {
            if (!node.inputs?.length || index < 0 || index >= node.inputs.length) {
              normalizeInputs(node);
              applySwitchDynamicTypes(node, inputPrefix);
              return;
            }
            if (node.inputs[index]?.link != null) {
              normalizeInputs(node);
              applySwitchDynamicTypes(node, inputPrefix);
              return;
            }
            const hasConnectionsAfter = node.inputs.slice(index + 1).some((i) => i?.link != null);
            if (hasConnectionsAfter && typeof node.removeInput === "function") {
              node.removeInput(index);
            }
            normalizeInputs(node);
            applySwitchDynamicTypes(node, inputPrefix);
          });
          return;
        }
        normalizeInputs(node);
        applySwitchDynamicTypes(node, inputPrefix);
        const lastIndex = node.inputs.length - 1;
        if (index === lastIndex && node.inputs[lastIndex]?.link != null && typeof node.addInput === "function") {
          const resolvedType = resolveInputType(node, lastIndex);
          const socketType = resolvedType !== ANY_TYPE$1 ? resolvedType : node.inputs[0]?.type ?? ANY_TYPE$1;
          node.addInput(`${inputPrefix}_${node.inputs.length + 1}`, socketType);
          normalizeInputs(node);
          applySwitchDynamicTypes(node, inputPrefix);
        }
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        if (!this.inputs?.length) {
          return;
        }
        normalizeInputs(this);
        applySwitchDynamicTypes(this, inputPrefix);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        normalizeInputs(this);
        applySwitchDynamicTypes(this, inputPrefix);
      };
    }
  };
}
app.registerExtension({
  name: "Tojioo.Passthrough.Core",
  async setup() {
    InstallGraphLoadingHook(app);
    RegisterSlotMenuEntries("BUS", ["PT_DynamicBus"]);
  }
});
app.registerExtension(configureBatchSwitchNodes());
app.registerExtension(configureDynamicBus());
app.registerExtension(configureDynamicPassthrough());
app.registerExtension(configureDynamicPreview());
app.registerExtension(configureDynamicAny());
app.registerExtension(configureSwitchNodes());
