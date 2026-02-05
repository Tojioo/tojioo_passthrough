export const LG_NODE_SLOT_HEIGHT = 20;
export const LG_OUTPUT = 2;
export const LG_INPUT = 1;

export function getLiteGraph(): any | null
{
	if (typeof LiteGraph !== "undefined")
	{
		return LiteGraph;
	}
	if (typeof window !== "undefined" && (window as any).LiteGraph)
	{
		return (window as any).LiteGraph;
	}
	return null;
}

export function GetLgInput(): number
{
	const lg = getLiteGraph();
	return lg?.INPUT ?? LG_INPUT;
}

export function GetLgOutput(): number
{
	const lg = getLiteGraph();
	return lg?.OUTPUT ?? LG_OUTPUT;
}

export function GetLgSlotHeight(): number
{
	const lg = getLiteGraph();
	return lg?.NODE_SLOT_HEIGHT ?? LG_NODE_SLOT_HEIGHT;
}

export function IsNodes2Mode(): boolean
{
	try
	{
		const app = (window as any).app;
		if (app?.extensionManager?.setting?.get)
		{
			const setting = app.extensionManager.setting.get("Comfy.UseNewMenu");
			if (setting === "Top" || setting === "Bottom")
			{
				return true;
			}
		}

		const lg = getLiteGraph();
		if (!lg)
		{
			return true;
		}

		if (typeof document !== "undefined")
		{
			const vueCanvas = document.querySelector("[data-comfy-graph-canvas]");
			if (vueCanvas)
			{
				return true;
			}
		}
	}
	catch
	{
		// Assume legacy mode on error
	}
	return false;
}