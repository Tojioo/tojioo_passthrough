import {describe, expect, it} from 'vitest';

import {configureDynamicBus, configureDynamicPassthrough} from '../src/handlers';
import {installTestGlobals} from './helpers/factories';
import {addFreshNode, DYNAMIC_BUS, DYNAMIC_PASSTHROUGH, loadSavedNode, makeSizedHarness, settle, slotHeight} from './helpers/comfy_node_size';

installTestGlobals();

describe("size of a newly added node", () =>
{
	it.each([
		["Dynamic Bus", configureDynamicBus, DYNAMIC_BUS, 2],
		["Dynamic Passthrough", configureDynamicPassthrough, DYNAMIC_PASSTHROUGH, 1],
	] as const)("shrinks a new %s to fit its slots", async (_label, configure, spec, rows) =>
	{
		const h = await makeSizedHarness(configure, spec);
		expect(h.node.size).toEqual([spec.width, slotHeight(32)]);

		await addFreshNode(h);

		expect(h.node.size).toEqual([spec.width, slotHeight(rows)]);
	});

	it("shrinks a new Dynamic Bus that syncs again in the same frame", async () =>
	{
		const h = await makeSizedHarness(configureDynamicBus, DYNAMIC_BUS);

		h.node.onAdded();
		await settle();
		h.node.onBusChanged();
		h.flushFrames();

		expect(h.node.size).toEqual([DYNAMIC_BUS.width, slotHeight(2)]);
	});
});

const savedSlots: Record<string, any> = {
	PT_DynamicBus: {
		inputs: [{name: "bus", label: "bus", type: "BUS", link: null}, {name: "input_1", label: "input", type: "*", link: null}],
		outputs: [{name: "bus", label: "bus", type: "BUS", links: null}, {name: "output_1", label: "output", type: "*", links: null}],
	},
	PT_DynamicPassthrough: {
		inputs: [{name: "input", label: "input", type: "*", link: null}],
		outputs: [{name: "output", label: "output", type: "*", links: null}],
	},
};

describe("size of a node after a workflow load", () =>
{
	const cases = [
		["Dynamic Bus", configureDynamicBus, DYNAMIC_BUS, 2],
		["Dynamic Passthrough", configureDynamicPassthrough, DYNAMIC_PASSTHROUGH, 1],
	] as const;

	it.each(cases)("keeps the saved size of a resized %s", async (_label, configure, spec) =>
	{
		const h = await makeSizedHarness(configure, spec);

		await loadSavedNode(h, {id: 2, type: spec.type, size: [300, 200], ...savedSlots[spec.type]});

		expect(h.node.size).toEqual([300, 200]);
	});

	it.each(cases)("keeps the saved size of a %s that was never resized", async (_label, configure, spec, rows) =>
	{
		const h = await makeSizedHarness(configure, spec);

		await loadSavedNode(h, {id: 2, type: spec.type, size: [spec.width, slotHeight(rows)], ...savedSlots[spec.type]});

		expect(h.node.size).toEqual([spec.width, slotHeight(rows)]);
	});

	it.each(cases)("grows a %s whose saved size is too small for its slots", async (_label, configure, spec, rows) =>
	{
		const h = await makeSizedHarness(configure, spec);

		await loadSavedNode(h, {id: 2, type: spec.type, size: [100, 10], ...savedSlots[spec.type]});

		expect(h.node.size).toEqual([spec.width, slotHeight(rows)]);
	});
});
