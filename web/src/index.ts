import {configureBatchSwitchNodes, configureDynamicAny, configureDynamicBus, configureDynamicPassthrough, configureDynamicPreview, configureSwitchNodes} from '@/handlers';
import {configureSlotMenu, InstallGraphLoadingHook} from '@/utils';
import {app} from 'scripts/app.js';
import {dynamicBusOverwrite} from '@/settings'
import logger_internal from '@/logger_internal';

const commonTypes = ["IMAGE", "MASK", "LATENT", "CONDITIONING", "CLIP", "MODEL", "VAE", "STRING", "INT", "FLOAT", "BOOLEAN"];

app.registerExtension({
	name: "Tojioo.Passthrough.Core",
	settings: [
		dynamicBusOverwrite,
	],
	async setup()
	{
		InstallGraphLoadingHook(app);

		configureSlotMenu([...commonTypes, "BUS"], ["PT_DynamicBus", "Dynamic Bus"]);
		configureSlotMenu([...commonTypes, "BUS"], ["PT_DynamicPreview", "Dynamic Preview"]);
		configureSlotMenu(commonTypes, [
			["PT_DynamicPassthrough", "Dynamic Passthrough"],
			["PT_DynamicAny", "Dynamic Any"],
		]);
		logger_internal.log(`Loaded Version ${__VERSION__}`);
	}
});

// Dynamic nodes
app.registerExtension(configureDynamicBus());
app.registerExtension(configureDynamicPassthrough());
app.registerExtension(configureDynamicPreview());
app.registerExtension(configureDynamicAny());

// Switch nodes
app.registerExtension(configureBatchSwitchNodes());
app.registerExtension(configureSwitchNodes());