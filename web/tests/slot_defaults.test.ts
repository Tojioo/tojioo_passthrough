import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

let core: any;

// Assumption: mirrors setDefaults of core Comfy.SlotDefaults in frontend 1.58.5, which replaces both registries.
function makeCoreSlotDefaults(): any
{
	return {
		name: "Comfy.SlotDefaults",
		slot_types_default_out: {IMAGE: ["Reroute", "PreviewImage"]},
		slot_types_default_in: {IMAGE: ["Reroute", "LoadImage"]},
		setDefaults(maxNum?: number | null)
		{
			const lg = (globalThis as any).LiteGraph;
			lg.slot_types_default_out = {};
			lg.slot_types_default_in = {};
			for (const type in this.slot_types_default_out)
			{
				lg.slot_types_default_out[type] = this.slot_types_default_out[type].slice(0, maxNum ?? undefined);
			}
			for (const type in this.slot_types_default_in)
			{
				lg.slot_types_default_in[type] = this.slot_types_default_in[type].slice(0, maxNum ?? undefined);
			}
		},
	};
}

beforeEach(async () =>
{
	vi.resetModules();
	// Needed: the slot menu starts a frame loop, which must not run synchronously here.
	(globalThis as any).requestAnimationFrame = () => 0;
	(globalThis as any).LiteGraph = {INPUT: 1, OUTPUT: 2, createNode: vi.fn()};
	const {app} = await import('scripts/app.js');
	core = makeCoreSlotDefaults();
	app.extensions = [core];
	core.setDefaults(5);
});

afterEach(() =>
{
	delete (globalThis as any).LiteGraph;
});

describe("slot menu defaults", () =>
{
	it("survive the core slot defaults being rebuilt", async () =>
	{
		const utils = await import('../src/utils');
		utils.configureSlotMenu(["IMAGE"], ["PT_DynamicAny", "Dynamic Any"]);

		core.setDefaults(5);

		const lg = (globalThis as any).LiteGraph;
		expect(lg.slot_types_default_out.IMAGE).toEqual(["Reroute", "PreviewImage", "Dynamic Any"]);
		expect(lg.slot_types_default_in.IMAGE).toEqual(["Reroute", "LoadImage", "Dynamic Any"]);
	});
});
