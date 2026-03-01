import { app } from "../../scripts/app.js";
const LG_OUTPUT = 2;
const LG_INPUT = 1;
function getLiteGraph() {
  if (typeof LiteGraph !== "undefined") {
    return LiteGraph;
  }
  if (typeof window !== "undefined" && window.LiteGraph) {
    return window.LiteGraph;
  }
  return null;
}
function GetLgInput() {
  const lg = getLiteGraph();
  return lg?.INPUT ?? LG_INPUT;
}
function GetLgOutput() {
  const lg = getLiteGraph();
  return lg?.OUTPUT ?? LG_OUTPUT;
}
function IsNodes2Mode() {
  try {
    const app2 = window.app;
    if (app2?.extensionManager?.setting?.get) {
      const nodes2 = app2.extensionManager.setting.get("Comfy.NodeDesign.Modern");
      if (nodes2 === true) {
        return true;
      }
    }
  } catch {
  }
  return false;
}
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
    return ANY_TYPE$1;
  }
  const origin = GetNodeById(node, link.origin_id);
  const oSlot = origin?.outputs?.[link.origin_slot];
  if (oSlot?.type && oSlot.type !== ANY_TYPE$1 && oSlot.type !== -1) {
    return oSlot.type;
  }
  const target = GetNodeById(node, link.target_id);
  const tSlot = target?.inputs?.[link.target_slot];
  if (tSlot?.type && tSlot.type !== ANY_TYPE$1 && tSlot.type !== -1) {
    return tSlot.type;
  }
  const linkType = link.type;
  if (linkType && linkType !== ANY_TYPE$1 && linkType !== -1) {
    return linkType;
  }
  return ANY_TYPE$1;
}
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
function DeriveDynamicPrefixFromNodeData(nodeData) {
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
function ResolveInputType(node, inputIndex) {
  const inp = node.inputs?.[inputIndex];
  if (!inp) {
    return ANY_TYPE$1;
  }
  const linkId = inp.link;
  if (linkId == null) {
    return ANY_TYPE$1;
  }
  const g = GetGraph(node);
  const link = g?.links?.[linkId];
  if (!link) {
    return ANY_TYPE$1;
  }
  const inferredType = GetLinkTypeFromEndpoints(node, link);
  if (inferredType && inferredType !== ANY_TYPE$1) {
    return inferredType;
  }
  const sourceNode = g?.getNodeById?.(link.origin_id);
  const sourceSlot = sourceNode?.outputs?.[link.origin_slot];
  if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE$1 && sourceSlot.type !== -1) {
    return sourceSlot.type;
  }
  return ANY_TYPE$1;
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
function ApplySwitchDynamicTypes(node, inputPrefix) {
  if (!node.inputs || node.inputs.length === 0) {
    return;
  }
  let resolvedType = ANY_TYPE$1;
  const inputTypes = [];
  for (let i = 0; i < node.inputs.length; i++) {
    const t = ResolveInputType(node, i);
    inputTypes.push(t);
    if (t && t !== ANY_TYPE$1 && resolvedType === ANY_TYPE$1) {
      resolvedType = t;
    }
  }
  for (let i = 0; i < node.inputs.length; i++) {
    const inp = node.inputs[i];
    const currentType = inputTypes[i];
    const effectiveType = currentType !== ANY_TYPE$1 ? currentType : resolvedType;
    inp.type = effectiveType;
    const label = effectiveType !== ANY_TYPE$1 ? i === 0 ? effectiveType.toLowerCase() : `${effectiveType.toLowerCase()}_${i + 1}` : i === 0 ? `${inputPrefix}` : `${inputPrefix}_${i + 1}`;
    inp.name = `input_${i + 1}`;
    inp.label = label;
    const linkId = inp.link;
    if (linkId != null && effectiveType !== ANY_TYPE$1) {
      SetLinkType(node, linkId, effectiveType);
    }
  }
  if (node.outputs && node.outputs.length > 0) {
    for (let i = 0; i < node.outputs.length; i++) {
      const out = node.outputs[i];
      out.type = resolvedType;
      if (resolvedType !== ANY_TYPE$1) {
        out.name = "output_1";
        out.label = resolvedType.toLowerCase();
      }
      const outLinks = out.links ?? [];
      for (const linkId of outLinks) {
        if (linkId != null && resolvedType !== ANY_TYPE$1) {
          SetLinkType(node, linkId, resolvedType);
        }
      }
    }
  }
  ScheduleCanvasUpdate(node);
  ScheduleSizeUpdate(node);
}
function UpdateNodeSize(node, expandOnly, force) {
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
function NormalizeInputs(node) {
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
const _displayNameReverseMap = /* @__PURE__ */ new Map();
let _createNodePatched = false;
let _pollingStarted = false;
let _pendingConnection = null;
function consumePendingConnection() {
  const pending = _pendingConnection;
  _pendingConnection = null;
  return pending;
}
function connectPending(node, pending, slotFilter) {
  if (!pending?.sourceNode || !node.inputs?.length) {
    return;
  }
  const links = node.graph?.links;
  if (links) {
    for (const inp of node.inputs) {
      if (inp?.link == null) {
        continue;
      }
      const lnk = links[inp.link];
      if (lnk?.origin_id === pending.sourceNode.id && lnk?.origin_slot === pending.sourceSlot) {
        return;
      }
    }
  }
  const type = pending.type;
  for (let i = 0; i < node.inputs.length; i++) {
    if (slotFilter && !slotFilter(i, type)) {
      continue;
    }
    if (node.inputs[i]?.link == null) {
      pending.sourceNode.connect(pending.sourceSlot, node, i);
      return;
    }
  }
}
function startConnectionPolling() {
  if (_pollingStarted) {
    return;
  }
  _pollingStarted = true;
  function poll() {
    const canvas = window.app?.canvas;
    const links = canvas?.connecting_links;
    if (links?.length) {
      const link = links[0];
      _pendingConnection = {
        sourceNode: link.node,
        sourceSlot: link.slot ?? link.output?.slot_index ?? 0,
        type: link.output?.type ?? link.type ?? "*"
      };
    }
    requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);
}
function configureSlotMenu(types, entriesOrNodeType, displayName) {
  const typeList = Array.isArray(types) ? types : [types];
  if (typeof entriesOrNodeType === "string") {
    registerSlotEntries(typeList, entriesOrNodeType);
    registerDisplayName(entriesOrNodeType, displayName);
    return;
  }
  const entryList = Array.isArray(entriesOrNodeType[0]) ? entriesOrNodeType : [entriesOrNodeType];
  for (const [nodeType, name] of entryList) {
    registerSlotEntries(typeList, nodeType);
    registerDisplayName(nodeType, name);
  }
}
function registerSlotEntries(types, nodeType) {
  const lg = getLiteGraph();
  if (!lg) {
    return;
  }
  lg.slot_types_default_out ??= {};
  lg.slot_types_default_in ??= {};
  for (const type of types) {
    for (const registry of [lg.slot_types_default_out, lg.slot_types_default_in]) {
      registry[type] ??= [];
      if (!registry[type].includes(nodeType)) {
        registry[type].push(nodeType);
      }
    }
  }
}
function registerDisplayName(nodeType, displayName) {
  const lg = getLiteGraph();
  if (!lg) {
    return;
  }
  _displayNameReverseMap.set(displayName, nodeType);
  for (const registry of [lg.slot_types_default_out, lg.slot_types_default_in]) {
    if (!registry) {
      continue;
    }
    for (const entries of Object.values(registry)) {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i] === nodeType) {
          entries[i] = displayName;
        }
      }
    }
  }
  if (_createNodePatched) {
    return;
  }
  _createNodePatched = true;
  startConnectionPolling();
  const originalCreateNode = lg.createNode;
  if (!originalCreateNode) {
    return;
  }
  lg.createNode = function(type, ...args) {
    const resolved = _displayNameReverseMap.get(type) ?? type;
    return originalCreateNode.call(this, resolved, ...args);
  };
}
const ANY_TYPE$1 = "*";
function ResolvePairType(node, zeroBasedIndex) {
  const out = node.outputs?.[zeroBasedIndex];
  const inp = node.inputs?.[zeroBasedIndex];
  const hasOutputLink = (out?.links?.length ?? 0) > 0;
  const hasInputLink = inp?.link != null;
  if (!hasOutputLink && !hasInputLink) {
    return ANY_TYPE$1;
  }
  const outLinkId = out?.links?.[0];
  const outLink = GetLink(node, outLinkId ?? null);
  if (outLink) {
    let outType = GetLinkTypeFromEndpoints(node, outLink);
    if (outType === ANY_TYPE$1) {
      const targetNode = GetNodeById(node, outLink.target_id);
      const targetSlot = targetNode?.inputs?.[outLink.target_slot];
      if (targetSlot?.type && targetSlot.type !== ANY_TYPE$1 && targetSlot.type !== -1) {
        outType = targetSlot.type;
      }
    }
    if (outType && outType !== ANY_TYPE$1) {
      return outType;
    }
  }
  const inLinkId = inp?.link;
  const inLink = GetLink(node, inLinkId ?? null);
  if (inLink) {
    let inType = GetLinkTypeFromEndpoints(node, inLink);
    if (inType === ANY_TYPE$1) {
      const sourceNode = GetNodeById(node, inLink.origin_id);
      const sourceSlot = sourceNode?.outputs?.[inLink.origin_slot];
      if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE$1 && sourceSlot.type !== -1) {
        inType = sourceSlot.type;
      }
    }
    if (inType && inType !== ANY_TYPE$1) {
      return inType;
    }
  }
  return ANY_TYPE$1;
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
  const isConcrete = (t) => t != null && t !== ANY_TYPE$1 && t !== -1;
  const hasInputLink = inp?.link != null;
  const hasOutputLink = (out?.links?.length ?? 0) > 0;
  if (!hasInputLink && !hasOutputLink) {
    return ANY_TYPE$1;
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
  return ANY_TYPE$1;
}
function ProcessTypeNames(types, i, typeCounters, inputNames, outputNames) {
  const t = types[i];
  const isTyped = t && t !== ANY_TYPE$1;
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
    if (currentType && currentType !== ANY_TYPE$1) {
      UpdateLinkTypesForSlot(node, i, currentType);
    }
  }
  const g = GetGraph(node);
  g?.setDirtyCanvas?.(true, true);
  node.type === "PT_DynamicPreview";
  UpdateNodeSize(node);
}
const ANY_TYPE = "*";
const BUS_TYPE = "BUS";
const MAX_SOCKETS = 32;
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
      const inputPrefix = DeriveDynamicPrefixFromNodeData(nodeData);
      if (!inputPrefix) {
        return;
      }
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (!link_info || type !== GetLgInput()) {
          return;
        }
        const node = this;
        if (!isConnected) {
          DeferMicrotask(() => {
            if (!node.inputs?.length || index < 0 || index >= node.inputs.length) {
              NormalizeInputs(node);
              ApplySwitchDynamicTypes(node, inputPrefix);
              return;
            }
            if (node.inputs[index]?.link != null) {
              NormalizeInputs(node);
              ApplySwitchDynamicTypes(node, inputPrefix);
              return;
            }
            const hasConnectionsAfter = node.inputs.slice(index + 1).some((i) => i?.link != null);
            if (hasConnectionsAfter && typeof node.removeInput === "function") {
              node.removeInput(index);
            }
            NormalizeInputs(node);
            ApplySwitchDynamicTypes(node, inputPrefix);
          });
          return;
        }
        NormalizeInputs(node);
        ApplySwitchDynamicTypes(node, inputPrefix);
        const lastIndex = node.inputs.length - 1;
        if (index === lastIndex && node.inputs[lastIndex]?.link != null && typeof node.addInput === "function") {
          const resolvedType = ResolveInputType(node, lastIndex);
          const socketType = resolvedType !== ANY_TYPE ? resolvedType : node.inputs[0]?.type ?? ANY_TYPE;
          node.addInput(`${inputPrefix}_${node.inputs.length + 1}`, socketType);
          NormalizeInputs(node);
          ApplySwitchDynamicTypes(node, inputPrefix);
        }
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        if (!this.inputs?.length) {
          return;
        }
        NormalizeInputs(this);
        ApplySwitchDynamicTypes(this, inputPrefix);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        NormalizeInputs(this);
        ApplySwitchDynamicTypes(this, inputPrefix);
      };
    }
  };
}
const METHOD_STYLES = {
  log: { color: "#00d4ff", prefix: "[Tojioo Passthrough]" },
  info: { color: "#4a7fff", prefix: "ℹ [Tojioo Passthrough]" },
  warn: { color: "#e6a117", prefix: "⚠ [Tojioo Passthrough]" },
  error: { color: "#e05252", prefix: "✖ [Tojioo Passthrough]" },
  debug: { color: "#b07aff", prefix: "[Tojioo Passthrough]" }
};
const createLoggerMethod = (method, scope) => {
  const { color, prefix } = METHOD_STYLES[method];
  if (scope) {
    return (...args) => {
      console[method](
        `%c${prefix}%c ${scope}:%c`,
        `color: ${color}; font-weight: bold`,
        "color: yellow;",
        "color: inherit",
        ...args
      );
    };
  } else {
    return (...args) => {
      console[method](
        `%c${prefix}%c`,
        `color: ${color}; font-weight: bold`,
        "color: inherit",
        ...args
      );
    };
  }
};
const loggerInstance = (scope) => ({
  log: createLoggerMethod("log"),
  warn: createLoggerMethod("warn"),
  error: createLoggerMethod("error", scope),
  info: createLoggerMethod("info"),
  debug: createLoggerMethod("debug", scope)
});
const logger_internal = loggerInstance();
const log$3 = loggerInstance("DynamicAny");
function configureDynamicAny() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicAny",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (nodeData?.name !== "PT_DynamicAny") {
        return;
      }
      function applyType(node) {
        const t = ResolveConnectedType(node, node.inputs?.[0], node.outputs?.[0]);
        const isTyped = t !== ANY_TYPE;
        const slotType = isTyped ? t : ANY_TYPE;
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
        if (inLink && slotType !== ANY_TYPE) {
          inLink.type = slotType;
        }
        for (const linkId of node.outputs?.[0]?.links ?? []) {
          const link = GetLink(node, linkId);
          if (link && slotType !== ANY_TYPE) {
            link.type = slotType;
          }
        }
        GetGraph(node)?.setDirtyCanvas?.(true, true);
      }
      nodeType.prototype.onConnectInput = function(_targetSlot, _type, _output, _sourceNode, _sourceSlot) {
        return true;
      };
      const prevFindInputSlotByType = nodeType.prototype.findInputSlotByType;
      nodeType.prototype.findInputSlotByType = function(type, returnObj, preferFreeSlot, doNotUseOccupied) {
        if (this.inputs?.[0]?.link == null) {
          return returnObj ? this.inputs[0] : 0;
        }
        return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
      };
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
          if (loading) {
            this.__tojioo_skip_resize = true;
          }
          try {
            applyType(this);
          } catch (e) {
            log$3.error("error in configure", e);
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
        const pending = consumePendingConnection();
        const loading = IsGraphLoading();
        DeferMicrotask(() => {
          if (loading) {
            this.__tojioo_skip_resize = true;
          }
          try {
            applyType(this);
          } catch (e) {
            log$3.error("error in onAdded", e);
          } finally {
            this.__tojioo_skip_resize = false;
          }
          connectPending(this, pending);
        });
      };
    }
  };
}
const SETTING_IDS = {
  BUS_OVERWRITE: "Tojioo.DynamicBus.OverwriteMode"
};
const dynamicBusOverwrite = {
  id: SETTING_IDS.BUS_OVERWRITE,
  name: "Overwrite matching bus types",
  type: "boolean",
  defaultValue: false,
  tooltip: "When enabled, a local input whose type already exists on the upstream bus will replace the first matching entry instead of appending.",
  category: ["Tojioo Passthrough", "Dynamic Bus", "Overwrite matching types"],
  onChange: (newVal) => {
    const graph = app.rootGraph;
    if (!graph) {
      return;
    }
    const value = newVal ? "1" : "0";
    for (const node of graph._nodes ?? []) {
      if (node.type !== "PT_DynamicBus") {
        continue;
      }
      const widget = node.widgets?.find((w) => w.name === "_overwrite_mode");
      if (widget) {
        widget.value = value;
      }
    }
  }
};
function getBusOverwriteMode() {
  return app.extensionManager?.setting?.get(SETTING_IDS.BUS_OVERWRITE) ?? false;
}
const log$2 = loggerInstance("DynamicBus");
function configureDynamicBus() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicBus",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (nodeData.name !== "PT_DynamicBus") {
        return;
      }
      function getUpstreamBusTypes(node) {
        const busInput = node.inputs?.[0];
        if (!busInput || busInput.link == null) {
          return {};
        }
        const link = GetInputLink(node, 0);
        if (!link) {
          busInput.link = null;
          return {};
        }
        const sourceNode = GetNodeById(node, link.origin_id);
        if (!sourceNode) {
          busInput.link = null;
          return {};
        }
        return sourceNode.properties?._busTypes ?? {};
      }
      function getSlotType(node, slotIdx) {
        const input = node.inputs?.[slotIdx];
        const output = node.outputs?.[slotIdx];
        if (input?.type && input.type !== ANY_TYPE && input.type !== -1) {
          return input.type;
        }
        if (output?.type && output.type !== ANY_TYPE && output.type !== -1) {
          return output.type;
        }
        return ANY_TYPE;
      }
      function generateLabels(types) {
        const sorted = Object.entries(types).map(([k, v]) => ({ idx: Number(k), type: v })).sort((a, b) => a.idx - b.idx);
        const counters = {};
        const labels = {};
        for (const entry of sorted) {
          const isTyped = entry.type !== ANY_TYPE;
          const base = isTyped ? entry.type.toLowerCase() : "value";
          const key = isTyped ? entry.type : "__any__";
          counters[key] = (counters[key] || 0) + 1;
          labels[entry.idx] = counters[key] === 1 ? base : `${base}_${counters[key]}`;
        }
        return labels;
      }
      function buildSlotTypes(node) {
        const types = [];
        for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++) {
          const input = node.inputs[slotIdx];
          if (input?.link != null) {
            const type = input.type && input.type !== ANY_TYPE && input.type !== -1 ? input.type : ANY_TYPE;
            types.push(`${slotIdx}:${type}`);
          }
        }
        return types.join(",");
      }
      function buildOutputHints(node) {
        const hints = [];
        for (let slotIdx = 1; slotIdx < node.outputs.length; slotIdx++) {
          const out = node.outputs[slotIdx];
          const hasOutputLink = (out?.links?.length ?? 0) > 0;
          if (!hasOutputLink) {
            continue;
          }
          const hasInputLink = node.inputs[slotIdx]?.link != null;
          let expectedType = ANY_TYPE;
          if (!hasInputLink) {
            const linkId = out.links[0];
            const link = GetLink(node, linkId);
            if (link) {
              const targetNode = GetNodeById(node, link.target_id);
              const targetSlot = targetNode?.inputs?.[link.target_slot];
              if (targetSlot?.type && targetSlot.type !== ANY_TYPE && targetSlot.type !== -1) {
                expectedType = targetSlot.type;
              }
            }
          } else {
            expectedType = getSlotType(node, slotIdx);
          }
          hints.push(`${slotIdx}:${expectedType}:${hasInputLink ? 1 : 0}`);
        }
        return hints.join(",");
      }
      function findOrCreateWidget(node, name) {
        if (!node.widgets) {
          node.widgets = [];
        }
        let widget = node.widgets.find((w) => w.name === name);
        if (!widget) {
          widget = {
            name,
            type: "hidden",
            value: "",
            options: { serialize: true },
            computeSize: () => [0, -4]
          };
          node.widgets.push(widget);
        } else {
          widget.type = "hidden";
          widget.computeSize = () => [0, -4];
        }
        return widget;
      }
      function resetNodeToCleanState(node) {
        for (let i = 1; i < node.inputs?.length; i++) {
          if (node.inputs[i]) {
            node.inputs[i].type = ANY_TYPE;
            node.inputs[i].label = "input";
          }
        }
        for (let i = 1; i < node.outputs?.length; i++) {
          if (node.outputs[i]) {
            node.outputs[i].type = ANY_TYPE;
            node.outputs[i].label = "output";
          }
        }
        while (node.inputs.length > 1) {
          node.removeInput(node.inputs.length - 1);
        }
        while (node.outputs.length > 1) {
          node.removeOutput(node.outputs.length - 1);
        }
        node.addInput?.("input", ANY_TYPE);
        node.inputs[1].name = "input_1";
        node.inputs[1].label = "input";
        node.inputs[1].type = ANY_TYPE;
        node.addOutput?.("output", ANY_TYPE);
        node.outputs[1].name = "output_1";
        node.outputs[1].label = "output";
        node.outputs[1].type = ANY_TYPE;
        const slotTypesWidget = node.widgets?.find((w) => w.name === "_slot_types");
        if (slotTypesWidget) {
          slotTypesWidget.value = "";
        }
        const outputHintsWidget = node.widgets?.find((w) => w.name === "_output_hints");
        if (outputHintsWidget) {
          outputHintsWidget.value = "";
        }
        if (node.properties) {
          node.properties._busTypes = {};
        }
      }
      function synchronize(node, serializedInfo) {
        if (node._syncing) {
          return;
        }
        node._syncing = true;
        try {
          if (!node.inputs) {
            node.inputs = [];
          }
          if (!node.outputs) {
            node.outputs = [];
          }
          const upstreamTypes = getUpstreamBusTypes(node);
          if (node.inputs.length === 0) {
            node.addInput?.("bus", BUS_TYPE);
          } else {
            node.inputs[0].name = "bus";
            node.inputs[0].label = "bus";
            node.inputs[0].type = BUS_TYPE;
          }
          if (node.inputs[0]?.link != null) {
            const busLink = GetInputLink(node, 0);
            if (!busLink || !GetNodeById(node, busLink.origin_id)) {
              node.inputs[0].link = null;
            }
          }
          if (node.outputs.length === 0) {
            node.addOutput?.("bus", BUS_TYPE);
          } else {
            node.outputs[0].name = "bus";
            node.outputs[0].label = "bus";
            node.outputs[0].type = BUS_TYPE;
          }
          let maxNeededSlot = 0;
          const maxLen = Math.max(
            node.inputs.length,
            node.outputs.length,
            serializedInfo?.inputs?.length ?? 0,
            serializedInfo?.outputs?.length ?? 0
          );
          for (let slotIdx = 1; slotIdx < maxLen; slotIdx++) {
            const hasInput = node.inputs[slotIdx]?.link != null;
            const hasOutput = (node.outputs[slotIdx]?.links?.length ?? 0) > 0;
            const hadSerializedInput = serializedInfo?.inputs?.[slotIdx]?.link != null;
            const hadSerializedOutput = (serializedInfo?.outputs?.[slotIdx]?.links?.length ?? 0) > 0;
            if (hasInput || hasOutput || hadSerializedInput || hadSerializedOutput) {
              maxNeededSlot = Math.max(maxNeededSlot, slotIdx);
            }
          }
          const targetCount = maxNeededSlot + 2;
          while (node.inputs.length > targetCount) {
            const lastIdx = node.inputs.length - 1;
            const hasLiveLink = node.inputs[lastIdx]?.link != null;
            const hasSerializedLink = serializedInfo?.inputs?.[lastIdx]?.link != null;
            if (hasLiveLink || hasSerializedLink) {
              break;
            }
            node.removeInput?.(lastIdx);
          }
          while (node.outputs.length > targetCount) {
            const lastIdx = node.outputs.length - 1;
            const hasLiveLinks = (node.outputs[lastIdx]?.links?.length ?? 0) > 0;
            const hasSerializedLinks = (serializedInfo?.outputs?.[lastIdx]?.links?.length ?? 0) > 0;
            if (hasLiveLinks || hasSerializedLinks) {
              break;
            }
            node.removeOutput?.(lastIdx);
          }
          while (node.inputs.length < targetCount) {
            const slotIdx = node.inputs.length;
            node.addInput?.("input", ANY_TYPE);
            node.inputs[slotIdx].name = `input_${slotIdx}`;
          }
          while (node.outputs.length < targetCount) {
            const slotIdx = node.outputs.length;
            node.addOutput?.("output", ANY_TYPE);
            node.outputs[slotIdx].name = `output_${slotIdx}`;
          }
          for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++) {
            if (node.inputs[slotIdx]?.link != null) {
              const link = GetInputLink(node, slotIdx);
              if (!link || !GetNodeById(node, link.origin_id)) {
                node.inputs[slotIdx].link = null;
              }
            }
          }
          for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++) {
            const hasInput = node.inputs[slotIdx]?.link != null;
            const outputLinkIds = node.outputs[slotIdx]?.links ?? [];
            const hasOutput = outputLinkIds.some((linkId) => GetLink(node, linkId) != null);
            if (!hasInput && !hasOutput) {
              if (node.inputs[slotIdx]) {
                node.inputs[slotIdx].type = ANY_TYPE;
              }
              if (node.outputs[slotIdx]) {
                node.outputs[slotIdx].type = ANY_TYPE;
              }
            }
          }
          if (!serializedInfo) {
            for (let slotIdx = node.inputs.length - 2; slotIdx >= 1; slotIdx--) {
              const hasInput = node.inputs[slotIdx]?.link != null;
              const outputLinkIds = node.outputs[slotIdx]?.links ?? [];
              const hasOutput = outputLinkIds.some((linkId) => {
                const link = GetLink(node, linkId);
                if (!link) {
                  return false;
                }
                const targetNode = GetNodeById(node, link.target_id);
                if (!targetNode) {
                  return false;
                }
                return targetNode.inputs?.[link.target_slot]?.link === linkId;
              });
              if (hasInput || hasOutput) {
                continue;
              }
              let hasConnectionsAfter = false;
              for (let i = slotIdx + 1; i < Math.max(node.inputs.length, node.outputs.length); i++) {
                const laterInput = node.inputs[i]?.link != null;
                const laterOutputIds = node.outputs[i]?.links ?? [];
                const laterOutput = laterOutputIds.some((id) => {
                  const link = GetLink(node, id);
                  if (!link) {
                    return false;
                  }
                  const target = GetNodeById(node, link.target_id);
                  if (!target) {
                    return false;
                  }
                  return target.inputs?.[link.target_slot]?.link === id;
                });
                if (laterInput || laterOutput) {
                  hasConnectionsAfter = true;
                  break;
                }
              }
              if (hasConnectionsAfter) {
                node.removeInput?.(slotIdx);
                node.removeOutput?.(slotIdx);
              }
            }
          }
          if (serializedInfo?.outputs) {
            for (let slotIdx = 1; slotIdx < node.outputs.length; slotIdx++) {
              const serializedOut = serializedInfo.outputs[slotIdx];
              if (serializedOut?.type && serializedOut.type !== ANY_TYPE && serializedOut.type !== -1) {
                if (node.outputs[slotIdx]) {
                  node.outputs[slotIdx].type = serializedOut.type;
                }
                if (node.inputs[slotIdx]) {
                  node.inputs[slotIdx].type = serializedOut.type;
                }
              }
            }
          }
          const slotTypes = {};
          for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++) {
            const type = getSlotType(node, slotIdx);
            if (type !== ANY_TYPE) {
              slotTypes[slotIdx] = type;
            }
          }
          const labels = generateLabels(slotTypes);
          for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++) {
            const type = slotTypes[slotIdx] || ANY_TYPE;
            if (node.inputs[slotIdx]) {
              node.inputs[slotIdx].name = `input_${slotIdx}`;
              node.inputs[slotIdx].label = labels[slotIdx] || "input";
              node.inputs[slotIdx].type = type;
            }
            if (node.outputs[slotIdx]) {
              node.outputs[slotIdx].name = `output_${slotIdx}`;
              node.outputs[slotIdx].label = labels[slotIdx] || "output";
              node.outputs[slotIdx].type = type;
            }
            const inLink = GetInputLink(node, slotIdx);
            if (inLink && type !== ANY_TYPE) {
              inLink.type = type;
            }
            for (const linkId of node.outputs[slotIdx]?.links ?? []) {
              const link = GetLink(node, linkId);
              if (link && type !== ANY_TYPE) {
                link.type = type;
              }
            }
          }
          if (!node.properties) {
            node.properties = {};
          }
          const isOverwriteEnabled = getBusOverwriteMode();
          log$2.debug("Overwrite is set to: ", isOverwriteEnabled);
          const combinedTypes = { ...upstreamTypes };
          let nextIdx = Math.max(-1, ...Object.keys(upstreamTypes).map(Number)) + 1;
          const usedUpstreamIndices = /* @__PURE__ */ new Set();
          for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++) {
            if (node.inputs[slotIdx]?.link == null) {
              continue;
            }
            const localType = slotTypes[slotIdx] || ANY_TYPE;
            if (isOverwriteEnabled && localType !== ANY_TYPE) {
              const matchIdx = Object.keys(combinedTypes).map(Number).sort((a, b) => a - b).find((idx) => !usedUpstreamIndices.has(idx) && combinedTypes[idx] === localType);
              if (matchIdx !== void 0) {
                usedUpstreamIndices.add(matchIdx);
                continue;
              }
            }
            combinedTypes[nextIdx] = localType;
            nextIdx++;
          }
          node.properties._busTypes = combinedTypes;
          const slotTypesWidget = findOrCreateWidget(node, "_slot_types");
          slotTypesWidget.value = buildSlotTypes(node);
          const outputHintsWidget = findOrCreateWidget(node, "_output_hints");
          outputHintsWidget.value = buildOutputHints(node);
          const overwriteWidget = findOrCreateWidget(node, "_overwrite_mode");
          overwriteWidget.value = isOverwriteEnabled ? "1" : "0";
          const busOutLinks = node.outputs?.[0]?.links;
          if (busOutLinks?.length) {
            for (const linkId of busOutLinks) {
              const link = GetLink(node, linkId);
              if (link) {
                const targetNode = GetNodeById(node, link.target_id);
                if (targetNode && targetNode.onBusChanged && !targetNode._busChangeScheduled) {
                  targetNode._busChangeScheduled = true;
                  DeferMicrotask(() => {
                    targetNode._busChangeScheduled = false;
                    targetNode.onBusChanged();
                  });
                }
              }
            }
          }
          GetGraph(node)?.setDirtyCanvas?.(true, true);
          UpdateNodeSize(node);
        } finally {
          node._syncing = false;
        }
      }
      nodeType.prototype.onBusChanged = function() {
        synchronize(this);
      };
      nodeType.prototype.onConnectInput = function(targetSlot, _type, _output, _sourceNode, _sourceSlot) {
        return !(targetSlot === 0 && String(_type) !== BUS_TYPE);
      };
      const prevFindInputSlotByType = nodeType.prototype.findInputSlotByType;
      nodeType.prototype.findInputSlotByType = function(type, returnObj, preferFreeSlot, doNotUseOccupied) {
        if (this.inputs) {
          if (String(type) === BUS_TYPE) {
            if (this.inputs[0]?.link == null) {
              return returnObj ? this.inputs[0] : 0;
            }
          } else {
            for (let i = 1; i < this.inputs.length; i++) {
              if (this.inputs[i]?.link == null) {
                return returnObj ? this.inputs[i] : i;
              }
            }
          }
        }
        return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
      };
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        const node = this;
        const LG_INPUT2 = GetLgInput();
        const LG_OUTPUT2 = GetLgOutput();
        if (isConnected && index > 0) {
          try {
            if (type === LG_INPUT2) {
              const link = link_info ?? GetInputLink(node, index);
              if (link) {
                const sourceNode = GetNodeById(node, link.origin_id);
                const sourceSlot = sourceNode?.outputs?.[link.origin_slot];
                if (sourceSlot?.type && sourceSlot.type !== ANY_TYPE && sourceSlot.type !== -1) {
                  if (node.inputs[index]) {
                    node.inputs[index].type = sourceSlot.type;
                  }
                  if (node.outputs[index]) {
                    node.outputs[index].type = sourceSlot.type;
                  }
                }
              }
            } else if (type === LG_OUTPUT2) {
              const linkId = link_info?.id;
              const link = link_info ?? (linkId != null ? GetLink(node, linkId) : null);
              if (link) {
                const targetNode = GetNodeById(node, link.target_id);
                const targetSlot = targetNode?.inputs?.[link.target_slot];
                if (targetSlot?.type && targetSlot.type !== ANY_TYPE && targetSlot.type !== -1) {
                  if (node.outputs[index]) {
                    node.outputs[index].type = targetSlot.type;
                  }
                  if (node.inputs[index]) {
                    node.inputs[index].type = targetSlot.type;
                  }
                }
              }
            }
          } catch {
          }
        }
        if (!isConnected && index > 0) {
          DeferMicrotask(() => synchronize(node));
          return;
        }
        DeferMicrotask(() => synchronize(node));
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        const node = this;
        for (let i = 0; i < (node.inputs?.length ?? 0); i++) {
          if (node.inputs[i]?.link != null) {
            const link = GetInputLink(node, i);
            if (!link || !GetNodeById(node, link.origin_id)) {
              node.inputs[i].link = null;
            }
          }
        }
        DeferMicrotask(() => {
          try {
            const hasTypedUnconnectedSlots = info.inputs?.slice(1).some((inp, idx) => {
              const slotIdx = idx + 1;
              const hasType = inp.type && inp.type !== ANY_TYPE && inp.type !== -1;
              const hasInputLink = inp.link != null;
              const hasOutputLink = (info.outputs?.[slotIdx]?.links?.length ?? 0) > 0;
              return hasType && !hasInputLink && !hasOutputLink;
            });
            if (hasTypedUnconnectedSlots) {
              resetNodeToCleanState(node);
              synchronize(node);
            } else {
              synchronize(node, info);
            }
          } catch (e) {
            log$2.error("error in configure", e);
          }
        });
        setTimeout(() => {
          try {
            synchronize(this, info);
            UpdateNodeSizeImmediate(this);
          } catch {
          }
        }, 100);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        const pending = consumePendingConnection();
        DeferMicrotask(() => {
          try {
            synchronize(this);
          } catch (e) {
            log$2.error("error in onAdded", e);
          }
          connectPending(this, pending, (i, type) => type === BUS_TYPE ? i === 0 : i > 0);
        });
      };
    }
  };
}
const log$1 = loggerInstance("DynamicPassthrough");
function configureDynamicPassthrough() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicPassthrough",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (nodeData?.name !== "PT_DynamicPassthrough") {
        return;
      }
      function normalizeIO(node) {
        if (!node.inputs) {
          node.inputs = [];
        }
        if (!node.outputs) {
          node.outputs = [];
        }
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
          node.addInput("input", ANY_TYPE);
          node.inputs[node.inputs.length - 1].label = "input";
        }
        while (node.outputs.length < desiredCount && typeof node.addOutput === "function") {
          node.addOutput("output", ANY_TYPE);
          node.outputs[node.outputs.length - 1].label = "output";
        }
        UpdateNodeSize(node, node.__tojioo_dynamic_io_size_fixed || false);
        node.__tojioo_dynamic_io_size_fixed = true;
      }
      nodeType.prototype.onConnectInput = function(_targetSlot, _type, _output, _sourceNode, _sourceSlot) {
        return true;
      };
      const prevFindInputSlotByType = nodeType.prototype.findInputSlotByType;
      nodeType.prototype.findInputSlotByType = function(type, returnObj, preferFreeSlot, doNotUseOccupied) {
        if (this.inputs) {
          for (let i = 0; i < this.inputs.length; i++) {
            if (this.inputs[i]?.link == null) {
              return returnObj ? this.inputs[i] : i;
            }
          }
        }
        return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
      };
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        const node = this;
        if (type === GetLgInput() && isConnected) {
          try {
            const g = GetGraph(node);
            const linkId = link_info?.id ?? node.inputs?.[index]?.link;
            const linkObj = link_info ?? GetLink(node, linkId);
            const inferredType = GetLinkTypeFromEndpoints(node, linkObj);
            if (linkId != null && g?.links?.[linkId] && inferredType && inferredType !== ANY_TYPE) {
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
            log$1.error(e);
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
              if (typeof node.removeInput === "function") {
                node.removeInput(disconnectedIndex);
              }
              if (typeof node.removeOutput === "function") {
                node.removeOutput(disconnectedIndex);
              }
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
            log$1.error("error in configure", e);
          }
        });
        setTimeout(() => {
          try {
            this.__tojioo_dynamic_io_size_fixed = false;
            normalizeIO(this);
            ApplyDynamicTypes(this);
            UpdateNodeSizeImmediate(this);
          } catch {
          }
        }, 100);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        const pending = consumePendingConnection();
        this.__tojioo_dynamic_io_size_fixed = false;
        DeferMicrotask(() => {
          try {
            normalizeIO(this);
            ApplyDynamicTypes(this);
          } catch (e) {
            log$1.error("error in onAdded", e);
          }
          connectPending(this, pending);
        });
      };
    }
  };
}
const defaultLabel = "input";
const log = loggerInstance("DynamicPreview");
function configureDynamicPreview() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicPreview",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (nodeData?.name !== "PT_DynamicPreview") {
        return;
      }
      nodeType.prototype._currentImageIndex = 0;
      nodeType.prototype._previewItems = [];
      nodeType.prototype._totalImages = 0;
      function normalizeInputs(node) {
        if (!node.inputs) {
          node.inputs = [];
        }
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
          node.addInput(defaultLabel, ANY_TYPE);
          node.inputs[node.inputs.length - 1].label = defaultLabel;
        }
        UpdatePreviewNodeSize(node);
      }
      function applyDynamicTypes(node) {
        if (!node.inputs?.length) {
          return;
        }
        const types = [];
        const typeCounters = {};
        for (let i = 0; i < node.inputs.length; i++) {
          const link = GetInputLink(node, i);
          let resolvedType = ANY_TYPE;
          if (link) {
            const t = GetLinkTypeFromEndpoints(node, link);
            if (t !== ANY_TYPE) {
              resolvedType = t;
            }
          }
          types.push(resolvedType);
        }
        for (let i = 0; i < node.inputs.length; i++) {
          const inp = node.inputs[i];
          const t = types[i];
          const isTyped = t !== ANY_TYPE;
          inp.type = t;
          let label;
          if (isTyped) {
            const baseLabel = t.toLowerCase();
            typeCounters[t] = (typeCounters[t] ?? 0) + 1;
            label = typeCounters[t] === 1 ? baseLabel : `${baseLabel}_${typeCounters[t]}`;
          } else {
            typeCounters["__untyped__"] = (typeCounters["__untyped__"] ?? 0) + 1;
            const n = typeCounters["__untyped__"];
            label = n === 1 ? defaultLabel : `${defaultLabel}_${n}`;
          }
          inp.name = `${defaultLabel}_${i + 1}`;
          inp.label = label;
        }
        GetGraph(node)?.setDirtyCanvas?.(true, true);
      }
      function createPreviewWidget(node) {
        if (node._previewContainer) {
          return;
        }
        const container = document.createElement("div");
        Object.assign(container.style, {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "transparent"
        });
        const tabBar = document.createElement("div");
        Object.assign(tabBar.style, {
          display: "none",
          flexDirection: "row",
          justifyContent: "center",
          gap: "4px",
          padding: "4px 8px 0 8px",
          marginBottom: "6px",
          flexShrink: "0",
          overflowX: "hidden",
          overflowY: "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.3) transparent"
        });
        const content = document.createElement("div");
        Object.assign(content.style, {
          flex: "1",
          overflow: "hidden",
          position: "relative",
          minHeight: "60px"
        });
        container.appendChild(tabBar);
        container.appendChild(content);
        node._previewContainer = container;
        node._previewTabBar = tabBar;
        node._previewContent = content;
        if (typeof node.addDOMWidget === "function") {
          node._previewWidget = node.addDOMWidget("preview_display", "customtext", container, {
            serialize: false
          });
        }
        new ResizeObserver(() => updateTabBarOverflow(node)).observe(tabBar);
      }
      function updateTabBarOverflow(node) {
        const tabBar = node._previewTabBar;
        if (!tabBar || tabBar.style.display === "none" || !tabBar.children.length) {
          return;
        }
        const gap = 4;
        let totalWidth = 0;
        for (let c = 0; c < tabBar.children.length; c++) {
          totalWidth += tabBar.children[c].offsetWidth;
        }
        totalWidth += gap * Math.max(0, tabBar.children.length - 1);
        const availableWidth = tabBar.clientWidth - 16;
        if (totalWidth > availableWidth) {
          tabBar.style.justifyContent = "flex-start";
          tabBar.style.overflowX = "scroll";
        } else {
          tabBar.style.justifyContent = "center";
          tabBar.style.overflowX = "hidden";
        }
      }
      function updatePreviewDisplay(node) {
        const content = node._previewContent;
        const tabBar = node._previewTabBar;
        if (!content || !tabBar) {
          return;
        }
        const items = node._previewItems ?? [];
        const total = node._totalImages ?? 0;
        if (!items.length || total === 0) {
          content.innerHTML = "";
          tabBar.style.display = "none";
          return;
        }
        if (total >= 2) {
          tabBar.style.display = "flex";
          tabBar.innerHTML = "";
          for (let i = 0; i < total; i++) {
            const tab = document.createElement("button");
            tab.textContent = String(i + 1);
            const selected = i === node._currentImageIndex;
            Object.assign(tab.style, {
              padding: "2px 10px",
              border: selected ? "1px solid rgba(80, 120, 200, 0.9)" : "1px solid transparent",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "Arial, sans-serif",
              background: selected ? "rgba(80, 120, 200, 0.9)" : "rgba(60, 60, 60, 0.8)",
              color: selected ? "#fff" : "#aaa",
              outline: "none",
              lineHeight: "1.4",
              flexShrink: "0"
            });
            const idx = i;
            tab.addEventListener("click", (e) => {
              e.stopPropagation();
              node._currentImageIndex = idx;
              updatePreviewDisplay(node);
            });
            tabBar.appendChild(tab);
          }
          if (!tabBar._hasWheelHandler) {
            tabBar.addEventListener("wheel", (e) => {
              if (tabBar.scrollWidth > tabBar.clientWidth) {
                e.preventDefault();
                e.stopPropagation();
                tabBar.scrollLeft += e.deltaY;
              }
            }, { passive: false });
            tabBar._hasWheelHandler = true;
          }
          requestAnimationFrame(() => updateTabBarOverflow(node));
        } else {
          tabBar.style.display = "none";
        }
        const itemIdx = Math.min(node._currentImageIndex, items.length - 1);
        const item = items[itemIdx];
        content.innerHTML = "";
        if (!item) {
          return;
        }
        if (item.type === "image") {
          Object.assign(content.style, {
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0"
          });
          const img = item.element.cloneNode(true);
          Object.assign(img.style, {
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain"
          });
          content.appendChild(img);
        } else if (item.type === "text") {
          Object.assign(content.style, {
            overflow: "hidden",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "stretch",
            padding: "0"
          });
          const textarea = document.createElement("textarea");
          textarea.readOnly = true;
          textarea.value = item.text;
          Object.assign(textarea.style, {
            width: "100%",
            height: "100%",
            resize: "none",
            boxSizing: "border-box"
          });
          textarea.classList.add("comfy-multiline-input");
          content.appendChild(textarea);
        }
      }
      function resetPreviewState(node) {
        node._currentImageIndex = 0;
        node._previewItems = [];
        node._totalImages = 0;
        updatePreviewDisplay(node);
      }
      nodeType.prototype.selectImage = function(index) {
        if (index < 0 || index >= this._totalImages) {
          return;
        }
        this._currentImageIndex = index;
        updatePreviewDisplay(this);
      };
      nodeType.prototype.onConnectInput = function(_targetSlot, _type, _output, _sourceNode, _sourceSlot) {
        logger_internal.debug(`${_sourceNode.properties["Node name for S&R"]} called onConnectInput with type ${_type}`);
        return true;
      };
      const prevFindInputSlotByType = nodeType.prototype.findInputSlotByType;
      nodeType.prototype.findInputSlotByType = function(type, returnObj, preferFreeSlot, doNotUseOccupied) {
        logger_internal.debug("findInputSlotByType called", type);
        if (this.inputs) {
          for (let i = 0; i < this.inputs.length; i++) {
            if (this.inputs[i]?.link == null) {
              return returnObj ? this.inputs[i] : i;
            }
          }
        }
        return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
      };
      const prevOnDrawForeground = nodeType.prototype.onDrawForeground;
      nodeType.prototype.onDrawForeground = function(ctx, canvas, canvasElement) {
        prevOnDrawForeground?.call(this, ctx, canvas, canvasElement);
        if (!ctx || IsNodes2Mode()) {
          return;
        }
      };
      const prevOnExecuted = nodeType.prototype.onExecuted;
      nodeType.prototype.onExecuted = function(message) {
        logger_internal.debug("onExecuted", message);
        prevOnExecuted?.call(this, message);
        const node = this;
        node.imgs = null;
        const images = message?.preview_data ?? [];
        const textEntries = message?.text_data ?? [];
        const previewItems = [];
        const slotContent = /* @__PURE__ */ new Map();
        for (const imgInfo of images) {
          const slot = imgInfo.slot ?? 0;
          if (!slotContent.has(slot)) {
            slotContent.set(slot, []);
          }
          const img = new Image();
          img.src = `/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(
            imgInfo.subfolder || ""
          )}&type=${encodeURIComponent(imgInfo.type || "output")}`;
          slotContent.get(slot).push({ type: "image", element: img });
        }
        for (const entry of textEntries) {
          const slot = entry.slot ?? 0;
          if (!slotContent.has(slot)) {
            slotContent.set(slot, []);
          }
          slotContent.get(slot).push({ type: "text", text: entry.text });
        }
        const sortedSlots = [...slotContent.keys()].sort((a, b) => a - b);
        for (const slot of sortedSlots) {
          previewItems.push(...slotContent.get(slot));
        }
        node._previewItems = previewItems;
        node._totalImages = previewItems.length;
        node._currentImageIndex = Math.min(node._currentImageIndex ?? 0, Math.max(0, node._totalImages - 1));
        updatePreviewDisplay(node);
      };
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (type !== GetLgInput()) {
          return;
        }
        const node = this;
        if (isConnected) {
          try {
            const link = link_info ?? GetInputLink(node, index);
            if (link) {
              const inferredType = GetLinkTypeFromEndpoints(node, link);
              const linkId = link_info?.id ?? node.inputs?.[index]?.link;
              const linkObj = GetLink(node, linkId);
              if (linkObj && inferredType !== ANY_TYPE) {
                linkObj.type = inferredType;
                if (node.inputs[index]) {
                  node.inputs[index].type = inferredType;
                  node.inputs[index].name = `${defaultLabel}_${index + 1}`;
                  node.inputs[index].label = inferredType.toLowerCase();
                }
              }
            }
          } catch {
          }
          DeferMicrotask(() => {
            normalizeInputs(node);
            applyDynamicTypes(node);
          });
          return;
        }
        DeferMicrotask(() => {
          if (!node.inputs?.length || index < 0 || index >= node.inputs.length) {
            return;
          }
          if (node.inputs[index]?.link != null) {
            normalizeInputs(node);
            applyDynamicTypes(node);
            return;
          }
          const hasConnectionsAfter = node.inputs.slice(index + 1).some((i) => i?.link != null);
          if (hasConnectionsAfter && typeof node.removeInput === "function") {
            node.removeInput(index);
          }
          const hasAny = node.inputs?.some((inp) => inp?.link != null);
          if (!hasAny) {
            resetPreviewState(node);
          }
          normalizeInputs(node);
          applyDynamicTypes(node);
        });
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        const loading = IsGraphLoading();
        DeferMicrotask(() => {
          if (loading) {
            this.__tojioo_skip_resize = true;
          }
          try {
            normalizeInputs(this);
            applyDynamicTypes(this);
          } catch (e) {
            log.error("error in configure", e);
          } finally {
            this.__tojioo_skip_resize = false;
          }
        });
        setTimeout(() => {
          try {
            normalizeInputs(this);
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
          if (imgWidgetIndex !== -1) {
            this.widgets.splice(imgWidgetIndex, 1);
          }
        }
        this.imgs = null;
        createPreviewWidget(this);
        const pending = consumePendingConnection();
        const loading = IsGraphLoading();
        DeferMicrotask(() => {
          if (loading) {
            this.__tojioo_skip_resize = true;
          }
          try {
            normalizeInputs(this);
            applyDynamicTypes(this);
          } catch (e) {
            log.error("error in onAdded", e);
          } finally {
            this.__tojioo_skip_resize = false;
          }
          connectPending(this, pending);
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
      const inputPrefix = DeriveDynamicPrefixFromNodeData(nodeData);
      if (!inputPrefix) {
        return;
      }
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (!link_info || type !== GetLgInput()) {
          return;
        }
        const node = this;
        if (!isConnected) {
          DeferMicrotask(() => {
            if (!node.inputs?.length || index < 0 || index >= node.inputs.length) {
              NormalizeInputs(node);
              ApplySwitchDynamicTypes(node, inputPrefix);
              return;
            }
            if (node.inputs[index]?.link != null) {
              NormalizeInputs(node);
              ApplySwitchDynamicTypes(node, inputPrefix);
              return;
            }
            const hasConnectionsAfter = node.inputs.slice(index + 1).some((i) => i?.link != null);
            if (hasConnectionsAfter && typeof node.removeInput === "function") {
              node.removeInput(index);
            }
            NormalizeInputs(node);
            ApplySwitchDynamicTypes(node, inputPrefix);
          });
          return;
        }
        NormalizeInputs(node);
        ApplySwitchDynamicTypes(node, inputPrefix);
        const lastIndex = node.inputs.length - 1;
        if (index === lastIndex && node.inputs[lastIndex]?.link != null && typeof node.addInput === "function") {
          const resolvedType = ResolveInputType(node, lastIndex);
          const socketType = resolvedType !== ANY_TYPE ? resolvedType : node.inputs[0]?.type ?? ANY_TYPE;
          node.addInput(`${inputPrefix}_${node.inputs.length + 1}`, socketType);
          NormalizeInputs(node);
          ApplySwitchDynamicTypes(node, inputPrefix);
        }
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        if (!this.inputs?.length) {
          return;
        }
        NormalizeInputs(this);
        ApplySwitchDynamicTypes(this, inputPrefix);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        NormalizeInputs(this);
        ApplySwitchDynamicTypes(this, inputPrefix);
      };
    }
  };
}
const commonTypes = ["IMAGE", "MASK", "LATENT", "CONDITIONING", "CLIP", "MODEL", "VAE", "STRING", "INT", "FLOAT", "BOOLEAN"];
app.registerExtension({
  name: "Tojioo.Passthrough.Core",
  settings: [
    dynamicBusOverwrite
  ],
  async setup() {
    InstallGraphLoadingHook(app);
    configureSlotMenu([...commonTypes, "BUS"], ["PT_DynamicBus", "Dynamic Bus"]);
    configureSlotMenu([...commonTypes, "BUS"], ["PT_DynamicPreview", "Dynamic Preview"]);
    configureSlotMenu(commonTypes, [
      ["PT_DynamicPassthrough", "Dynamic Passthrough"],
      ["PT_DynamicAny", "Dynamic Any"]
    ]);
    logger_internal.log(`Loaded Version ${"1.7.1"}`);
  }
});
app.registerExtension(configureDynamicBus());
app.registerExtension(configureDynamicPassthrough());
app.registerExtension(configureDynamicPreview());
app.registerExtension(configureDynamicAny());
app.registerExtension(configureBatchSwitchNodes());
app.registerExtension(configureSwitchNodes());
