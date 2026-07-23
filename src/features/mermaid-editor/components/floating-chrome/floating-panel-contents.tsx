import type { ReactNode } from "react";

import type { FloatingPanelKind, FloatingPanelPlacement } from "@/features/mermaid-editor/lib/floating-chrome";
import { cn } from "@/lib/utils";

import {
  FLOATING_PANEL_RESIZE_HANDLES,
  floatingPanelAnchorClass,
  floatingPanelResizeHandleClass,
  floatingPanelSurfaceClass
} from "./shared";
import type { useFloatingPanelController } from "./use-floating-panel-controller";
import {
  WORKSPACE_PANEL_HEADER_HOT_ZONE_PX,
  WorkspacePanelHeaderProvider,
  type useWorkspacePanelHeaderAutoHide
} from "./workspace-panel-header-context";

type FloatingPanelController = ReturnType<typeof useFloatingPanelController>;
type WorkspaceHeader = ReturnType<typeof useWorkspacePanelHeaderAutoHide>;

export function FloatingPanelContents({
  panel,
  workspaceHeader,
  kind,
  placement,
  open,
  active,
  className,
  children
}: {
  panel: FloatingPanelController;
  workspaceHeader: WorkspaceHeader;
  kind: FloatingPanelKind;
  placement: FloatingPanelPlacement;
  open: boolean;
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(panel.framePanel && "h-full w-full", !panel.framePanel && floatingPanelAnchorClass[placement])}>
    <div
      ref={panel.surfaceRef}
      className={cn(
        "relative",
        kind !== "workspace" && "will-change-transform",
        kind === "workspace" && "isolate z-0",
        floatingPanelSurfaceClass[kind],
        panel.framePanel && "h-full w-full",
        panel.fullscreen && "!rounded-none !border-0 !shadow-none",
        kind === "workspace" && active && "border-foreground/20",
        kind === "workspace" && !active && "border-border/80",
        open ? "pointer-events-auto" : "pointer-events-none",
        className
      )}
      style={{ opacity: open ? 1 : 0 }}
    >
      <WorkspacePanelHeaderProvider value={workspaceHeader}>
        {workspaceHeader?.autoHide ? <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-[3] cursor-grab touch-none active:cursor-grabbing"
          style={{ height: WORKSPACE_PANEL_HEADER_HOT_ZONE_PX }}
          data-floating-panel-header-hot-zone
          data-floating-panel-drag-handle
          onPointerEnter={workspaceHeader.showFromHotZone}
          onPointerLeave={workspaceHeader.leaveHotZone}
        /> : null}
        {children}
      </WorkspacePanelHeaderProvider>
      {panel.framePanel && panel.resizablePanel && !panel.fullscreen ? <div className="pointer-events-none absolute inset-0" aria-hidden data-floating-panel-drag-exclude>
        {FLOATING_PANEL_RESIZE_HANDLES.map((handle) => <div
          key={handle}
          className={cn("pointer-events-auto absolute z-[2] touch-none", floatingPanelResizeHandleClass[handle])}
          data-floating-panel-resize-handle={handle}
          onPointerDown={(event) => panel.startResize(event, handle)}
        />)}
      </div> : null}
    </div>
  </div>;
}
