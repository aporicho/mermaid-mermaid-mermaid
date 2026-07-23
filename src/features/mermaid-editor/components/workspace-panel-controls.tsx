import type { ReactNode } from "react";
import { Collapse, Expand, Pin, PinSlash } from "iconoir-react/regular";

import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";
import { useWorkspacePanelHeader } from "@/features/mermaid-editor/components/floating-chrome/workspace-panel-header-context";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";

export function WorkspacePanelControls({
  leadingActions,
  allowFullscreen = false,
  windowState,
  onWindowStateChange,
  onClose,
  closeLabel,
  closeTooltipSide,
  closeIcon
}: {
  leadingActions?: ReactNode;
  allowFullscreen?: boolean;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onClose: () => void;
  closeLabel: string;
  closeTooltipSide: "top" | "right" | "bottom" | "left";
  closeIcon: ReactNode;
}) {
  const fullscreen = windowState === "fullscreen";
  const workspaceHeader = useWorkspacePanelHeader();

  return (
    <div className="flex shrink-0 items-center gap-1" data-floating-panel-drag-exclude>
      {leadingActions}
      {workspaceHeader ? (
        <EditorIconButton
          context="panel"
          label={workspaceHeader.autoHide ? "固定标题栏" : "启用自动隐藏"}
          tooltipSide={closeTooltipSide}
          pressed={!workspaceHeader.autoHide}
          onClick={workspaceHeader.toggleAutoHideOverride}
          data-workspace-panel-titlebar-override={workspaceHeader.overridden ? "true" : "false"}
        >
          {workspaceHeader.autoHide ? <Pin /> : <PinSlash />}
        </EditorIconButton>
      ) : null}
      {allowFullscreen ? (
        <EditorIconButton
          context="panel"
          label={fullscreen ? "退出全屏" : "全屏"}
          tooltipSide={closeTooltipSide}
          onClick={() => onWindowStateChange(fullscreen ? "normal" : "fullscreen")}
        >
          {fullscreen ? <Collapse /> : <Expand />}
        </EditorIconButton>
      ) : null}
      <EditorIconButton context="panel" label={closeLabel} tooltipSide={closeTooltipSide} onClick={onClose}>
        {closeIcon}
      </EditorIconButton>
    </div>
  );
}
