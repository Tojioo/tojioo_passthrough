import {afterEach, describe, expect, it, vi} from 'vitest';

import {configureDynamicPreview} from '../src/handlers';
import {installTestGlobals} from './helpers/factories';
import {makeHarness} from './helpers/handler_harness';

installTestGlobals();

afterEach(() =>
{
	vi.restoreAllMocks();
});

describe("dynamic preview compatibility", () =>
{
	it("accepts a connection from a subgraph input without logging", async () =>
	{
		const h = await makeHarness(configureDynamicPreview, {name: "PT_DynamicPreview"}, {in: 1, out: 0});
		const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
		// Assumption: like frontend 1.58.5, SubgraphInput.connect passes its SubgraphInputNode, which has no properties.
		const subgraphInputNode = {id: -10};

		const accepted = h.nodeType.prototype.onConnectInput.call(h.node, 0, "IMAGE", {type: "IMAGE"}, subgraphInputNode, -1);
		h.nodeType.prototype.findInputSlotByType.call(h.node, "IMAGE");

		expect(accepted).toBe(true);
		expect(debug).not.toHaveBeenCalled();
	});
});
