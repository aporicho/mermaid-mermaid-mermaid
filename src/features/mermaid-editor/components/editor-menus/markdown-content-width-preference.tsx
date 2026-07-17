import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import {
  MARKDOWN_CONTENT_WIDTH_MAX,
  MARKDOWN_CONTENT_WIDTH_MIN,
  MARKDOWN_CONTENT_WIDTH_STEP,
  normalizeMarkdownContentWidth
} from "@/features/mermaid-editor/lib/editor-preferences";

export function MarkdownContentWidthPreference({
  preferences,
  onChange
}: {
  preferences: EditorPreferences;
  onChange: (preferences: EditorPreferences, message: string) => void;
}) {
  return (
    <div data-floating-action-item className="grid gap-2 px-2 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Markdown 正文宽度</span>
        <span className="font-mono text-foreground">{preferences.markdownContentWidth}px</span>
      </div>
      <input
        type="range"
        min={MARKDOWN_CONTENT_WIDTH_MIN}
        max={MARKDOWN_CONTENT_WIDTH_MAX}
        step={MARKDOWN_CONTENT_WIDTH_STEP}
        value={preferences.markdownContentWidth}
        aria-label="Markdown 正文宽度"
        className="h-5 w-full accent-primary"
        onChange={(event) => {
          const markdownContentWidth = normalizeMarkdownContentWidth(event.currentTarget.value);
          onChange(
            { ...preferences, markdownContentWidth },
            `Markdown 正文宽度已设为 ${markdownContentWidth}px。`
          );
        }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{MARKDOWN_CONTENT_WIDTH_MIN}px</span>
        <span>{MARKDOWN_CONTENT_WIDTH_MAX}px</span>
      </div>
    </div>
  );
}
