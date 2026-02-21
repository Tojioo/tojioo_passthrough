import {configureBatchSwitchNodes, configureDynamicBus, configureDynamicPassthrough, configureDynamicPreview, configureDynamicAny, configureSwitchNodes} from '@/handlers';
import {InstallGraphLoadingHook, configureSlotMenu} from '@/utils';
import {app} from 'scripts/app.js';
import {logger_internal} from '@/logger_internal.ts';

app.registerExtension({
	name: "Tojioo.Passthrough.Core",
	async setup()
	{
		InstallGraphLoadingHook(app);
		configureSlotMenu("BUS", "PT_DynamicBus", "Dynamic Bus");
		configureSlotMenu(
			["IMAGE", "MASK", "LATENT", "CONDITIONING", "CLIP", "MODEL", "VAE", "STRING", "INT", "FLOAT", "BOOLEAN"],
			["PT_DynamicPreview", "Dynamic Preview"]
		);
		logger_internal.log(`Loaded Version ${__VERSION__}`);
	}
});

app.registerExtension(configureBatchSwitchNodes());
app.registerExtension(configureDynamicBus());
app.registerExtension(configureDynamicPassthrough());
app.registerExtension(configureDynamicPreview());
app.registerExtension(configureDynamicAny());
app.registerExtension(configureSwitchNodes());