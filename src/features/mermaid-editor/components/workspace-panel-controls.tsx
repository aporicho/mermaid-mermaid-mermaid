import type { ReactNode } from "react";
import { Maximize, Xmark } from "iconoir-react/regular";

import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";

export function WorkspacePanelControls({
  windowState,
  onWindowStateChange,
  onClose,
  closeLabel,
  closeTooltipSide,
  closeIcon
}: {
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onClose: () => void;
  closeLabel: string;
  closeTooltipSide: "top" | "right" | "bottom" | "left";
  closeIcon: ReactNode;
}) {
  const maximized = windowState === "maximized";

  return (
    <div className="flex shrink-0 items-center gap-1" data-floating-panel-drag-exclude>
      <EditorIconButton
            context="panel"
            label={maximized ? "还原" : "最大化"}
            tooltipSide={closeTooltipSide}
            onClick={() => onWindowStateChange(maximized ? "normal" : "maximized")}
          >
            <Maximize />
      </EditorIconButton>
      <EditorIconButton context="panel" label={closeLabel} tooltipSide={closeTooltipSide} onClick={onClose}>
            {closeIcon}
      </EditorIconButton>
    </div>
  );
}

export function WorkspacePanelHeader({
  windowState,
  onWindowStateChange,
  onCollapse
}: {
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onCollapse: () => void;
}) {
  return (
    <div className="absolute right-2 top-2 z-30">
      <WorkspacePanelControls
        windowState={windowState}
        onWindowStateChange={onWindowStateChange}
        onClose={onCollapse}
        closeLabel="关闭检查器"
        closeTooltipSide="left"
        closeIcon={<Xmark />}
      />
    </div>
  );
}
