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
		console.log(`%c[Tojioo Passthrough]%c Loaded Version ${__VERSION__}`, 'color: #00d4ff; font-weight: bold', 'color: #888');
	}
});

app.registerExtension(configureBatchSwitchNodes());
app.registerExtension(configureDynamicBus());
app.registerExtension(configureDynamicPassthrough());
app.registerExtension(configureDynamicPreview());
app.registerExtension(configureDynamicAny());
app.registerExtension(configureSwitchNodes());