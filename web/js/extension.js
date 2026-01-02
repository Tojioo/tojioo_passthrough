import {app} from "../../scripts/app.js";

const ANY_TYPE$3 = "*";
function GetGraph(node) {
  return (node.rootGraph ?? node.graph) || window.app?.graph;
}
function GetLink(node, linkId) {
  if (linkId == null) {
    return null;
  }
  const g = GetGraph(node);
  return g?.links?.[linkId] ?? null;
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
const ANY_TYPE$2 = "*";
let _graphLoading = false;
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
  const g = GetGraph(node);
  for (let i = 0; i < node.inputs.length; i++) {
    const inp = node.inputs[i];
    const currentType = inputTypes[i];
    const effectiveType = currentType !== ANY_TYPE$2 ? currentType : resolvedType;
    inp.type = effectiveType;
    if (effectiveType !== ANY_TYPE$2) {
      const baseLabel = effectiveType.toLowerCase();
      const n = i === 0 ? baseLabel : `${baseLabel}_${i + 1}`;
      inp.name = n;
      inp.label = n;
    } else {
      const n = i === 0 ? `${inputPrefix}` : `${inputPrefix}_${i + 1}`;
      inp.name = n;
      inp.label = n;
    }
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
        const n = resolvedType.toLowerCase();
        out.name = n;
        out.label = n;
      }
      const outLinks = out.links ?? [];
      for (const linkId of outLinks) {
        if (linkId != null && resolvedType !== ANY_TYPE$2) {
          SetLinkType(node, linkId, resolvedType);
        }
      }
    }
  }
  g?.setDirtyCanvas?.(true, true);
  UpdateNodeSize(node);
}
function UpdateNodeSize(node) {
  if (IsGraphLoading()) {
    return;
  }
  const size = node.computeSize();
  if (node.size) {
    size[0] = Math.max(size[0], node.size[0]);
    size[1] = Math.max(size[1], node.size[1]);
  }
  node.setSize(size);
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
    node.removeInput(node.inputs.length - 1);
  }
  UpdateNodeSize(node);
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
    beforeRegisterNodeDef: async (nodeType, nodeData, app2) => {
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
        if (!link_info || type !== LiteGraph.INPUT) {
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
            if (hasConnectionsAfter) {
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
        if (index === lastIndex && node.inputs[lastIndex]?.link != null) {
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
  if (node.inputs?.[i]) {
    node.inputs[i].type = currentType;
    node.inputs[i].name = inputNames[i];
    node.inputs[i].label = inputNames[i];
  }
  if (node.outputs?.[i]) {
    node.outputs[i].type = currentType;
    node.outputs[i].name = outputNames[i];
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
  UpdateNodeSize(node);
}
function configureDynamicBus() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicBus",
    beforeRegisterNodeDef: async (nodeType, nodeData, app2) => {
      if (nodeData.name !== "PT_DynamicBus") {
        return;
      }
      function getSourceBusTypes(node) {
        const busInput = node.inputs?.[0];
        if (!busInput || busInput.link == null) {
          return null;
        }
        const link = node.getInputLink(0);
        if (!link) {
          return null;
        }
        const sourceNode = node.graph?.getNodeById(link.origin_id);
        return sourceNode?.properties?._bus_slot_types ?? null;
      }
      function resolveSlotType(node, slotIndex, busTypes) {
        const t = ResolveConnectedType(node, node.inputs?.[slotIndex], node.outputs?.[slotIndex]);
        if (t !== ANY_TYPE$1) {
          return t;
        }
        const busIndex = slotIndex - 1;
        if (busTypes?.[busIndex] !== void 0) {
          return busTypes[busIndex];
        }
        return ANY_TYPE$1;
      }
      function normalizeIO(node) {
        if (!node.inputs) node.inputs = [];
        if (!node.outputs) node.outputs = [];
        if (node.inputs.length === 0) {
          node.addInput("bus", BUS_TYPE);
        } else {
          node.inputs[0].name = "bus";
          node.inputs[0].label = "bus";
          node.inputs[0].type = BUS_TYPE;
        }
        if (node.outputs.length === 0) {
          node.addOutput("bus", BUS_TYPE);
        } else {
          node.outputs[0].name = "bus";
          node.outputs[0].label = "bus";
          node.outputs[0].type = BUS_TYPE;
        }
        let lastConnectedInput = 0;
        for (let i = node.inputs.length - 1; i >= 1; i--) {
          if (node.inputs[i]?.link != null) {
            lastConnectedInput = i;
            break;
          }
        }
        let lastConnectedOutput = 0;
        for (let i = node.outputs.length - 1; i >= 1; i--) {
          if ((node.outputs[i]?.links?.length ?? 0) > 0) {
            lastConnectedOutput = i;
            break;
          }
        }
        const busTypes = getSourceBusTypes(node);
        const busSlotCount = busTypes ? Math.max(...Object.keys(busTypes).map(Number), -1) + 1 : 0;
        const lastConnected = Math.max(lastConnectedInput, lastConnectedOutput);
        const desiredCount = Math.min(MAX_SOCKETS, Math.max(2, lastConnected + 2, busSlotCount + 2));
        while (node.inputs.length > desiredCount) {
          node.removeInput(node.inputs.length - 1);
        }
        while (node.inputs.length < desiredCount) {
          node.addInput("input", ANY_TYPE$1);
          node.inputs[node.inputs.length - 1].label = "input";
        }
        while (node.outputs.length > desiredCount) {
          node.removeOutput(node.outputs.length - 1);
        }
        while (node.outputs.length < desiredCount) {
          node.addOutput("output", ANY_TYPE$1);
          node.outputs[node.outputs.length - 1].label = "output";
        }
        UpdateNodeSize(node);
      }
      function applyBusDynamicTypes(node) {
        const count = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
        const busTypes = getSourceBusTypes(node);
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
        for (let i = 1; i < count; i++) {
          ProcessTypeNames(types, i, typeCounters, inputNames, outputNames);
        }
        for (let i = 0; i < count; i++) {
          const currentType = AssignTypeAndName(types, i, node, inputNames, outputNames);
          if (i > 0 && currentType !== ANY_TYPE$1) {
            const inLink = node.getInputLink(i);
            if (inLink) {
              inLink.type = currentType;
            }
            for (const linkId of node.outputs?.[i]?.links ?? []) {
              const link = node.graph?.links?.[linkId];
              if (link) {
                link.type = currentType;
              }
            }
          }
        }
        const busInLink = node.getInputLink(0);
        if (busInLink) {
          busInLink.type = BUS_TYPE;
        }
        for (const linkId of node.outputs?.[0]?.links ?? []) {
          const link = node.graph?.links?.[linkId];
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
            node.properties._bus_slot_types[i - 1] = types[i];
          }
        }
        node.graph?.setDirtyCanvas?.(true, true);
        UpdateNodeSize(node);
      }
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        const node = this;
        if (type === LiteGraph.INPUT && isConnected && index > 0) {
          try {
            const link = link_info ?? node.getInputLink(index);
            if (link) {
              const sourceNode = node.graph?.getNodeById(link.origin_id);
              const sourceSlot = sourceNode?.outputs?.[link.origin_slot];
              const inferredType = sourceSlot?.type && sourceSlot.type !== ANY_TYPE$1 && sourceSlot.type !== -1 ? sourceSlot.type : GetLinkTypeFromEndpoints(node, link);
              if (inferredType !== ANY_TYPE$1) {
                const n = inferredType.toLowerCase();
                if (node.inputs[index]) {
                  node.inputs[index].type = inferredType;
                  node.inputs[index].name = n;
                  node.inputs[index].label = n;
                }
                if (node.outputs[index]) {
                  node.outputs[index].type = inferredType;
                  node.outputs[index].name = n;
                  node.outputs[index].label = n;
                }
                const linkId = link_info?.id ?? node.inputs?.[index]?.link;
                const linkObj = node.graph?.links?.[linkId];
                if (linkObj) linkObj.type = inferredType;
              }
            }
          } catch {
          }
        }
        if (type === LiteGraph.OUTPUT && isConnected && index > 0) {
          try {
            const linkId = link_info?.id;
            const link = link_info ?? (linkId != null ? node.graph?.links?.[linkId] : null);
            if (link) {
              const targetNode = node.graph?.getNodeById(link.target_id);
              const targetSlot = targetNode?.inputs?.[link.target_slot];
              const inferredType = targetSlot?.type && targetSlot.type !== ANY_TYPE$1 && targetSlot.type !== -1 ? targetSlot.type : GetLinkTypeFromEndpoints(node, link);
              if (inferredType !== ANY_TYPE$1) {
                const n = inferredType.toLowerCase();
                if (node.outputs[index]) {
                  node.outputs[index].type = inferredType;
                  node.outputs[index].name = n;
                  node.outputs[index].label = n;
                }
                if (node.inputs[index]) {
                  node.inputs[index].type = inferredType;
                  node.inputs[index].name = n;
                  node.inputs[index].label = n;
                }
                const linkObj = node.graph?.links?.[linkId];
                if (linkObj) linkObj.type = inferredType;
              }
            }
          } catch {
          }
        }
        if (!isConnected && index > 0) {
          const isInput = type === LiteGraph.INPUT;
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
              node.removeInput(index);
              node.removeOutput(index);
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
        normalizeIO(this);
        applyBusDynamicTypes(this);
        setTimeout(() => applyBusDynamicTypes(this), 100);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        DeferMicrotask(() => {
          normalizeIO(this);
          applyBusDynamicTypes(this);
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
        if (!node.inputs) {
          node.inputs = [];
        }
        if (!node.outputs) {
          node.outputs = [];
        }
        if (!node.__tojioo_dynamic_io_rebuilt) {
          node.__tojioo_dynamic_io_rebuilt = true;
          const hasAnyLinks = node.inputs?.some((i) => i?.link != null) || node.outputs?.some((o) => (o?.links?.length ?? 0) > 0);
          if (!hasAnyLinks) {
            while (node.inputs.length) {
              node.removeInput(node.inputs.length - 1);
            }
            while (node.outputs.length) {
              node.removeOutput(node.outputs.length - 1);
            }
          }
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
        while (node.inputs.length > desiredCount) {
          node.removeInput(node.inputs.length - 1);
        }
        while (node.outputs.length > desiredCount) {
          node.removeOutput(node.outputs.length - 1);
        }
        while (node.inputs.length < desiredCount) {
          node.addInput("input", ANY_TYPE$1);
          node.inputs[node.inputs.length - 1].label = "input";
        }
        while (node.outputs.length < desiredCount) {
          node.addOutput("output", ANY_TYPE$1);
          node.outputs[node.outputs.length - 1].label = "output";
        }
        UpdateNodeSize(node);
      }
      const prevOnConnectionsChange = nodeType.prototype.onConnectionsChange;
      nodeType.prototype.onConnectionsChange = function(type, index, isConnected, link_info, inputOrOutput) {
        if (IsGraphLoading()) {
          return;
        }
        if (prevOnConnectionsChange) {
          prevOnConnectionsChange.call(
            this,
            type,
            index,
            isConnected,
            link_info,
            inputOrOutput
          );
        }
        const node = this;
        if (type === LiteGraph.INPUT && isConnected) {
          try {
            const g = GetGraph(node);
            const linkId = link_info?.id ?? node.inputs?.[index]?.link;
            const linkObj = link_info ?? (linkId != null ? GetLink(node, linkId) : null);
            const inferredType = GetLinkTypeFromEndpoints(node, linkObj);
            if (linkId != null && g?.links?.[linkId] && inferredType && inferredType !== ANY_TYPE$1) {
              g.links[linkId].type = inferredType;
              if (node.outputs?.[index]) {
                node.outputs[index].type = inferredType;
                const n = inferredType.toLowerCase();
                node.outputs[index].name = n;
                node.outputs[index].label = n;
                if (node.inputs?.[index]) {
                  node.inputs[index].type = inferredType;
                  node.inputs[index].name = n;
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
              node.removeInput(disconnectedIndex);
              node.removeOutput(disconnectedIndex);
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
        if (prevConfigure) {
          prevConfigure.call(this, info);
        }
        normalizeIO(this);
        ApplyDynamicTypes(this);
        setTimeout(() => {
          ApplyDynamicTypes(this);
        }, 100);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        if (prevOnAdded) {
          prevOnAdded.apply(this, arguments);
        }
        DeferMicrotask(() => {
          normalizeIO(this);
          ApplyDynamicTypes(this);
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
        let lastConnectedIndex = -1;
        for (let i = node.inputs.length - 1; i >= 0; i--) {
          if (node.inputs[i]?.link != null) {
            lastConnectedIndex = i;
            break;
          }
        }
        const desiredCount = Math.min(MAX_SOCKETS, Math.max(1, lastConnectedIndex + 2));
        while (node.inputs.length > desiredCount) {
          node.removeInput(node.inputs.length - 1);
        }
        while (node.inputs.length < desiredCount) {
          node.addInput("image", ANY_TYPE$1);
          node.inputs[node.inputs.length - 1].label = "image";
        }
        UpdateNodeSize(node);
      }
      function applyDynamicTypes(node) {
        if (!node.inputs?.length) {
          return;
        }
        const types = [];
        const typeCounters = {};
        for (let i = 0; i < node.inputs.length; i++) {
          const link = node.getInputLink(i);
          let resolvedType = ANY_TYPE$1;
          if (link) {
            const t = GetLinkTypeFromEndpoints(node, link);
            if (t !== ANY_TYPE$1) {
              resolvedType = t;
            }
          }
          types.push(resolvedType);
        }
        for (let i = 0; i < node.inputs.length; i++) {
          const inp = node.inputs[i];
          const t = types[i];
          const isTyped = t !== ANY_TYPE$1;
          inp.type = t;
          if (isTyped) {
            const baseLabel = t.toLowerCase();
            typeCounters[t] = (typeCounters[t] ?? 0) + 1;
            const n = typeCounters[t] === 1 ? baseLabel : `${baseLabel}_${typeCounters[t]}`;
            inp.name = n;
            inp.label = n;
          } else {
            typeCounters["__untyped__"] = (typeCounters["__untyped__"] ?? 0) + 1;
            const n = typeCounters["__untyped__"];
            const name = n === 1 ? "image" : `image_${n}`;
            inp.name = name;
            inp.label = name;
          }
        }
        node.graph?.setDirtyCanvas?.(true, true);
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
        if (index < 0 || index >= this._totalImages) {
          return;
        }
        this._currentImageIndex = index;
        this.graph?.setDirtyCanvas?.(true, true);
      };
      const prevOnDrawForeground = nodeType.prototype.onDrawForeground;
      nodeType.prototype.onDrawForeground = function(ctx, canvas, canvasElement) {
        prevOnDrawForeground?.call(this, ctx, canvas, canvasElement);
        const node = this;
        if (!node._imageElements?.length || node._totalImages === 0) {
          return;
        }
        const imgs = node._imageElements;
        const idx = Math.min(node._currentImageIndex, imgs.length - 1);
        const img = imgs[idx];
        if (!img?.complete || img.naturalWidth === 0) {
          return;
        }
        const inputsHeight = (node.inputs?.length || 1) * LiteGraph.NODE_SLOT_HEIGHT + 10;
        const showTabs = node._totalImages >= 2;
        const tabBarHeight = showTabs ? TAB_BAR_HEIGHT : 0;
        const previewY = inputsHeight + tabBarHeight;
        const previewHeight = node.size[1] - previewY;
        const previewWidth = node.size[0];
        if (previewHeight < 50) {
          return;
        }
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
            node._tabHitAreas.push({
              x: tabX,
              y: tabY,
              width: tabWidth,
              height: TAB_BAR_HEIGHT,
              index: i
            });
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
        if (IsGraphLoading()) {
          return;
        }
        prevOnConnectionsChange?.call(this, type, index, isConnected, link_info, inputOrOutput);
        if (type !== LiteGraph.INPUT) {
          return;
        }
        const node = this;
        if (isConnected) {
          try {
            const link = link_info ?? node.getInputLink(index);
            if (link) {
              const inferredType = GetLinkTypeFromEndpoints(node, link);
              const linkId = link_info?.id ?? node.inputs?.[index]?.link;
              if (linkId != null && node.graph?.links?.[linkId] && inferredType !== ANY_TYPE$1) {
                node.graph.links[linkId].type = inferredType;
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
          if (!node.inputs?.length || index < 0 || index >= node.inputs.length) {
            return;
          }
          if (node.inputs[index]?.link != null) {
            normalizeInputs2(node);
            applyDynamicTypes(node);
            return;
          }
          const hasConnectionsAfter = node.inputs.slice(index + 1).some((i) => i?.link != null);
          if (hasConnectionsAfter) {
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
        normalizeInputs2(this);
        applyDynamicTypes(this);
        setTimeout(() => {
          normalizeInputs2(this);
          applyDynamicTypes(this);
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
        DeferMicrotask(() => {
          normalizeInputs2(this);
          applyDynamicTypes(this);
        });
      };
    }
  };
}
function configureDynamicSingle() {
  return {
    name: "Tojioo.Passthrough.Dynamic.DynamicSingle",
    beforeRegisterNodeDef: async (nodeType, nodeData, _app) => {
      if (nodeData?.name !== "PT_DynamicSingle") {
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
        const inLink = node.getInputLink(0);
        if (inLink && slotType !== ANY_TYPE$1) {
          inLink.type = slotType;
        }
        for (const linkId of node.outputs?.[0]?.links ?? []) {
          const link = node.graph?.links?.[linkId];
          if (link && slotType !== ANY_TYPE$1) {
            link.type = slotType;
          }
        }
        node.graph?.setDirtyCanvas?.(true, true);
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
        applyType(this);
        setTimeout(() => applyType(this), 100);
      };
      const prevOnAdded = nodeType.prototype.onAdded;
      nodeType.prototype.onAdded = function() {
        prevOnAdded?.apply(this, arguments);
        applyType(this);
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
        if (!link_info || type !== LiteGraph.INPUT) {
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
            if (hasConnectionsAfter) {
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
        if (index === lastIndex && node.inputs[lastIndex]?.link != null) {
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
InstallGraphLoadingHook(app);
app.registerExtension(configureBatchSwitchNodes());
app.registerExtension(configureDynamicBus());
app.registerExtension(configureDynamicPassthrough());
app.registerExtension(configureDynamicPreview());
app.registerExtension(configureDynamicSingle());
app.registerExtension(configureSwitchNodes());
