import {afterEach, describe, expect, it, vi} from 'vitest';

import {app} from 'scripts/app.js';
import {configureDynamicPreview} from '../src/handlers';
import {installTestGlobals} from './helpers/factories';
import {makeHarness} from './helpers/handler_harness';

installTestGlobals();

afterEach(() =>
{
	vi.restoreAllMocks();
	delete app.api;
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

	it("builds preview image URLs through the API base path", async () =>
	{
		const h = await makeHarness(configureDynamicPreview, {name: "PT_DynamicPreview"}, {in: 1, out: 0});
		app.api = {apiURL: (route: string) => `/comfy/api${route}`};

		h.nodeType.prototype.onExecuted.call(h.node, {preview_data: [{filename: "a b.png", subfolder: "", type: "temp", slot: 0}]});

		expect(h.node._previewItems[0].element.src).toBe("/comfy/api/view?filename=a%20b.png&subfolder=&type=temp");
	});
});
