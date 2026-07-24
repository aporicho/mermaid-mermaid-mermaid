import { useMemo, useState } from "react";
import { Refresh } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { EditorEmptyState, EditorIconButton, EditorList, EditorListRow, EditorSearchField } from "@/features/mermaid-editor/components/editor-ui";
import {
  BUILT_IN_EDITOR_THEME_CATALOG,
  BUILT_IN_EDITOR_THEMES,
  DEFAULT_EDITOR_THEME,
  isBuiltInThemeId,
  themeModeLabel,
  type EditorTheme,
  type EditorThemeId
} from "@/features/mermaid-editor/lib/editor-theme";

import { toCustomTheme } from "./theme-settings-utils";

export function ThemeSettingsLibrary({
  themeId,
  customTheme,
  activeTheme,
  onPreview
}: {
  themeId: EditorThemeId;
  customTheme: EditorTheme | null;
  activeTheme: EditorTheme;
  onPreview: (themeId: EditorThemeId, customTheme: EditorTheme | null) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return BUILT_IN_EDITOR_THEME_CATALOG;
    return BUILT_IN_EDITOR_THEME_CATALOG.filter((entry) =>
      [entry.name, entry.id, entry.description, entry.source.name].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [query]);

  function selectTheme(value: string) {
    const nextThemeId = isBuiltInThemeId(value) || value === "custom" ? value : DEFAULT_EDITOR_THEME.id;
    if (nextThemeId === "custom") {
      onPreview("custom", customTheme || toCustomTheme(activeTheme));
      return;
    }
    onPreview(nextThemeId, customTheme);
  }

  return (
    <div className="grid gap-3" data-theme-settings-library>
      <EditorSearchField value={query} placeholder={`搜索 ${BUILT_IN_EDITOR_THEMES.length} 个主题`} onChange={(event) => setQuery(event.target.value)} />
      <EditorList className="max-h-[min(520px,60vh)] overflow-y-auto border bg-background p-1">
        {visibleEntries.map((entry) => (
          <EditorListRow
            key={entry.id}
            type="button"
            selected={entry.id === themeId}
            icon={<span className="flex shrink-0 overflow-hidden border">{entry.swatches.map((color, index) => <span key={`${color}-${index}`} className="h-7 w-5" style={{ backgroundColor: color }} />)}</span>}
            title={entry.name}
            aria-label={`${entry.name}，${entry.source.name}，${themeModeLabel(entry.mode)}`}
            onClick={() => selectTheme(entry.id)}
          />
        ))}
        <EditorListRow
          type="button"
          selected={themeId === "custom"}
          icon={<span className="size-7 shrink-0 border" style={{ backgroundColor: activeTheme.interface.colors.primary }} />}
          title="自定义主题"
          aria-label="自定义主题，当前编辑副本"
          onClick={() => selectTheme("custom")}
        />
        {visibleEntries.length === 0 ? <EditorEmptyState title="没有匹配主题" /> : null}
      </EditorList>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onPreview("custom", toCustomTheme(activeTheme))}>复制当前</Button>
        <EditorIconButton context="inline" label="恢复默认主题" onClick={() => onPreview(DEFAULT_EDITOR_THEME.id, customTheme)}>
          <Refresh />
        </EditorIconButton>
      </div>
    </div>
  );
}
