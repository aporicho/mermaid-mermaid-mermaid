"use client";

import { Refresh as RefreshCw, SidebarCollapse as PanelLeftClose } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DiagnosticPanel } from "@/features/mermaid-editor/components/diagnostic-panel";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { cn } from "@/lib/utils";

type SourcePanelProps = {
  value: string;
  title?: string;
  className?: string;
  diagnostics?: EditorDiagnostic[];
  onChange: (value: string) => void;
  onRun: () => void;
  onCollapse?: () => void;
};

export function SourcePanel({ value, title = "Mermaid", className, diagnostics = [], onChange, onRun, onCollapse }: SourcePanelProps) {
  return (
    <section className={cn("relative z-10 grid h-full min-h-0 grid-rows-[42px_minmax(0,1fr)_auto] border-r bg-card", className)}>
      <header className="flex items-center justify-between border-b bg-card/95 px-3">
        <span className="text-sm font-medium">{title}</span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} onClick={onRun} aria-label="刷新画布">
                <RefreshCw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">刷新画布</TooltipContent>
          </Tooltip>
          {onCollapse ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} onClick={onCollapse} aria-label="收起 Mermaid 面板">
                  <PanelLeftClose className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">收起 Mermaid 面板</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </header>
      <Textarea
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            onRun();
          }
        }}
        className="source-grid h-full resize-none rounded-none border-0 p-4 font-mono text-sm leading-[30px] shadow-none focus-visible:ring-0"
      />
      <DiagnosticPanel diagnostics={diagnostics} compact />
    </section>
  );
}
