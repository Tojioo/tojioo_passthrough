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

		// Todo: You know...
		/*try { graph = app.rootGraph ?? app.graph; } catch { return; }
		if (!graph?._nodes)
		{
			return;
		}*/

		const value = newVal ? "1" : "0";
		for (const node of graph._nodes ?? [])
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
		}
	},
};

export function getBusOverwriteMode(): boolean
{
	return app.extensionManager?.setting?.get(SETTING_IDS.BUS_OVERWRITE) ?? false;
}