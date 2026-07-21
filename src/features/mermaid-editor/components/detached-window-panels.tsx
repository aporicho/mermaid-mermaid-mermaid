import { FloppyDisk, Text, Xmark } from "iconoir-react/regular";

import { EditorIconButton, EditorPanelHeader } from "@/features/mermaid-editor/components/editor-ui";
import { MarkdownPanel } from "@/features/mermaid-editor/components/markdown-panel";
import { WorkspacePanelControls } from "@/features/mermaid-editor/components/workspace-panel-controls";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";

export function MarkdownWindowPanel({
  title,
  path,
  value,
  dirty,
  spellCheck,
  contentWidth,
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
  spellCheck: boolean;
  contentWidth: number;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onClose: () => void;
  onSave: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-card/[var(--ui-surface-opacity)]">
      <EditorPanelHeader
        icon={<Text className="editor-ui-icon shrink-0 text-icon" />}
        title={<span className="flex min-w-0 items-center gap-1" title={path || title}><span className="truncate">{title}</span>{dirty ? <span className="size-1.5 shrink-0 bg-foreground/60" aria-hidden /> : null}</span>}
        actions={<div className="flex shrink-0 items-center gap-1">
          <EditorIconButton context="panel" label="保存 Markdown 窗口" tooltipSide="top" onClick={onSave}><FloppyDisk /></EditorIconButton>
          <WorkspacePanelControls
            windowState={windowState}
            onWindowStateChange={onWindowStateChange}
            onClose={onClose}
            closeLabel="关闭 Markdown 窗口"
            closeTooltipSide="top"
            closeIcon={<Xmark />}
          />
        </div>}
      />
      <MarkdownPanel
        key={`${title}:markdown-window`}
        value={value}
        spellCheck={spellCheck}
        contentWidth={contentWidth}
        onChange={onChange}
        className="markdown-editor-panel--window bg-background/95"
      />
    </section>
  );
}
