import { useId, type AriaRole, type ReactNode } from "react";

import type {
  FloatingPanelDismissMode,
  FloatingPanelKind,
  FloatingPanelPlacement,
  FloatingPanelSize,
  FloatingPanelWindowState
} from "@/features/mermaid-editor/lib/floating-chrome";
import { OverlayLayerScopeProvider, useOverlayLayerScope } from "@/lib/overlay-layer-context";
import { cn } from "@/lib/utils";

import { floatingPanelPlacementClass } from "./shared";
import { FloatingPanelContents } from "./floating-panel-contents";
import { useFloatingPanelController } from "./use-floating-panel-controller";
import { useWorkspacePanelHeaderAutoHide } from "./workspace-panel-header-context";

export function FloatingPanel({
  open,
  placement,
  kind = "popover",
  dismissMode,
  draggable,
  resizable,
  minSize,
  defaultSize,
  fullscreenable,
  windowState = "normal",
  onWindowStateChange,
  panelId,
  titlebarAutoHide = true,
  active = false,
  stackIndex = 0,
  onFocusPanel,
  resetDragOnOpen = true,
  mountStrategy = "unmount",
  frameClassName,
  className,
  role,
  ariaLabelledBy,
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
  fullscreenable?: boolean;
  windowState?: FloatingPanelWindowState;
  onWindowStateChange?: (state: FloatingPanelWindowState) => void;
  panelId?: string;
  titlebarAutoHide?: boolean;
  active?: boolean;
  stackIndex?: number;
  onFocusPanel?: () => void;
  resetDragOnOpen?: boolean;
  mountStrategy?: "unmount" | "keep-alive";
  frameClassName?: string;
  className?: string;
  role?: AriaRole;
  ariaLabelledBy?: string;
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
    fullscreenable,
    windowState,
    onWindowStateChange,
    stackIndex,
    onFocusPanel,
    resetDragOnOpen,
    mountStrategy
  });
  const workspaceHeader = useWorkspacePanelHeaderAutoHide({ enabled: kind === "workspace", open, dragging: panel.dragging, autoHide: titlebarAutoHide });
  const parentOverlayScope = useOverlayLayerScope();
  const generatedScopeId = useId().replaceAll(":", "");
  const overlayScopeId = kind === "workspace"
    ? `workspace:${panelId || generatedScopeId}`
    : parentOverlayScope.scopeId;

  if (!panel.mounted) return null;

  const panelContents = <FloatingPanelContents
    panel={panel}
    workspaceHeader={workspaceHeader}
    kind={kind}
    placement={placement}
    open={open}
    active={active}
    className={className}
  >{children}</FloatingPanelContents>;

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
      data-floating-panel-titlebar-auto-hide={workspaceHeader ? (workspaceHeader.autoHide ? "true" : "false") : undefined}
      data-overlay-layer={kind === "popover" && open ? "floating-popover" : undefined}
      data-overlay-scope-id={overlayScopeId}
      aria-hidden={!open || undefined}
      inert={!open || undefined}
      role={role}
      aria-labelledby={ariaLabelledBy}
    >
      {kind === "workspace" ? (
        <OverlayLayerScopeProvider scopeId={overlayScopeId} kind="workspace">
          {panelContents}
        </OverlayLayerScopeProvider>
      ) : panelContents}
    </div>
  );
}
