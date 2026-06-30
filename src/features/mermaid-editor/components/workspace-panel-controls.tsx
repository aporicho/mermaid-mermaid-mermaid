import type { ReactNode } from "react";
import { Maximize, Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import { cn } from "@/lib/utils";

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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn(EDITOR_CHROME_CLASSES.panelIconButton, "bg-card/85")}
            onClick={() => onWindowStateChange(maximized ? "normal" : "maximized")}
            aria-label={maximized ? "还原面板" : "最大化面板"}
          >
            <Maximize className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={closeTooltipSide}>{maximized ? "还原面板" : "最大化面板"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className={cn(EDITOR_CHROME_CLASSES.panelIconButton, "bg-card/85")} onClick={onClose} aria-label={closeLabel}>
            {closeIcon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={closeTooltipSide}>{closeLabel}</TooltipContent>
      </Tooltip>
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
