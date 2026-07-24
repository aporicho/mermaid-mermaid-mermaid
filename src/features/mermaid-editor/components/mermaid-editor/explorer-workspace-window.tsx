import type { ComponentProps } from "react";

import { ExplorerPanel } from "@/features/mermaid-editor/components/explorer-panel";
import { WorkspaceFloatingWindow } from "@/features/mermaid-editor/components/floating-chrome";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES
} from "@/features/mermaid-editor/lib/workspace-panels";
import { cn } from "@/lib/utils";

type ExplorerPanelProps = ComponentProps<typeof ExplorerPanel>;

export type ExplorerWorkspaceWindowProps = ExplorerPanelProps & {
  open: boolean;
  active: boolean;
  stackIndex: number;
  titlebarAutoHide: boolean;
  windowState: FloatingPanelWindowState;
  onFocusPanel: () => void;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onClose: () => void;
};

export function ExplorerWorkspaceWindow({
  open,
  active,
  stackIndex,
  titlebarAutoHide,
  windowState,
  onFocusPanel,
  onWindowStateChange,
  onClose,
  ...explorerProps
}: ExplorerWorkspaceWindowProps) {
  return (
    <WorkspaceFloatingWindow
      open={open}
      placement="left-panel"
      panelId="explorer"
      titlebarAutoHide={titlebarAutoHide}
      active={active}
      stackIndex={stackIndex}
      onFocusPanel={onFocusPanel}
      defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.explorer}
      minSize={WORKSPACE_PANEL_MIN_SIZES.explorer}
      allowFullscreen={false}
      windowState={windowState}
      onWindowStateChange={onWindowStateChange}
      onClose={onClose}
      closeLabel="关闭资源管理器"
      tooltipSide="right"
      className={cn(EDITOR_CHROME_CLASSES.sidePanel, "relative")}
    >
      <ExplorerPanel {...explorerProps} />
    </WorkspaceFloatingWindow>
  );
}
