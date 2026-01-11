import {InstallGraphLoadingHook} from '@/utils/lifecycle.ts';
import {RegisterSlotMenuEntries} from '@/utils/slot_menu.ts';
import {app} from 'scripts/app.js';

import {configureBatchSwitchNodes} from '@/handlers/batch_switch';
import {configureDynamicBus} from '@/handlers/dynamic_bus';
import {configureDynamicPassthrough} from '@/handlers/dynamic_passthrough';
import {configureDynamicPreview} from '@/handlers/dynamic_preview';
import {configureDynamicAny} from '@/handlers/dynamic_any.ts';
import {configureSwitchNodes} from '@/handlers/switch';

app.registerExtension({
	name: "Tojioo.Passthrough.Core",
	async setup()
	{
		InstallGraphLoadingHook(app);
		RegisterSlotMenuEntries("BUS", ["PT_DynamicBus"]);
	}
});

app.registerExtension(configureBatchSwitchNodes());
app.registerExtension(configureDynamicBus());
app.registerExtension(configureDynamicPassthrough());
app.registerExtension(configureDynamicPreview());
app.registerExtension(configureDynamicAny());
app.registerExtension(configureSwitchNodes());