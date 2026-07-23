import { useId, type ReactNode } from "react";
import { Collapse, Expand, Pin, PinSlash, Xmark } from "iconoir-react/regular";

import { EditorIconButton, WindowTitlebarLayout } from "@/features/mermaid-editor/components/editor-ui";
import type {
  FloatingPanelPlacement,
  FloatingPanelSize,
  FloatingPanelWindowState
} from "@/features/mermaid-editor/lib/floating-chrome";
import { cn } from "@/lib/utils";

import { FloatingPanel } from "./floating-panel";
import { useWorkspacePanelHeader } from "./workspace-panel-header-context";
import {
  WorkspaceWindowChromeContext,
  useWorkspaceWindowChrome,
  type WorkspaceWindowChrome
} from "./workspace-window-chrome-context";

export function WorkspaceFloatingWindow({
  open,
  panelId,
  placement,
  titlebarAutoHide,
  active,
  stackIndex,
  onFocusPanel,
  defaultSize,
  minSize,
  windowState,
  onWindowStateChange,
  onClose,
  closeLabel,
  tooltipSide = "top",
  allowFullscreen = true,
  resizable = true,
  mountStrategy = "unmount",
  className,
  children
}: {
  open: boolean;
  panelId: string;
  placement: FloatingPanelPlacement;
  titlebarAutoHide: boolean;
  active: boolean;
  stackIndex: number;
  onFocusPanel: () => void;
  defaultSize: FloatingPanelSize;
  minSize: FloatingPanelSize;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onClose: () => void;
  closeLabel: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  allowFullscreen?: boolean;
  resizable?: boolean;
  mountStrategy?: "unmount" | "keep-alive";
  className?: string;
  children: ReactNode;
}) {
  const titleId = `workspace-window-${useId().replaceAll(":", "")}-title`;
  const chrome: WorkspaceWindowChrome = {
    titleId,
    allowFullscreen,
    windowState,
    onWindowStateChange,
    onClose,
    closeLabel,
    tooltipSide
  };

  return (
    <FloatingPanel
      open={open}
      placement={placement}
      kind="workspace"
      dismissMode="explicit"
      draggable
      resizable={resizable}
      fullscreenable={allowFullscreen}
      panelId={panelId}
      titlebarAutoHide={titlebarAutoHide}
      active={active}
      stackIndex={stackIndex}
      onFocusPanel={onFocusPanel}
      resetDragOnOpen={false}
      mountStrategy={mountStrategy}
      defaultSize={defaultSize}
      minSize={minSize}
      windowState={windowState}
      onWindowStateChange={onWindowStateChange}
      role="region"
      ariaLabelledBy={titleId}
      className={cn("relative grid h-full w-full min-h-0 overflow-hidden", className)}
    >
      <WorkspaceWindowChromeContext.Provider value={chrome}>
        {children}
      </WorkspaceWindowChromeContext.Provider>
    </FloatingPanel>
  );
}

export function WorkspaceWindowHeader({
  leadingActions,
  icon,
  title,
  status,
  center,
  actions,
  titleTooltip,
  className
}: {
  leadingActions?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  status?: ReactNode;
  center?: ReactNode;
  actions?: ReactNode;
  titleTooltip?: string;
  className?: string;
}) {
  const chrome = useWorkspaceWindowChrome();
  const workspaceHeader = useWorkspacePanelHeader();
  if (!chrome || !workspaceHeader) throw new Error("WorkspaceWindowHeader must be rendered inside WorkspaceFloatingWindow.");
  const fullscreen = chrome.windowState === "fullscreen";

  return (
    <WindowTitlebarLayout
      leadingActions={leadingActions}
      icon={icon}
      title={title}
      status={status}
      center={center}
      actions={
        <>
          {actions}
          <EditorIconButton
            context="panel"
            label={workspaceHeader.autoHide ? "固定标题栏" : "启用自动隐藏"}
            tooltipSide={chrome.tooltipSide}
            pressed={!workspaceHeader.autoHide}
            onClick={workspaceHeader.toggleAutoHideOverride}
            data-workspace-panel-titlebar-override={workspaceHeader.overridden ? "true" : "false"}
          >
            {workspaceHeader.autoHide ? <Pin /> : <PinSlash />}
          </EditorIconButton>
          {chrome.allowFullscreen ? (
            <EditorIconButton
              context="panel"
              label={fullscreen ? "退出全屏" : "全屏"}
              tooltipSide={chrome.tooltipSide}
              onClick={() => chrome.onWindowStateChange(fullscreen ? "normal" : "fullscreen")}
            >
              {fullscreen ? <Collapse /> : <Expand />}
            </EditorIconButton>
          ) : null}
          <EditorIconButton context="panel" label={chrome.closeLabel} tooltipSide={chrome.tooltipSide} onClick={chrome.onClose}>
            <Xmark />
          </EditorIconButton>
        </>
      }
      titleId={chrome.titleId}
      titleTooltip={titleTooltip}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        workspaceHeader.autoHide && "absolute inset-x-0 top-0 z-30 bg-card/[var(--ui-surface-opacity)] shadow-[var(--ui-shadow-toolbar)] [backdrop-filter:blur(var(--ui-backdrop-blur))] transition-[opacity,transform] [transition-duration:var(--motion-duration-fast)] ease-out motion-reduce:transition-none",
        workspaceHeader.autoHide && (workspaceHeader.visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"),
        className
      )}
      data-floating-panel-drag-handle
      data-workspace-panel-header="true"
      data-workspace-panel-header-mode={workspaceHeader.autoHide ? "auto-hide" : "fixed"}
      data-workspace-panel-header-state={workspaceHeader.autoHide ? (workspaceHeader.visible ? "visible" : "hidden") : "fixed"}
      onPointerEnter={workspaceHeader.onHeaderPointerEnter}
      onPointerLeave={workspaceHeader.onHeaderPointerLeave}
      onFocusCapture={workspaceHeader.onHeaderFocusCapture}
      onBlurCapture={workspaceHeader.onHeaderBlurCapture}
    />
  );
}
