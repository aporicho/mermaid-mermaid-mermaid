import type {
  FloatingPanelKind,
  FloatingPanelPlacement,
  FloatingPanelResizeHandle,
  FloatingPanelSize
} from "@/features/mermaid-editor/lib/floating-chrome";

export type FloatingTooltipSide = "top" | "right" | "bottom" | "left";

export const floatingPanelPlacementClass: Record<FloatingPanelPlacement, string> = {
  "top-left": "left-0 top-16 origin-top-left",
  right: "right-0 top-16 origin-top-right",
  "bottom-left": "bottom-16 left-0 origin-bottom-left",
  "left-panel": "bottom-16 left-4 top-16 origin-left",
  "right-panel": "bottom-16 right-4 top-16 origin-right",
  "center-panel": "left-1/2 top-1/2 origin-center",
  "bottom-panel": "bottom-20 left-1/2 origin-bottom"
};

export const floatingPanelAnchorClass: Partial<Record<FloatingPanelPlacement, string>> = {
  "center-panel": "-translate-x-1/2 -translate-y-1/2",
  "bottom-panel": "-translate-x-1/2"
};

export const floatingPanelSurfaceClass: Record<FloatingPanelKind, string> = {
  popover: "editor-ui-popover p-2 text-popover-foreground",
  workspace: "editor-ui-panel text-foreground"
};

export const DEFAULT_WORKSPACE_PANEL_SIZE: FloatingPanelSize = { width: 360, height: 640 };
export const DEFAULT_WORKSPACE_PANEL_MIN_SIZE: FloatingPanelSize = { width: 320, height: 220 };
export const FLOATING_PANEL_RESIZE_HANDLES: FloatingPanelResizeHandle[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

export const floatingPanelResizeHandleClass: Record<FloatingPanelResizeHandle, string> = {
  n: "left-3 right-3 -top-1.5 h-3 cursor-ns-resize",
  ne: "-right-2 -top-2 size-4 cursor-nesw-resize",
  e: "-right-1.5 bottom-3 top-3 w-3 cursor-ew-resize",
  se: "-bottom-2 -right-2 size-4 cursor-nwse-resize",
  s: "-bottom-1.5 left-3 right-3 h-3 cursor-ns-resize",
  sw: "-bottom-2 -left-2 size-4 cursor-nesw-resize",
  w: "-left-1.5 bottom-3 top-3 w-3 cursor-ew-resize",
  nw: "-left-2 -top-2 size-4 cursor-nwse-resize"
};
