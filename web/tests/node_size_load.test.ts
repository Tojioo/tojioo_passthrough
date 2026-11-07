import {describe, expect, it} from 'vitest';

import {configureDynamicBus, configureDynamicPassthrough} from '../src/handlers';
import {InstallGraphLoadingHook} from '../src/utils';
import {flushMicrotasks, installTestGlobals} from './helpers/factories';
import {installFrameQueue} from './helpers/animation_frames';
import {makeHarness} from './helpers/handler_harness';

installTestGlobals();

function startLoad(): () => Promise<void>
{
	const app: any = {};
	let resolve: () => void = () => {};
	app.loadGraphData = () => new Promise<void>((r) => (resolve = r));
	InstallGraphLoadingHook(app);
	const call = app.loadGraphData();
	return async () =>
	{
		resolve();
		await call;
	};
}

const cases: Array<[string, () => any, string, any]> = [
	["Dynamic Bus", configureDynamicBus, "PT_DynamicBus", {
		inputs: [{name: "bus", type: "BUS", link: null}, {name: "input_1", type: "*", link: null}],
		outputs: [{name: "bus", type: "BUS", links: null}, {name: "output_1", type: "*", links: null}],
	}],
	["Dynamic Passthrough", configureDynamicPassthrough, "PT_DynamicPassthrough", {
		inputs: [{name: "input", type: "*", link: null}],
		outputs: [{name: "output", type: "*", links: null}],
	}],
];

describe("node size after a workflow load", () =>
{
	it.each(cases)("keeps the saved size of a %s", async (_label, configure, type, slots) =>
	{
		const frames = installFrameQueue();
		const h = await makeHarness(configure, {name: type}, {in: slots.inputs.length, out: slots.outputs.length}, {type, size: [300, 200]});
		const finishLoad = startLoad();

		h.nodeType.prototype.configure.call(h.node, {id: 2, type, size: [300, 200], ...slots});
		await flushMicrotasks();
		await finishLoad();
		await flushMicrotasks();
		frames.flush();

		const sizes = h.node.setSize.mock.calls.map((c: any[]) => c[0]);
		expect(sizes.length).toBeGreaterThan(0);
		expect(sizes).toEqual(sizes.map(() => [300, 200]));
	});
});
