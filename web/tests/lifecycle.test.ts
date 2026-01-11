import {describe, expect, it, vi} from 'vitest';

import {
	applySwitchDynamicTypes,
	DeferMicrotask,
	deriveDynamicPrefixFromNodeData,
	InstallGraphLoadingHook,
	IsGraphLoading,
	normalizeInputs,
	resolveInputType,
	UpdateNodeSize,
	UpdatePreviewNodeSize,
} from '../src/utils/lifecycle';

type Link = {
  id: number;
  origin_id: number;
  origin_slot: number;
  target_id: number;
  target_slot: number;
  type?: string;
};

type FakeNode = {
  id: number;
  type?: string;
  inputs: any[];
  outputs: any[];
  size?: [number, number];
  computeSize: () => [number, number];
  setSize: (s: [number, number]) => void;
  removeInput?: (i: number) => void;
  rootGraph?: any;
};

const makeGraph = (links: Record<number, Link>, nodes: Record<number, any>) => ({
  links,
  getNodeById: (id: number) => nodes[id] ?? null,
  setDirtyCanvas: vi.fn(),
});

const makeIO = (count: number) => ({
  inputs: Array.from({length: count}, () => ({name: '', label: '', type: '*', link: null})),
  outputs: Array.from({length: count}, () => ({name: '', label: '', type: '*', links: [] as number[]})),
});

describe('lifecycle utilities', () => {
  it('InstallGraphLoadingHook toggles IsGraphLoading during load', async () => {
    const app: any = {};
    let resolve!: () => void;
    const p = new Promise<void>(r => (resolve = r));
    app.loadGraphData = vi.fn(() => p);

    InstallGraphLoadingHook(app);

    const call = app.loadGraphData();
    expect(IsGraphLoading()).toBe(true);

    resolve();
    await call;
    expect(IsGraphLoading()).toBe(false);
  });

  it('DeferMicrotask schedules callback in microtask queue', async () => {
    let ran = false;
    DeferMicrotask(() => { ran = true; });
    expect(ran).toBe(false);
    await Promise.resolve();
    expect(ran).toBe(true);
  });

  it('DeferMicrotask fallback via Promise when queueMicrotask is unavailable', async () => {
    const original = (globalThis as any).queueMicrotask;
    (globalThis as any).queueMicrotask = undefined;
    try {
      let ran = false;
      DeferMicrotask(() => { ran = true; });
      expect(ran).toBe(false);
      await Promise.resolve();
      expect(ran).toBe(true);
    } finally {
      (globalThis as any).queueMicrotask = original;
    }
  });

  it('deriveDynamicPrefixFromNodeData handles numbered suffixes', () => {
    const nodeData1: any = {input: {optional: {foo_1: {}, foo_2: {}}}};
    expect(deriveDynamicPrefixFromNodeData(nodeData1)).toBe('foo');

    const nodeData2: any = {input: {optional: {bar2: {}, bar10: {}}}};
    expect(deriveDynamicPrefixFromNodeData(nodeData2)).toBe('bar');

    const nodeData3: any = {input: {optional: {only: {}}}};
    expect(deriveDynamicPrefixFromNodeData(nodeData3)).toBe('only');

    const nodeData4: any = {input: {optional: {}}};
    expect(deriveDynamicPrefixFromNodeData(nodeData4)).toBeNull();

    expect(deriveDynamicPrefixFromNodeData({} as any)).toBeNull();
  });

  it('resolveInputType derives from link endpoints and slots', () => {
    // Build a graph with two nodes connected: n1.out0 -> n2.in0
    const n1: any = { id: 1, outputs: [{type: 'IMAGE'}] };
    const n2: any = { id: 2, inputs: [{link: 7}] };
    const link: Link = { id: 7, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0 };
    const g = makeGraph({7: link}, {1: n1, 2: n2});

    const node: FakeNode = {
      id: 2,
      ...makeIO(1),
      inputs: [{link: 7}],
      outputs: [],
      computeSize: () => [100, 50],
      setSize: () => {},
      rootGraph: g,
    };

    const t = resolveInputType(node, 0);
    expect(t).toBe('IMAGE');
  });

  it('applySwitchDynamicTypes sets input/output types, labels and updates link types', () => {
    // Node with 2 inputs and 1 output. First input linked with TEXT, second untyped
    const producer: any = { id: 1, outputs: [{type: 'TEXT'}] };
    const consumer: any = { id: 2, inputs: [{}, {}], outputs: [{}] };
    const linkIn: Link = { id: 10, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0 };
    const linkOut: Link = { id: 11, origin_id: 2, origin_slot: 0, target_id: 1, target_slot: 0 };

    const g = makeGraph({10: linkIn, 11: linkOut}, {1: producer, 2: consumer});

    const node: FakeNode = {
      id: 2,
      type: 'PT_DynamicPassthrough',
      ...makeIO(2),
      inputs: [
        { name: 'input_1', label: '', type: '*', link: 10 },
        { name: 'input_2', label: '', type: '*', link: null },
      ],
      outputs: [ { name: 'output_1', label: '', type: '*', links: [11] } ],
      computeSize: () => [100, 30],
      setSize: vi.fn(),
      rootGraph: g,
    };

    applySwitchDynamicTypes(node, 'input');

    // Resolved type is TEXT
    expect(node.inputs[0].type).toBe('TEXT');
    expect(node.inputs[1].type).toBe('TEXT');
    expect(node.inputs[0].label).toBe('text');
    expect(node.inputs[1].label).toBe('text_2');

    expect(node.outputs[0].type).toBe('TEXT');
    expect(node.outputs[0].label).toBe('text');

    // Link types updated
    expect(g.links[10].type).toBe('TEXT');
    expect(g.links[11].type).toBe('TEXT');

    // Canvas marked dirty and size updated
    expect(g.setDirtyCanvas).toHaveBeenCalledWith(true, true);
  });

  it('UpdateNodeSize respects expandOnly flag and existing size', () => {
    const node: any = {
      type: 'PT_DynamicPreview',
      size: [80, 20],
      computeSize: () => [60, 40],
      setSize: vi.fn(),
    };

    // With explicit expandOnly true, width should expand to max of old/new
    UpdateNodeSize(node, true);
    expect(node.setSize).toHaveBeenCalledWith([80, 40]);

    // With explicit expandOnly false, should use computed size directly
    node.setSize.mockClear();
    UpdateNodeSize(node, false);
    expect(node.setSize).toHaveBeenCalledWith([60, 40]);
  });

  it('UpdatePreviewNodeSize returns early while graph is loading or when flagged to skip', () => {
    // Simulate skip flag
    const node: any = {
      __tojioo_skip_resize: true,
      size: [10, 10],
      computeSize: vi.fn(() => [20, 5]),
      setSize: vi.fn(),
    };
    UpdatePreviewNodeSize(node);
    expect(node.setSize).not.toHaveBeenCalled();
  });

  it('normalizeInputs prunes trailing unconnected inputs and keeps at least one', () => {
    const removed: number[] = [];
    const node: any = {
      inputs: [
        { link: null },
        { link: 1 }, // last connected at index 1
        { link: null },
        { link: null },
      ],
      removeInput: (i: number) => { removed.push(i); node.inputs.splice(i, 1); },
      computeSize: () => [10, 10],
      setSize: () => {},
    };
    normalizeInputs(node);
    // Should keep indices 0..(lastConnected+1) => 0..2, so remove last one only
    expect(removed).toEqual([3]);
    expect(node.inputs.length).toBe(3);
  });
});
