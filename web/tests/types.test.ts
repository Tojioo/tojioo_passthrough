import {describe, expect, it, vi} from 'vitest';

import {ApplyDynamicTypes, AssignTypeAndName, ProcessTypeNames, ResolveConnectedType, ResolvePairType, UpdateLinkTypesForSlot,} from '../src/utils/types';

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
  setDirtyCanvas: vi.fn(),
});

const makeNode = (io: {in: number; out: number}, graph: any) => ({
  id: 100,
  inputs: Array.from({length: io.in}, () => ({name: '', label: '', type: '*', link: null})),
  outputs: Array.from({length: io.out}, () => ({name: '', label: '', type: '*', links: [] as number[]})),
  rootGraph: graph,
});

describe('types utilities', () => {
  it('ResolvePairType returns * when no links', () => {
    const g = makeGraph({}, {});
    const node: any = makeNode({in: 1, out: 1}, g);
    expect(ResolvePairType(node, 0)).toBe('*');
  });

  it('ResolvePairType can resolve from target input slot when endpoint type is *', () => {
    const target: any = { id: 2, inputs: [{type: 'AUDIO'}] };
    const self: any = { id: 1, outputs: [{}] };
    const link: Link = { id: 5, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0 };
    const g = makeGraph({5: link}, {1: self, 2: target});
    const node: any = makeNode({in: 1, out: 1}, g);
    node.outputs[0].links = [5];
    expect(ResolvePairType(node, 0)).toBe('AUDIO');
  });

  it('UpdateLinkTypesForSlot sets type on input link and all output links', () => {
    const other: any = { id: 2 };
    const node: any = { id: 1, inputs: [{link: 7}], outputs: [{links: [8, 9]}], rootGraph: null };
    const linkIn: Link = { id: 7, origin_id: 2, origin_slot: 0, target_id: 1, target_slot: 0 };
    const linkOut1: Link = { id: 8, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0 };
    const linkOut2: Link = { id: 9, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 1 };
    const g = makeGraph({7: linkIn, 8: linkOut1, 9: linkOut2}, {1: node, 2: other});
    node.rootGraph = g;

    UpdateLinkTypesForSlot(node, 0, 'IMAGE');
    expect(g.links[7].type).toBe('IMAGE');
    expect(g.links[8].type).toBe('IMAGE');
    expect(g.links[9].type).toBe('IMAGE');
  });

  it('ResolveConnectedType prioritizes concrete endpoint types, falling back to slot types', () => {
    const origin: any = { id: 10, outputs: [{type: 'TEXT'}] };
    const target: any = { id: 11, inputs: [{type: '*'}] };
    const link: Link = { id: 20, origin_id: 10, origin_slot: 0, target_id: 11, target_slot: 0 };
    const g = makeGraph({20: link}, {10: origin, 11: target});

    const node: any = {
      id: 11,
      inputs: [{link: 20, type: '*'}],
      outputs: [{links: []}],
      rootGraph: g,
    };

    const t = ResolveConnectedType(node, node.inputs[0], node.outputs[0]);
    expect(t).toBe('TEXT');
  });

  it('ProcessTypeNames builds labels with counters for repeated and untyped types', () => {
    const types = ['TEXT', '*', 'TEXT', 'IMAGE', '*'];
    const inputNames: string[] = [];
    const outputNames: string[] = [];
    const counters: Record<string, number> = {};

    for (let i = 0; i < types.length; i++) {
      ProcessTypeNames(types, i, counters, inputNames, outputNames);
    }

    expect(inputNames).toEqual(['text', 'input', 'text_2', 'image', 'input_2']);
    expect(outputNames).toEqual(['text', 'output', 'text_2', 'image', 'output_2']);
  });

  it('AssignTypeAndName applies types and names; PT_DynamicBus handles bus slot naming', () => {
    const nodeBus: any = { type: 'PT_DynamicBus', inputs: [{}, {}], outputs: [{}, {}] };
    const nodeOther: any = { type: 'PT_DynamicAny', inputs: [{}, {}], outputs: [{}, {}] };
    const types = ['TEXT', 'IMAGE'];
    const inputNames = ['text', 'image'];
    const outputNames = ['text', 'image'];

    const t0 = AssignTypeAndName(types, 0, nodeBus, inputNames, outputNames);
    expect(nodeBus.inputs[0]).toMatchObject({type: 'TEXT', name: 'bus', label: 'text'});
    expect(nodeBus.outputs[0]).toMatchObject({type: 'TEXT', name: 'bus', label: 'text'});
    expect(t0).toBe('TEXT');

    const t1 = AssignTypeAndName(types, 1, nodeOther, inputNames, outputNames);
    expect(nodeOther.inputs[1]).toMatchObject({type: 'IMAGE', name: 'input_2', label: 'image'});
    expect(nodeOther.outputs[1]).toMatchObject({type: 'IMAGE', name: 'output_2', label: 'image'});
    expect(t1).toBe('IMAGE');
  });

  it('ApplyDynamicTypes resolves per-pair types, updates link types, marks canvas dirty and resizes', () => {
    // Prepare three pairs: [TEXT], [*], [IMAGE]
    const prodText: any = { id: 1, outputs: [{type: 'TEXT'}] };
    const prodStar: any = { id: 2, outputs: [{type: '*'}] };
    const consImg: any = { id: 3, inputs: [{type: 'IMAGE'}] };

    const self: any = { id: 100 };

    const l0: Link = { id: 30, origin_id: 1, origin_slot: 0, target_id: 100, target_slot: 0 };
    const l2: Link = { id: 32, origin_id: 100, origin_slot: 2, target_id: 3, target_slot: 0 };

    const links: Record<number, Link> = { 30: l0, 32: l2 };
    const nodes = { 1: prodText, 2: prodStar, 3: consImg, 100: self } as Record<number, any>;
    const g = makeGraph(links, nodes);

    const node: any = {
      id: 100,
      type: 'PT_DynamicPreview',
      inputs: [ {link: 30}, {link: null}, {link: null} ],
      outputs: [ {links: []}, {links: []}, {links: [32]} ],
      size: [50, 10],
      computeSize: () => [60, 20],
      setSize: vi.fn(),
      rootGraph: g,
    };

    ApplyDynamicTypes(node);

    // First pair should become TEXT from origin endpoint
    expect(node.inputs[0].type).toBe('TEXT');
    expect(node.outputs[0].type).toBe('TEXT');

    // Second pair remains *
    expect(node.inputs[1].type).toBe('*');
    expect(node.outputs[1].type).toBe('*');

    // Third pair should become IMAGE from consumer input side
    expect(node.inputs[2].type).toBe('IMAGE');
    expect(node.outputs[2].type).toBe('IMAGE');

    // Link updated for typed pair (only l2 exists here)
    expect(g.links[32].type).toBe('IMAGE');

    expect(g.setDirtyCanvas).toHaveBeenCalledWith(true, true);
    expect(node.setSize).toHaveBeenCalled();
  });
});
