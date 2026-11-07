import {describe, expect, it} from 'vitest';

import {configureDynamicBus, configureDynamicPassthrough} from '../src/handlers';
import {installTestGlobals} from './helpers/factories';
import {addFreshNode, DYNAMIC_BUS, DYNAMIC_PASSTHROUGH, makeSizedHarness, settle, slotHeight} from './helpers/comfy_node_size';

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
