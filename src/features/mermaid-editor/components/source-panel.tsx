"use client";

import { Refresh as RefreshCw, SidebarCollapse as PanelLeftClose } from "iconoir-react/regular";

import { Textarea } from "@/components/ui/textarea";
import { DiagnosticPanel } from "@/features/mermaid-editor/components/diagnostic-panel";
import { EditorIconButton, EditorPanelHeader } from "@/features/mermaid-editor/components/editor-ui";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { RuntimeAgentTextSelection } from "@/features/mermaid-editor/lib/editor-runtime";
import { cn } from "@/lib/utils";

type SourcePanelProps = {
  value: string;
  title?: string;
  className?: string;
  diagnostics?: EditorDiagnostic[];
  onChange: (value: string) => void;
  onSelectionChange?: (selection: RuntimeAgentTextSelection | null) => void;
  onRun?: () => void;
  onCollapse?: () => void;
};

export function SourcePanel({ value, title = "Mermaid", className, diagnostics = [], onChange, onSelectionChange, onRun, onCollapse }: SourcePanelProps) {
  function reportSelection(target: HTMLTextAreaElement) {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    onSelectionChange?.(end > start ? {
      kind: "text",
      start,
      end,
      text: target.value.slice(start, end),
      surroundingText: target.value.slice(Math.max(0, start - 240), Math.min(target.value.length, end + 240))
    } : null);
  }

  return (
    <section className={cn("relative z-10 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] border-r bg-card", className)}>
      <EditorPanelHeader title={title} draggable={false} actions={<div className="flex items-center gap-1">
          {onRun ? (
            <EditorIconButton context="panel" label="刷新画布" tooltipSide="right" onClick={onRun}><RefreshCw /></EditorIconButton>
          ) : null}
          {onCollapse ? (
            <EditorIconButton context="panel" label="收起源码面板" tooltipSide="right" onClick={onCollapse}><PanelLeftClose /></EditorIconButton>
          ) : null}
        </div>} />
      <Textarea
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onSelect={(event) => reportSelection(event.currentTarget)}
        onBlur={() => onSelectionChange?.(null)}
        onKeyDown={(event) => {
          if (onRun && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            onRun();
          }
        }}
        className="source-grid h-full resize-none rounded-none border-0 p-4 shadow-none focus-visible:ring-0"
      />
      <DiagnosticPanel diagnostics={diagnostics} compact />
    </section>
  );
}
