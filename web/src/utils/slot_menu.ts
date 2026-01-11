import {getLiteGraph} from './compat';

interface SlotMenuConfig
{
	type: string;
	nodeTypes: string[];
}

export function RegisterSlotMenuEntries(type: string, nodeTypes: string[]): void
{
	const lg = getLiteGraph();
	if (!lg)
	{
		return;
	}

	if (!lg.slot_types_default_out)
	{
		lg.slot_types_default_out = {};
	}
	if (!lg.slot_types_default_in)
	{
		lg.slot_types_default_in = {};
	}

	if (!lg.slot_types_default_out[type])
	{
		lg.slot_types_default_out[type] = [];
	}
	if (!lg.slot_types_default_in[type])
	{
		lg.slot_types_default_in[type] = [];
	}

	for (const nodeType of nodeTypes)
	{
		if (!lg.slot_types_default_out[type].includes(nodeType))
		{
			lg.slot_types_default_out[type].push(nodeType);
		}
		if (!lg.slot_types_default_in[type].includes(nodeType))
		{
			lg.slot_types_default_in[type].push(nodeType);
		}
	}
}

export function RegisterSlotMenuEntriesBulk(configs: SlotMenuConfig[]): void
{
	for (const config of configs)
	{
		RegisterSlotMenuEntries(config.type, config.nodeTypes);
	}
}