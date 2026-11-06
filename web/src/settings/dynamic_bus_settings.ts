import {app} from 'scripts/app.js';

const SETTING_IDS = {
	BUS_OVERWRITE: "Tojioo.DynamicBus.OverwriteMode",
} as const;

export const dynamicBusOverwrite: any = {
	id: SETTING_IDS.BUS_OVERWRITE,
	name: "Overwrite matching bus types",
	type: "boolean",
	defaultValue: false,
	tooltip: "When enabled, a local input whose type already exists on the upstream bus will replace the first matching entry instead of appending.",
	category: ["Tojioo Passthrough", "Dynamic Bus", "Overwrite matching types"],
	onChange: (newVal: boolean) =>
	{
		const graph = app.rootGraph;
		if (!graph)
		{
			return;
		}

		const value = newVal ? "1" : "0";
		const subgraphNodes = [...(graph.subgraphs?.values() ?? [])].flatMap((sg: any) => sg._nodes ?? []);
		for (const node of [...(graph._nodes ?? []), ...subgraphNodes])
		{
			if (node.type !== "PT_DynamicBus")
			{
				continue;
			}
			const widget = node.widgets?.find((w: any) => w.name === "_overwrite_mode");
			if (widget)
			{
				widget.value = value;
			}
			// Needed: the bus type map depends on the mode, and the setting store already holds the new value here.
			node.onBusChanged?.();
		}
	},
};

export function getBusOverwriteMode(): boolean
{
	return app.extensionManager?.setting?.get(SETTING_IDS.BUS_OVERWRITE) ?? false;
}