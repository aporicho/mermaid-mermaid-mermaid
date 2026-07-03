import { FloppyDisk, Text, Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MarkdownPanel } from "@/features/mermaid-editor/components/markdown-panel";
import { WorkspacePanelControls } from "@/features/mermaid-editor/components/workspace-panel-controls";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import { cn } from "@/lib/utils";

export function MarkdownWindowPanel({
  title,
  path,
  value,
  dirty,
  windowState,
  onWindowStateChange,
  onClose,
  onSave,
  onChange
}: {
  title: string;
  path?: string;
  value: string;
  dirty: boolean;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onClose: () => void;
  onSave: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <section className="grid h-full min-h-0 grid-rows-[42px_minmax(0,1fr)] bg-card/95">
      <header data-floating-panel-drag-handle className="flex min-w-0 cursor-grab items-center justify-between gap-2 border-b bg-card/95 px-3 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-2">
          <Text className="size-4 shrink-0 text-icon" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1 text-sm font-medium">
              <span className="truncate">{title}</span>
              {dirty ? <span className="size-1.5 shrink-0 rounded-full bg-foreground/60" aria-hidden /> : null}
            </div>
            <div className="truncate text-[11px] leading-4 text-muted-foreground" title={path || title}>{path || "Markdown 窗口"}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1" data-floating-panel-drag-exclude>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className={cn(EDITOR_CHROME_CLASSES.panelIconButton, "bg-card/85")} onClick={onSave} aria-label="保存 Markdown 窗口">
                <FloppyDisk className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">保存 Markdown 窗口</TooltipContent>
          </Tooltip>
          <WorkspacePanelControls
            windowState={windowState}
            onWindowStateChange={onWindowStateChange}
            onClose={onClose}
            closeLabel="关闭 Markdown 窗口"
            closeTooltipSide="top"
            closeIcon={<Xmark />}
          />
        </div>
      </header>
      <MarkdownPanel
        key={`${title}:markdown-window`}
        value={value}
        onChange={onChange}
        className="markdown-editor-panel--window bg-background/95"
      />
    </section>
  );
}
