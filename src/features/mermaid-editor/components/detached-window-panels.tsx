import type { KeyboardEvent } from "react";
import { FloppyDisk, Text, ZoomIn, ZoomOut } from "iconoir-react/regular";

import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import { MarkdownPanel } from "@/features/mermaid-editor/components/markdown-panel";
import {
  MARKDOWN_TEXT_SCALE_MAX,
  MARKDOWN_TEXT_SCALE_MIN,
  adjustMarkdownTextScale,
  clampMarkdownTextScale,
  markdownTextScalePercent
} from "@/features/mermaid-editor/lib/markdown-text-scale";
import type { MarkdownFoldSnapshot } from "@/features/mermaid-editor/lib/markdown-fold-state";
import type { RuntimeAgentTextSelection } from "@/features/mermaid-editor/lib/editor-runtime";

export function MarkdownWindowPanel({
  title,
  path,
  value,
  dirty,
  spellCheck,
  contentWidth,
  textScale,
  onSave,
  onTextScaleChange,
  foldState,
  onFoldStateChange,
  onChange,
  onSelectionChange
}: {
  title: string;
  path?: string;
  value: string;
  dirty: boolean;
  spellCheck: boolean;
  contentWidth: number;
  textScale: number;
  onSave: () => void;
  onTextScaleChange: (value: number) => void;
  foldState?: MarkdownFoldSnapshot | null;
  onFoldStateChange?: (snapshot: MarkdownFoldSnapshot) => void;
  onChange: (value: string) => void;
  onSelectionChange?: (selection: RuntimeAgentTextSelection | null) => void;
}) {
  const normalizedTextScale = clampMarkdownTextScale(textScale);
  const textScalePercent = markdownTextScalePercent(normalizedTextScale);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (
      event.key.toLowerCase() !== "s"
      || (!event.ctrlKey && !event.metaKey)
      || event.shiftKey
      || event.altKey
    ) return;

    event.preventDefault();
    event.stopPropagation();
    onSave();
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-card/[var(--ui-surface-opacity)]"
      onKeyDownCapture={handleKeyDown}
    >
      <WorkspaceWindowHeader
        icon={<Text className="editor-ui-icon shrink-0 text-icon" />}
        title={<span className="flex min-w-0 items-center gap-1" title={path || title}><span className="truncate">{title}</span>{dirty ? <span className="size-1.5 shrink-0 bg-foreground/60" aria-hidden /> : null}</span>}
        actions={<>
          <EditorIconButton
            context="panel"
            label={`缩小 Markdown 文字（当前 ${textScalePercent}）`}
            tooltipSide="top"
            disabled={normalizedTextScale <= MARKDOWN_TEXT_SCALE_MIN}
            onClick={() => onTextScaleChange(adjustMarkdownTextScale(normalizedTextScale, -1))}
          ><ZoomOut /></EditorIconButton>
          <EditorIconButton
            context="panel"
            label={`放大 Markdown 文字（当前 ${textScalePercent}）`}
            tooltipSide="top"
            disabled={normalizedTextScale >= MARKDOWN_TEXT_SCALE_MAX}
            onClick={() => onTextScaleChange(adjustMarkdownTextScale(normalizedTextScale, 1))}
          ><ZoomIn /></EditorIconButton>
          <EditorIconButton context="panel" label="保存 Markdown 窗口" tooltipSide="top" onClick={onSave}><FloppyDisk /></EditorIconButton>
        </>}
      />
      <MarkdownPanel
        key={`${title}:markdown-window`}
        value={value}
        spellCheck={spellCheck}
        contentWidth={contentWidth}
        textScale={normalizedTextScale}
        foldState={foldState}
        onFoldStateChange={onFoldStateChange}
        onChange={onChange}
        onSelectionChange={onSelectionChange}
        className="markdown-editor-panel--window min-h-0 flex-1 bg-background/95"
      />
    </section>
  );
}
