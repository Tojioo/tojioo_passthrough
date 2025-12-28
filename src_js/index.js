import {app} from "../../scripts/app.js"

import {configureDynamicPassthrough} from "./handlers/dynamic_passthrough.js"
import {configureDynamicBus} from "./handlers/dynamic_bus.js"
import {configureDynamicSingle} from "./handlers/dynamic_single.js"
import {configureDynamicPreview} from "./handlers/dynamic_preview.js"
import {configureBatchSwitch} from "./handlers/batch_switch.js"
import {configureSwitch} from "./handlers/switch.js"

app.registerExtension(configureDynamicPassthrough())
app.registerExtension(configureDynamicBus())
app.registerExtension(configureDynamicSingle())
app.registerExtension(configureDynamicPreview())
app.registerExtension(configureBatchSwitch())
app.registerExtension(configureSwitch())