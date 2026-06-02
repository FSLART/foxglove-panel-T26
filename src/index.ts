/* eslint-disable*/
import { ExtensionContext } from "@foxglove/extension";

import { initT26ShutdownPanel } from "./T-26-FoxGlove-Shutdown-Panel/T26-Shutdown-Panel";
import { initT26DynamicsPanel } from "./T-26-FoxGlove-Dynamics-Panel/T26Panel-Dynamics";
import { initT26BatteryMotorPanel } from "./T-26-FoxGlove-Battery-Motor-Panel/T26Panel-BatteryMotor";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "T26-shutdown-panel", initPanel: initT26ShutdownPanel });
  extensionContext.registerPanel({ name: "T26-dynamics-panel", initPanel: initT26DynamicsPanel });
  extensionContext.registerPanel({ name: "T26-battery-motor-panel", initPanel: initT26BatteryMotorPanel });
}
