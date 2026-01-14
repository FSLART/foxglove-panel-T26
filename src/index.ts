import { ExtensionContext } from "@foxglove/extension";

import { initT26Panel } from "./T26Panel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "T26-panel", initPanel: initT26Panel });
}
