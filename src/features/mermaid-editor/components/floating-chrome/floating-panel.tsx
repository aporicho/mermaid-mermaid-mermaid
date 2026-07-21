import type { ReactNode } from "react";

import type {
  FloatingPanelDismissMode,
  FloatingPanelKind,
  FloatingPanelPlacement,
  FloatingPanelSize,
  FloatingPanelWindowState
} from "@/features/mermaid-editor/lib/floating-chrome";
import { cn } from "@/lib/utils";

import {
  FLOATING_PANEL_RESIZE_HANDLES,
  floatingPanelAnchorClass,
  floatingPanelPlacementClass,
  floatingPanelResizeHandleClass,
  floatingPanelSurfaceClass
} from "./shared";
import { useFloatingPanelController } from "./use-floating-panel-controller";

export function FloatingPanel({
  open,
  placement,
  kind = "popover",
  dismissMode,
  draggable,
  resizable,
  minSize,
  defaultSize,
  maximizable,
  windowState = "normal",
  onWindowStateChange,
  panelId,
  active = false,
  stackIndex = 0,
  onFocusPanel,
  resetDragOnOpen = true,
  frameClassName,
  className,
  children
}: {
  open: boolean;
  placement: FloatingPanelPlacement;
  kind?: FloatingPanelKind;
  dismissMode?: FloatingPanelDismissMode;
  draggable?: boolean;
  resizable?: boolean;
  minSize?: FloatingPanelSize;
  defaultSize?: FloatingPanelSize;
  maximizable?: boolean;
  windowState?: FloatingPanelWindowState;
  onWindowStateChange?: (state: FloatingPanelWindowState) => void;
  panelId?: string;
  active?: boolean;
  stackIndex?: number;
  onFocusPanel?: () => void;
  resetDragOnOpen?: boolean;
  frameClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const panel = useFloatingPanelController({
    open,
    placement,
    kind,
    dismissMode,
    draggable,
    resizable,
    minSize,
    defaultSize,
    maximizable,
    windowState,
    onWindowStateChange,
    stackIndex,
    onFocusPanel,
    resetDragOnOpen
  });

  if (!panel.mounted) return null;

  return (
    <div
      ref={panel.rootRef}
      className={cn(
        "pointer-events-auto absolute",
        !panel.framePanel && "will-change-transform",
        !panel.framePanel && floatingPanelPlacementClass[placement],
        !open && "pointer-events-none",
        (panel.dragging || panel.resizing) && "select-none",
        !panel.framePanel && frameClassName
      )}
      style={panel.rootStyle}
      onPointerDownCapture={panel.pointerDown}
      onPointerMove={panel.pointerMove}
      onPointerUp={panel.pointerEnd}
      onPointerCancel={panel.pointerEnd}
      onDoubleClickCapture={panel.doubleClick}
      onFocusCapture={panel.focusPanel}
      data-floating-panel-kind={kind}
      data-floating-panel-id={panelId}
      data-floating-panel-active={active ? "true" : "false"}
      data-floating-panel-dismiss-mode={panel.resolvedDismissMode}
      data-floating-panel-window-state={windowState}
    >
      <div className={cn(panel.framePanel && "h-full w-full", !panel.framePanel && floatingPanelAnchorClass[placement])}>
        <div
          ref={panel.surfaceRef}
          className={cn(
            "relative",
            kind !== "workspace" && "will-change-transform",
            floatingPanelSurfaceClass[kind],
            panel.framePanel && "h-full w-full",
            kind === "workspace" && active && "border-foreground/20",
            kind === "workspace" && !active && "border-border/80",
            open ? "pointer-events-auto" : "pointer-events-none",
            className
          )}
          style={{ opacity: open ? 1 : 0 }}
        >
          {children}
          {panel.framePanel && panel.resizablePanel && !panel.maximized ? (
            <div aria-hidden data-floating-panel-drag-exclude>
              {FLOATING_PANEL_RESIZE_HANDLES.map((handle) => (
                <div
                  key={handle}
                  className={cn("absolute z-40 touch-none", floatingPanelResizeHandleClass[handle])}
                  data-floating-panel-resize-handle={handle}
                  onPointerDown={(event) => panel.startResize(event, handle)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
