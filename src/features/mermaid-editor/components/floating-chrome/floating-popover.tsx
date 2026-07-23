import type { ComponentProps } from "react";

import { FloatingPanel } from "./floating-panel";

export function FloatingPopover(props: Omit<ComponentProps<typeof FloatingPanel>, "kind" | "draggable" | "resizable" | "fullscreenable" | "windowState" | "onWindowStateChange" | "titlebarAutoHide">) {
  return <FloatingPanel {...props} kind="popover" draggable={false} resizable={false} fullscreenable={false} />;
}
