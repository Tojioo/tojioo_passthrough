import {configureBatchSwitchNodes, configureDynamicBus, configureDynamicPassthrough, configureDynamicPreview, configureDynamicAny, configureSwitchNodes} from '@/handlers';
import {InstallGraphLoadingHook, RegisterSlotMenuEntries} from '@/utils';
import {app} from 'scripts/app.js';

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