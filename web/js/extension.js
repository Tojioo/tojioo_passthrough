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
function storesLinksOnSlot(slot, key) {
  const desc = Object.getOwnPropertyDescriptor(slot, key);
  return desc !== void 0 && "value" in desc;
}
function linkValues(links) {
  return typeof links?.values === "function" ? links.values() : Object.values(links ?? {});
}
function GetInputLinkId(node, index) {
  const slot = node?.inputs?.[index];
  if (!slot) {
    return null;
  }
  if (storesLinksOnSlot(slot, "link") || typeof node.isInputConnected !== "function") {
    return slot.link ?? null;
  }
  if (!node.graph || !node.isInputConnected(index)) {
    return null;
  }
  for (const link of linkValues(node.graph.links)) {
    if (link && link.target_id === node.id && link.target_slot === index) {
      return link.id;
    }
  }
  return null;
}
function GetOutputLinkIds(node, index) {
  const slot = node?.outputs?.[index];
  if (!slot) {
    return [];
  }
  if (storesLinksOnSlot(slot, "links") || typeof node.isOutputConnected !== "function") {
    return slot.links ?? [];
  }
  const ids = [];
  if (!node.graph || !node.isOutputConnected(index)) {
    return ids;
  }
  for (const link of linkValues(node.graph.links)) {
    if (link && link.origin_id === node.id && link.origin_slot === index) {
      ids.push(link.id);
    }
  }
  return ids;
}
function IsInputLinked(node, index) {
  return GetInputLinkId(node, index) != null;
}
function IsOutputLinked(node, index) {
  return GetOutputLinkIds(node, index).length > 0;
}
function ClearInputLink(node, index) {
  const slot = node?.inputs?.[index];
  if (!slot) {
    return;
  }
  if (storesLinksOnSlot(slot, "link") || typeof node.disconnectInput !== "function") {
    slot.link = null;
    return;
  }
  node.disconnectInput(index);
}
const ANY_TYPE = "*";
const BUS_TYPE = "BUS";
const MAX_SOCKETS = 32;
function GetGraph(node) {
  return (node.graph ?? node.rootGraph) || window.app?.graph;
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
  return GetLink(node, GetInputLinkId(node, slotIndex));
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
    return ANY_TYPE;
  }
  const origin = GetNodeById(node, link.origin_id);
  const oSlot = origin?.outputs?.[link.origin_slot];
  if (oSlot?.type && oSlot.type !== ANY_TYPE && oSlot.type !== -1) {
    return oSlot.type;
  }
  const target = GetNodeById(node, link.target_id);
  const tSlot = target?.inputs?.[link.target_slot];
  if (tSlot?.type && tSlot.type !== ANY_TYPE && tSlot.type !== -1) {
    return tSlot.type;
  }
  const linkType = link.type;
  if (linkType && linkType !== ANY_TYPE && linkType !== -1) {
    return linkType;
  }
  return ANY_TYPE;
}
let _graphLoadDepth = 0;
let _afterLoadCallbacks = [];
let _pendingCanvasUpdate = null;
let _pendingSizeUpdates = /* @__PURE__ */ new Map();
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
    _graphLoadDepth++;
    try {
      return await original.apply(this, args);
    } finally {
      _graphLoadDepth--;
      if (_graphLoadDepth === 0) {
        runAfterLoadCallbacks();
      }
    }
  };
  wrapped.__tojioo_wrapped = true;
  app2.loadGraphData = wrapped;
}
function IsGraphLoading() {
  return _graphLoadDepth > 0;
}
function AfterGraphLoaded(fn) {
  if (IsGraphLoading()) {
    _afterLoadCallbacks.push(fn);
  }
}
function runAfterLoadCallbacks() {
  const callbacks = _afterLoadCallbacks;
  _afterLoadCallbacks = [];
  for (const fn of callbacks) {
    try {
      fn();
    } catch {
    }
  }
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
function DeriveSwitchTypeFromNodeData(nodeData) {
  const declared = nodeData?.output?.[0];
  return typeof declared === "string" && declared !== "" ? declared : ANY_TYPE;
}
function ResolveInputType(node, inputIndex) {
  const inp = node.inputs?.[inputIndex];
  if (!inp) {
    return ANY_TYPE;
  }
  const linkId = GetInputLinkId(node, inputIndex);
  if (linkId == null) {
    return ANY_TYPE;
  }
  const g = GetGraph(node);
  const link = g?.links?.[linkId];
  if (!link) {
    return ANY_TYPE;
  }
  return GetLinkTypeFromEndpoints(node, link);
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
function ScheduleSizeUpdate(node, expandOnly) {
  _pendingSizeUpdates.set(node, (_pendingSizeUpdates.get(node) ?? false) || expandOnly === true);
  if (_sizeUpdateTimer !== null) {
    return;
  }
  _sizeUpdateTimer = requestAnimationFrame(() => {
    _sizeUpdateTimer = null;
    const nodes = Array.from(_pendingSizeUpdates);
    _pendingSizeUpdates.clear();
    for (const [n, expandOnly2] of nodes) {
      UpdateNodeSizeImmediate(n, expandOnly2 || void 0);
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
function RestoreSavedNodeSize(node, savedSize) {
  if (typeof node.computeSize !== "function" || typeof node.setSize !== "function") {
    return;
  }
  const size = node.computeSize();
  if (savedSize) {
    size[0] = Math.max(size[0], savedSize[0]);
    size[1] = Math.max(size[1], savedSize[1]);
  }
  node.setSize(size);
}
function ApplySwitchDynamicTypes(node, inputPrefix, declaredType = ANY_TYPE) {
  if (!node.inputs || node.inputs.length === 0) {
    return;
  }
  let resolvedType = ANY_TYPE;
  const inputTypes = [];
  for (let i = 0; i < node.inputs.length; i++) {
    const t = ResolveInputType(node, i);
    inputTypes.push(t);
    if (t && t !== ANY_TYPE && resolvedType === ANY_TYPE) {
      resolvedType = t;
    }
  }
  for (let i = 0; i < node.inputs.length; i++) {
    const inp = node.inputs[i];
    const currentType = inputTypes[i];
    const effectiveType = currentType !== ANY_TYPE ? currentType : resolvedType;
    inp.type = effectiveType !== ANY_TYPE ? effectiveType : declaredType;
    const label = effectiveType !== ANY_TYPE ? i === 0 ? effectiveType.toLowerCase() : `${effectiveType.toLowerCase()}_${i + 1}` : i === 0 ? `${inputPrefix}` : `${inputPrefix}_${i + 1}`;
    inp.name = `input_${i + 1}`;
    inp.label = label;
    const linkId = GetInputLinkId(node, i);
    if (linkId != null && effectiveType !== ANY_TYPE) {
      SetLinkType(node, linkId, effectiveType);
    }
  }
  if (node.outputs && node.outputs.length > 0) {
    for (let i = 0; i < node.outputs.length; i++) {
      const out = node.outputs[i];
      out.type = resolvedType !== ANY_TYPE ? resolvedType : declaredType;
      if (resolvedType !== ANY_TYPE) {
        out.name = "output_1";
        out.label = resolvedType.toLowerCase();
      }
      const outLinks = GetOutputLinkIds(node, i);
      for (const linkId of outLinks) {
        if (linkId != null && resolvedType !== ANY_TYPE) {
          SetLinkType(node, linkId, resolvedType);
        }
      }
    }
  }
  ScheduleCanvasUpdate(node);
  ScheduleSizeUpdate(node, true);
}
function UpdateNodeSize(node, expandOnly, force) {
  if (IsGraphLoading()) {
    return;
  }
  ScheduleSizeUpdate(node, expandOnly);
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
    if (IsInputLinked(node, i)) {
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
  ScheduleSizeUpdate(node, true);
}
const _displayNameReverseMap = /* @__PURE__ */ new Map();
let _createNodePatched = false;
let _pollingStarted = false;
const _slotRegistrations = [];
let _slotDefaultsHooked = false;
let _pendingConnection = null;
let _dragActive = false;
let _releaseMenuOpen = false;
const _hookedResetEvents = /* @__PURE__ */ new WeakSet();
function consumePendingConnection() {
  const pending = _releaseMenuOpen ? _pendingConnection : null;
  clearPendingConnection();
  if (!pending || IsGraphLoading()) {
    return null;
  }
  return pending;
}
function clearPendingConnection() {
  _pendingConnection = null;
  _releaseMenuOpen = false;
}
function connectPending(node, pending, slotFilter) {
  const graph = node.graph;
  if (!pending?.sourceNode || !graph || graph.getNodeById?.(pending.sourceNode.id) !== pending.sourceNode) {
    return;
  }
  if (pending.fromInput) {
    connectPendingToInput(node, pending, slotFilter);
    return;
  }
  if (!node.inputs?.length) {
    return;
  }
  const links = graph.links;
  if (links) {
    for (let i = 0; i < node.inputs.length; i++) {
      const linkId = GetInputLinkId(node, i);
      if (linkId == null) {
        continue;
      }
      const lnk = links[linkId];
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
    if (!IsInputLinked(node, i)) {
      pending.sourceNode.connect(pending.sourceSlot, node, i);
      return;
    }
  }
}
function connectPendingToInput(node, pending, slotFilter) {
  const target = pending.sourceNode;
  const targetInput = target.inputs?.[pending.sourceSlot];
  if (!targetInput || !node.outputs?.length) {
    return;
  }
  const targetLinkId = GetInputLinkId(target, pending.sourceSlot);
  const existing = targetLinkId != null ? node.graph.links?.[targetLinkId] : null;
  if (existing && (existing.origin_id !== node.id || !slotFilter || slotFilter(existing.origin_slot, pending.type))) {
    return;
  }
  for (let i = 0; i < node.outputs.length; i++) {
    if (slotFilter && !slotFilter(i, pending.type)) {
      continue;
    }
    if (!IsOutputLinked(node, i)) {
      node.connect(i, target, pending.sourceSlot);
      return;
    }
  }
}
function readDragSource(link) {
  const fromInput = link.input != null && link.output == null;
  const slot = fromInput ? link.input : link.output;
  return {
    sourceNode: link.node,
    sourceSlot: link.slot ?? slot?.slot_index ?? 0,
    type: slot?.type ?? link.type ?? "*",
    fromInput
  };
}
function hookLinkConnectorReset(events) {
  if (_hookedResetEvents.has(events)) {
    return;
  }
  _hookedResetEvents.add(events);
  events.addEventListener("reset", (e) => {
    queueMicrotask(() => {
      if (e.defaultPrevented && _pendingConnection) {
        _releaseMenuOpen = true;
      } else if (!e.defaultPrevented) {
        clearPendingConnection();
      }
    });
  });
}
function isLegacyReleaseMenuOpen() {
  return !!globalThis.document?.querySelector?.(".litecontextmenu, .litesearchbox");
}
function startConnectionPolling() {
  if (_pollingStarted) {
    return;
  }
  _pollingStarted = true;
  function poll() {
    const canvas = window.app?.canvas;
    const events = canvas?.linkConnector?.events;
    if (events) {
      hookLinkConnectorReset(events);
    }
    const links = canvas?.connecting_links;
    if (links?.length) {
      if (!_dragActive) {
        _dragActive = true;
        _releaseMenuOpen = false;
        _pendingConnection = readDragSource(links[0]);
      }
    } else if (_dragActive) {
      _dragActive = false;
      if (!events) {
        _releaseMenuOpen = isLegacyReleaseMenuOpen();
        if (!_releaseMenuOpen) {
          clearPendingConnection();
        }
      }
    } else if (!events && _releaseMenuOpen && !isLegacyReleaseMenuOpen()) {
      clearPendingConnection();
    }
    requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);
}
function configureSlotMenu(types, entriesOrNodeType, displayName) {
  const typeList = Array.isArray(types) ? types : [types];
  if (typeof entriesOrNodeType === "string") {
    addSlotRegistration(typeList, entriesOrNodeType, displayName);
    return;
  }
  const entryList = Array.isArray(entriesOrNodeType[0]) ? entriesOrNodeType : [entriesOrNodeType];
  for (const [nodeType, name] of entryList) {
    addSlotRegistration(typeList, nodeType, name);
  }
}
function addSlotRegistration(types, nodeType, displayName) {
  _slotRegistrations.push([types, nodeType, displayName]);
  hookCoreSlotDefaults();
  registerSlotEntries(types, nodeType);
  registerDisplayName(nodeType, displayName);
}
function hookCoreSlotDefaults() {
  if (_slotDefaultsHooked) {
    return;
  }
  const core = app?.extensions?.find?.((ext) => ext?.name === "Comfy.SlotDefaults");
  const original = core?.setDefaults;
  if (typeof original !== "function") {
    return;
  }
  _slotDefaultsHooked = true;
  core.setDefaults = function(...args) {
    const result = original.apply(this, args);
    for (const [types, nodeType, displayName] of _slotRegistrations) {
      registerSlotEntries(types, nodeType);
      registerDisplayName(nodeType, displayName);
    }
    return result;
  };
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
function ResolvePairType(node, zeroBasedIndex) {
  const hasOutputLink = IsOutputLinked(node, zeroBasedIndex);
  const hasInputLink = IsInputLinked(node, zeroBasedIndex);
  if (!hasOutputLink && !hasInputLink) {
    return ANY_TYPE;
  }
  const outLinkId = GetOutputLinkIds(node, zeroBasedIndex)[0];
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
  const inLinkId = GetInputLinkId(node, zeroBasedIndex);
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
  const inLinkId = GetInputLinkId(node, zeroBasedIndex);
  if (inLinkId != null) {
    SetLinkType(node, inLinkId, type);
  }
  const outLinks = GetOutputLinkIds(node, zeroBasedIndex);
  for (const linkId of outLinks) {
    if (linkId != null) {
      SetLinkType(node, linkId, type);
    }
  }
}
function ResolveConnectedType(node, inp, out) {
  const isConcrete = (t) => t != null && t !== ANY_TYPE && t !== -1;
  const inIndex = node.inputs?.indexOf(inp) ?? -1;
  const outIndex = node.outputs?.indexOf(out) ?? -1;
  const hasInputLink = IsInputLinked(node, inIndex);
  const hasOutputLink = IsOutputLinked(node, outIndex);
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
  const inType = tryFromLink(GetInputLinkId(node, inIndex), "origin");
  if (inType) {
    return inType;
  }
  const outType = tryFromLink(GetOutputLinkIds(node, outIndex)[0], "target");
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
  if (node.inputs?.[i]) {
    node.inputs[i].type = currentType;
    node.inputs[i].name = `input_${i + 1}`;
    node.inputs[i].label = inputNames[i];
  }
  if (node.outputs?.[i]) {
    node.outputs[i].type = currentType;
    node.outputs[i].name = `output_${i + 1}`;
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
  const isPreview = node.type === "PT_DynamicPreview";
  UpdateNodeSize(node, isPreview);
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
  log: createLoggerMethod("log", scope),
  warn: createLoggerMethod("warn", scope),
  error: createLoggerMethod("error", scope),
  info: createLoggerMethod("info", scope),
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
        for (const linkId of GetOutputLinkIds(node, 0)) {
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
        if (!IsInputLinked(this, 0)) {
          return returnObj ? this.inputs[0] : 0;
        }
        return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
      };
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (IsGraphLoading()) {
          return;
        }
        DeferMicrotask(() => applyType(this));
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        DeferMicrotask(() => {
          try {
            applyType(this);
          } catch (e) {
            log$3.error("error in configure", e);
          }
        });
        AfterGraphLoaded(() => applyType(this));
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        const pending = consumePendingConnection();
        DeferMicrotask(() => {
          try {
            applyType(this);
          } catch (e) {
            log$3.error("error in onAdded", e);
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
    const subgraphNodes = [...graph.subgraphs?.values() ?? []].flatMap((sg) => sg._nodes ?? []);
    for (const node of [...graph._nodes ?? [], ...subgraphNodes]) {
      if (node.type !== "PT_DynamicBus") {
        continue;
      }
      const widget = node.widgets?.find((w) => w.name === "_overwrite_mode");
      if (widget) {
        widget.value = value;
      }
      node.onBusChanged?.();
    }
  }
};
function getBusOverwriteMode() {
  return app.extensionManager?.setting?.get(SETTING_IDS.BUS_OVERWRITE) ?? false;
}
const log$2 = loggerInstance("DynamicBus");
const SUBGRAPH_INPUT_ID = -10;
const SUBGRAPH_OUTPUT_ID = -20;
function configureDynamicBus() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicBus",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (nodeData.name !== "PT_DynamicBus") {
        return;
      }
      function isStaleInputLink(node, link) {
        if (!link) {
          return true;
        }
        return Number(link.origin_id) !== SUBGRAPH_INPUT_ID && !GetNodeById(node, link.origin_id);
      }
      function isLiveOutputLink(node, linkId) {
        const link = GetLink(node, linkId);
        if (!link) {
          return false;
        }
        if (Number(link.target_id) === SUBGRAPH_OUTPUT_ID) {
          return true;
        }
        const targetNode = GetNodeById(node, link.target_id);
        return GetInputLinkId(targetNode, link.target_slot) === linkId;
      }
      function getUpstreamBusTypes(node) {
        if (!IsInputLinked(node, 0)) {
          return {};
        }
        const link = GetInputLink(node, 0);
        if (isStaleInputLink(node, link)) {
          ClearInputLink(node, 0);
          return {};
        }
        const sourceNode = GetNodeById(node, link.origin_id);
        return sourceNode?.properties?._busTypes ?? {};
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
          if (IsInputLinked(node, slotIdx)) {
            const type = input.type && input.type !== ANY_TYPE && input.type !== -1 ? input.type : ANY_TYPE;
            types.push(`${slotIdx}:${type}`);
          }
        }
        return types.join(",");
      }
      function buildOutputHints(node) {
        const hints = [];
        for (let slotIdx = 1; slotIdx < node.outputs.length; slotIdx++) {
          const outLinkIds = GetOutputLinkIds(node, slotIdx);
          const hasOutputLink = outLinkIds.length > 0;
          if (!hasOutputLink) {
            continue;
          }
          const hasInputLink = IsInputLinked(node, slotIdx);
          let expectedType = ANY_TYPE;
          if (!hasInputLink) {
            const linkId = outLinkIds[0];
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
          if (IsInputLinked(node, 0)) {
            const busLink = GetInputLink(node, 0);
            if (isStaleInputLink(node, busLink)) {
              ClearInputLink(node, 0);
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
            const hasInput = IsInputLinked(node, slotIdx);
            const hasOutput = IsOutputLinked(node, slotIdx);
            const hadSerializedInput = serializedInfo?.inputs?.[slotIdx]?.link != null;
            const hadSerializedOutput = (serializedInfo?.outputs?.[slotIdx]?.links?.length ?? 0) > 0;
            if (hasInput || hasOutput || hadSerializedInput || hadSerializedOutput) {
              maxNeededSlot = Math.max(maxNeededSlot, slotIdx);
            }
          }
          const targetCount = maxNeededSlot + 2;
          while (node.inputs.length > targetCount) {
            const lastIdx = node.inputs.length - 1;
            const hasLiveLink = IsInputLinked(node, lastIdx);
            const hasSerializedLink = serializedInfo?.inputs?.[lastIdx]?.link != null;
            if (hasLiveLink || hasSerializedLink) {
              break;
            }
            node.removeInput?.(lastIdx);
          }
          while (node.outputs.length > targetCount) {
            const lastIdx = node.outputs.length - 1;
            const hasLiveLinks = IsOutputLinked(node, lastIdx);
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
            if (IsInputLinked(node, slotIdx)) {
              const link = GetInputLink(node, slotIdx);
              if (isStaleInputLink(node, link)) {
                ClearInputLink(node, slotIdx);
              }
            }
          }
          for (let slotIdx = 1; slotIdx < node.inputs.length; slotIdx++) {
            const hasInput = IsInputLinked(node, slotIdx);
            const hasOutput = GetOutputLinkIds(node, slotIdx).some((linkId) => GetLink(node, linkId) != null);
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
              const hasInput = IsInputLinked(node, slotIdx);
              const hasOutput = GetOutputLinkIds(node, slotIdx).some((linkId) => isLiveOutputLink(node, linkId));
              if (hasInput || hasOutput) {
                continue;
              }
              let hasConnectionsAfter = false;
              for (let i = slotIdx + 1; i < Math.max(node.inputs.length, node.outputs.length); i++) {
                const laterInput = IsInputLinked(node, i);
                const laterOutput = GetOutputLinkIds(node, i).some((id) => isLiveOutputLink(node, id));
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
              const hasOutputLinks = IsOutputLinked(node, slotIdx);
              if (hasOutputLinks && serializedOut?.type && serializedOut.type !== ANY_TYPE && serializedOut.type !== -1) {
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
            for (const linkId of GetOutputLinkIds(node, slotIdx)) {
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
            if (!IsInputLinked(node, slotIdx)) {
              continue;
            }
            const localType = slotTypes[slotIdx] || ANY_TYPE;
            if (isOverwriteEnabled && localType !== ANY_TYPE) {
              const matchIdx = Object.keys(upstreamTypes).map(Number).sort((a, b) => a - b).find((idx) => !usedUpstreamIndices.has(idx) && upstreamTypes[idx] === localType);
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
          const busOutLinks = GetOutputLinkIds(node, 0);
          if (busOutLinks.length) {
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
          if (node.__tojioo_bus_needs_fit) {
            node.__tojioo_bus_needs_fit = false;
            if (!IsGraphLoading()) {
              UpdateNodeSizeImmediate(node, false);
            }
          } else {
            UpdateNodeSize(node, true);
          }
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
            if (!IsInputLinked(this, 0)) {
              return returnObj ? this.inputs[0] : 0;
            }
          } else {
            for (let i = 1; i < this.inputs.length; i++) {
              if (!IsInputLinked(this, i)) {
                return returnObj ? this.inputs[i] : i;
              }
            }
          }
        }
        return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
      };
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (IsGraphLoading()) {
          return;
        }
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
        DeferMicrotask(() => synchronize(node));
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        const savedSize = info?.size ? [info.size[0], info.size[1]] : null;
        prevConfigure?.call(this, info);
        const node = this;
        for (let i = 0; i < (node.inputs?.length ?? 0); i++) {
          if (IsInputLinked(node, i)) {
            const link = GetInputLink(node, i);
            if (isStaleInputLink(node, link)) {
              ClearInputLink(node, i);
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
            const hasConnectedSlots = info.inputs?.slice(1).some((inp) => inp.link != null) || info.outputs?.slice(1).some((out) => (out.links?.length ?? 0) > 0);
            if (hasTypedUnconnectedSlots && !hasConnectedSlots) {
              resetNodeToCleanState(node);
              synchronize(node);
            } else {
              synchronize(node, info);
            }
          } catch (e) {
            log$2.error("error in configure", e);
          }
        });
        AfterGraphLoaded(() => {
          synchronize(this, info);
          RestoreSavedNodeSize(this, savedSize);
        });
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        const pending = consumePendingConnection();
        this.__tojioo_bus_needs_fit = true;
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
          if (IsInputLinked(node, i)) {
            lastConnectedInput = i;
            break;
          }
        }
        let lastConnectedOutput = -1;
        for (let i = node.outputs.length - 1; i >= 0; i--) {
          if (IsOutputLinked(node, i)) {
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
            if (!IsInputLinked(this, i)) {
              return returnObj ? this.inputs[i] : i;
            }
          }
        }
        return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
      };
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (IsGraphLoading()) {
          return;
        }
        const node = this;
        if (type === GetLgInput() && isConnected) {
          try {
            const g = GetGraph(node);
            const linkId = link_info?.id ?? GetInputLinkId(node, index);
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
            if (IsInputLinked(node, disconnectedIndex) || IsOutputLinked(node, disconnectedIndex)) {
              normalizeIO(this);
              ApplyDynamicTypes(this);
              return;
            }
            let hasConnectionsAfter = false;
            for (let i = disconnectedIndex + 1; i < Math.max(node.inputs.length, node.outputs.length); i++) {
              if (IsInputLinked(node, i) || IsOutputLinked(node, i)) {
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
        const savedSize = info?.size ? [info.size[0], info.size[1]] : null;
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
        AfterGraphLoaded(() => {
          normalizeIO(this);
          ApplyDynamicTypes(this);
          RestoreSavedNodeSize(this, savedSize);
        });
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
      function normalizeInputs(node) {
        if (!node.inputs) {
          node.inputs = [];
        }
        if (!node.__tojioo_dynamic_io_rebuilt) {
          node.__tojioo_dynamic_io_rebuilt = true;
          const hasAnyLinks = node.inputs?.some((_, i) => IsInputLinked(node, i));
          if (!hasAnyLinks && typeof node.removeInput === "function") {
            while (node.inputs.length) {
              node.removeInput(node.inputs.length - 1);
            }
          }
        }
        let lastConnectedIndex = -1;
        for (let i = node.inputs.length - 1; i >= 0; i--) {
          if (IsInputLinked(node, i)) {
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
        node._previewResizeObserver = new ResizeObserver(() => updateTabBarOverflow(node));
        node._previewResizeObserver.observe(tabBar);
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
        if (index < 0 || index >= (this._totalImages ?? 0)) {
          return;
        }
        this._currentImageIndex = index;
        updatePreviewDisplay(this);
      };
      nodeType.prototype.onConnectInput = function(_targetSlot, _type, _output, _sourceNode, _sourceSlot) {
        return true;
      };
      const prevFindInputSlotByType = nodeType.prototype.findInputSlotByType;
      nodeType.prototype.findInputSlotByType = function(type, returnObj, preferFreeSlot, doNotUseOccupied) {
        if (this.inputs) {
          for (let i = 0; i < this.inputs.length; i++) {
            if (!IsInputLinked(this, i)) {
              return returnObj ? this.inputs[i] : i;
            }
          }
        }
        return prevFindInputSlotByType?.call(this, type, returnObj, preferFreeSlot, doNotUseOccupied) ?? -1;
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
          const route = `/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${encodeURIComponent(
            imgInfo.subfolder || ""
          )}&type=${encodeURIComponent(imgInfo.type || "output")}`;
          img.src = app?.api?.apiURL?.(route) ?? route;
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
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (IsGraphLoading()) {
          return;
        }
        if (type !== GetLgInput()) {
          return;
        }
        const node = this;
        if (isConnected) {
          try {
            const link = link_info ?? GetInputLink(node, index);
            if (link) {
              const inferredType = GetLinkTypeFromEndpoints(node, link);
              const linkId = link_info?.id ?? GetInputLinkId(node, index);
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
          if (IsInputLinked(node, index)) {
            normalizeInputs(node);
            applyDynamicTypes(node);
            return;
          }
          const hasConnectionsAfter = node.inputs.some((_, i) => i > index && IsInputLinked(node, i));
          if (hasConnectionsAfter && typeof node.removeInput === "function") {
            node.removeInput(index);
          }
          const hasAny = node.inputs?.some((_, i) => IsInputLinked(node, i));
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
        AfterGraphLoaded(() => {
          normalizeInputs(this);
          applyDynamicTypes(this);
        });
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
        this._currentImageIndex ??= 0;
        this._previewItems ??= [];
        this._totalImages ??= 0;
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
      const prevOnRemoved = nodeType.prototype.onRemoved;
      nodeType.prototype.onRemoved = function() {
        prevOnRemoved?.apply(this, arguments);
        this._previewResizeObserver?.disconnect();
      };
    }
  };
}
function isSwitch(nodeData) {
  const n = nodeData?.name ?? "";
  return n.startsWith("PT_Any") && n.endsWith("Switch") && !n.endsWith("BatchSwitch");
}
function isBatchSwitch(nodeData) {
  const n = nodeData?.name ?? "";
  return n.startsWith("PT_Any") && n.endsWith("BatchSwitch");
}
function configureSwitchNodes() {
  return configureSwitchFamily("Tojioo.Passthrough.Dynamic.SwitchNodes", isSwitch);
}
function configureBatchSwitchNodes() {
  return configureSwitchFamily("Tojioo.Passthrough.Dynamic.BatchSwitchNodes", isBatchSwitch);
}
function configureSwitchFamily(name, matches) {
  return {
    name,
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (!matches(nodeData)) {
        return;
      }
      const inputPrefix = DeriveDynamicPrefixFromNodeData(nodeData);
      if (!inputPrefix) {
        return;
      }
      const declaredType = DeriveSwitchTypeFromNodeData(nodeData);
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (IsGraphLoading()) {
          return;
        }
        if (!link_info || type !== GetLgInput()) {
          return;
        }
        const node = this;
        if (!isConnected) {
          DeferMicrotask(() => {
            if (!node.inputs?.length || index < 0 || index >= node.inputs.length) {
              NormalizeInputs(node);
              ApplySwitchDynamicTypes(node, inputPrefix, declaredType);
              return;
            }
            if (IsInputLinked(node, index)) {
              NormalizeInputs(node);
              ApplySwitchDynamicTypes(node, inputPrefix, declaredType);
              return;
            }
            const hasConnectionsAfter = node.inputs.some((_, i) => i > index && IsInputLinked(node, i));
            if (hasConnectionsAfter && typeof node.removeInput === "function") {
              node.removeInput(index);
            }
            NormalizeInputs(node);
            ApplySwitchDynamicTypes(node, inputPrefix, declaredType);
          });
          return;
        }
        NormalizeInputs(node);
        ApplySwitchDynamicTypes(node, inputPrefix, declaredType);
        const lastIndex = node.inputs.length - 1;
        if (index === lastIndex && IsInputLinked(node, lastIndex) && typeof node.addInput === "function") {
          const resolvedType = ResolveInputType(node, lastIndex);
          const socketType = resolvedType !== ANY_TYPE ? resolvedType : node.inputs[0]?.type ?? ANY_TYPE;
          node.addInput(`${inputPrefix}_${node.inputs.length + 1}`, socketType);
          NormalizeInputs(node);
          ApplySwitchDynamicTypes(node, inputPrefix, declaredType);
        }
      };
      const prevConfigure = nodeType.prototype.configure;
      nodeType.prototype.configure = function(info) {
        prevConfigure?.call(this, info);
        if (!this.inputs?.length) {
          return;
        }
        NormalizeInputs(this);
        ApplySwitchDynamicTypes(this, inputPrefix, declaredType);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        NormalizeInputs(this);
        ApplySwitchDynamicTypes(this, inputPrefix, declaredType);
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
