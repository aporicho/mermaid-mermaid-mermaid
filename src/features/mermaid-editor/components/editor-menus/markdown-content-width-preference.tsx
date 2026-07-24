import { Field, FieldTitle } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
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
    <Field data-floating-action-item className="gap-2 px-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <FieldTitle>正文宽度</FieldTitle>
        <span className="type-interface-technical text-foreground">{preferences.markdownContentWidth}px</span>
      </div>
      <Slider
        min={MARKDOWN_CONTENT_WIDTH_MIN}
        max={MARKDOWN_CONTENT_WIDTH_MAX}
        step={MARKDOWN_CONTENT_WIDTH_STEP}
        value={[preferences.markdownContentWidth]}
        aria-label="Markdown 正文宽度"
        onValueChange={([value]) => {
          const markdownContentWidth = normalizeMarkdownContentWidth(value);
          onChange(
            { ...preferences, markdownContentWidth },
            `Markdown 正文宽度已设为 ${markdownContentWidth}px。`
          );
        }}
      />
    </Field>
  );
}
