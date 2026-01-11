import {describe, expect, it} from 'vitest';

import {configureDynamicAny} from '../src/handlers/dynamic_any';
import {configureDynamicPassthrough} from '../src/handlers/dynamic_passthrough';
import {configureDynamicBus} from '../src/handlers/dynamic_bus';
import {configureDynamicPreview} from '../src/handlers/dynamic_preview';
import {configureSwitchNodes} from '../src/handlers/switch';
import {configureBatchSwitchNodes} from '../src/handlers/batch_switch';

// Minimal LiteGraph stub used by handlers to distinguish INPUT/OUTPUT
(globalThis as any).LiteGraph = { INPUT: 1, OUTPUT: 2 };

type Link = {
  id: number;
  origin_id: number;
  origin_slot: number;
  target_id: number;
  target_slot: number;
  type?: string;
};

const makeGraph = (links: Record<number, Link>, nodes: Record<number, any>) => ({
  links,
  getNodeById: (id: number) => nodes[id] ?? null,
  setDirtyCanvas: () => {},
});

class FakeNodeType {}

function makeNode(io: {in: number; out: number}, graph?: any) {
  const node: any = {
    id: Math.floor(Math.random() * 10000),
    inputs: Array.from({length: io.in}, () => ({name: '', label: '', type: '*', link: null})),
    outputs: Array.from({length: io.out}, () => ({name: '', label: '', type: '*', links: [] as number[]})),
    addInput(name: string, type: any) { this.inputs.push({name, label: name, type, link: null}); },
    removeInput(i: number) { this.inputs.splice(i, 1); },
    addOutput(name: string, type: any) { this.outputs.push({name, label: name, type, links: []}); },
    removeOutput(i: number) { this.outputs.splice(i, 1); },
    computeSize: () => [100, 30] as [number, number],
    setSize: (_s: [number, number]) => {},
    rootGraph: graph,
    properties: {},
  };
  return node;
}

describe('handler simulations', () => {
  it('dynamic_any: connects and updates types without throwing', async () => {
    const ext = configureDynamicAny();
    const nodeType: any = FakeNodeType;
    const nodeData: any = { name: 'PT_DynamicAny' };
    await ext.beforeRegisterNodeDef(nodeType, nodeData, {} as any);

    const origin = { id: 1, outputs: [{type: 'STRING'}] } as any;
    const links: Record<number, Link> = { 1: { id: 1, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0 } };
    const graph = makeGraph(links, { 1: origin });
    const node = makeNode({in: 1, out: 1}, graph);

	expect(() => nodeType.prototype.onConnectionsChange.call(node, (globalThis as any).LiteGraph.INPUT, 0, true, { id: 1 }, null)).not.toThrow();
    await Promise.resolve();
    expect(node.inputs[0].type).toBe('*');
    expect(node.outputs[0].type).toBe('*');
  });

  it('dynamic_passthrough: connecting input propagates link type without throwing', async () => {
    const ext = configureDynamicPassthrough();
    const nodeType: any = FakeNodeType;
    const nodeData: any = { name: 'PT_DynamicPassthrough' };
    await ext.beforeRegisterNodeDef(nodeType, nodeData, {} as any);

    const origin = { id: 1, outputs: [{type: 'IMAGE'}] } as any;
    const self = { id: 2 } as any;
    const link = { id: 5, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0 } as Link;
    const graph = makeGraph({5: link}, {1: origin, 2: self});
    const node = makeNode({in: 1, out: 1}, graph);

    expect(() => nodeType.prototype.onConnectionsChange.call(node, (globalThis as any).LiteGraph.INPUT, 0, true, link, null)).not.toThrow();
    await Promise.resolve();
    expect(graph.links[5].type).toBe('IMAGE');
  });

  it('dynamic_bus: basic connect/disconnect does not throw', async () => {
    const ext = configureDynamicBus();
    const nodeType: any = FakeNodeType;
    const nodeData: any = { name: 'PT_DynamicBus' };
    await ext.beforeRegisterNodeDef(nodeType, nodeData, {} as any);

    const graph = makeGraph({}, {});
    const node = makeNode({in: 2, out: 2}, graph);

    // Simulate connection on input 0 (bus)
    expect(() => nodeType.prototype.onConnectionsChange.call(node, (globalThis as any).LiteGraph.INPUT, 0, true, { id: 1 }, null)).not.toThrow();
    // Simulate disconnection on input 1
    expect(() => nodeType.prototype.onConnectionsChange.call(node, (globalThis as any).LiteGraph.INPUT, 1, false, { id: 2 }, null)).not.toThrow();
  });

  it('dynamic_preview: basic connect triggers no errors', async () => {
    const ext = configureDynamicPreview();
    const nodeType: any = FakeNodeType;
    const nodeData: any = { name: 'PT_DynamicPreview' };
    await ext.beforeRegisterNodeDef(nodeType, nodeData, {} as any);

    const graph = makeGraph({}, {});
    const node = makeNode({in: 1, out: 1}, graph);

    expect(() => nodeType.prototype.onConnectionsChange.call(node, (globalThis as any).LiteGraph.INPUT, 0, true, { id: 3 }, null)).not.toThrow();
  });

  it('switch: adding input when last is connected does not throw', async () => {
    const ext = configureSwitchNodes();
    const nodeType: any = FakeNodeType;
    const nodeData: any = { name: 'PT_AnyImageSwitch', input: { optional: { input: {} } } };
    await ext.beforeRegisterNodeDef(nodeType, nodeData, {} as any);

    const graph = makeGraph({}, {});
    const node = makeNode({in: 1, out: 1}, graph);
    node.inputs[0].link = 1; // mark last input connected

    expect(() => nodeType.prototype.onConnectionsChange.call(node, (globalThis as any).LiteGraph.INPUT, 0, true, { id: 1 }, null)).not.toThrow();
    // after connection, handler may add a new input
    expect(node.inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('batch_switch: connect/disconnect flow does not throw', async () => {
    const ext = configureBatchSwitchNodes();
    const nodeType: any = FakeNodeType;
    const nodeData: any = { name: 'PT_AnyImageBatchSwitch', input: { optional: { input: {} } } };
    await ext.beforeRegisterNodeDef(nodeType, nodeData, {} as any);

    const graph = makeGraph({}, {});
    const node = makeNode({in: 2, out: 1}, graph);

    // Connect input 0
    expect(() => nodeType.prototype.onConnectionsChange.call(node, (globalThis as any).LiteGraph.INPUT, 0, true, { id: 10 }, null)).not.toThrow();
    // Disconnect input 0
    expect(() => nodeType.prototype.onConnectionsChange.call(node, (globalThis as any).LiteGraph.INPUT, 0, false, { id: 10 }, null)).not.toThrow();
  });
});
