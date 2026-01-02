import {InstallGraphLoadingHook} from '@/utils/lifecycle.ts';
import {app} from 'scripts/app.js';

import {configureBatchSwitchNodes} from '@/handlers/batch_switch';
import {configureDynamicBus} from '@/handlers/dynamic_bus';
import {configureDynamicPassthrough} from '@/handlers/dynamic_passthrough';
import {configureDynamicPreview} from '@/handlers/dynamic_preview';
import {configureDynamicSingle} from '@/handlers/dynamic_single';
import {configureSwitchNodes} from '@/handlers/switch';

InstallGraphLoadingHook(app);

app.registerExtension(configureBatchSwitchNodes());
app.registerExtension(configureDynamicBus());
app.registerExtension(configureDynamicPassthrough());
app.registerExtension(configureDynamicPreview());
app.registerExtension(configureDynamicSingle());
app.registerExtension(configureSwitchNodes());
