/* eslint-disable*/
import { ExtensionContext } from "@foxglove/extension";

import { initT26ShutdownPanel } from "./T-26-FoxGlove-Shutdown-Panel/T26-Shutdown-Panel";
import { initT26DynamicsPanel } from "./T-26-FoxGlove-Dynamics-Panel/T26Panel-Dynamics";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "T26-shutdown-panel", initPanel: initT26ShutdownPanel });
  extensionContext.registerPanel({ name: "T26-dynamics-panel", initPanel: initT26DynamicsPanel });
}
