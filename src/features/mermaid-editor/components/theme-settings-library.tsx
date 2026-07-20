import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BUILT_IN_EDITOR_THEME_CATALOG,
  BUILT_IN_EDITOR_THEMES,
  DEFAULT_EDITOR_THEME,
  isBuiltInThemeId,
  themeModeLabel,
  type EditorTheme,
  type EditorThemeId
} from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";

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
      <div>
        <h2 className="text-sm font-medium">选择主题</h2>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">选择预设后会立即应用到整个编辑器，应用前仍可放弃。</p>
      </div>
      <Input value={query} placeholder={`搜索 ${BUILT_IN_EDITOR_THEMES.length} 个主题`} onChange={(event) => setQuery(event.target.value)} />
      <div className="max-h-[min(520px,60vh)] overflow-y-auto rounded-md border bg-background">
        {visibleEntries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0",
              entry.id === themeId ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
            )}
            onClick={() => selectTheme(entry.id)}
          >
            <span className="flex shrink-0 overflow-hidden rounded-sm border">
              {entry.swatches.map((color, index) => (
                <span key={`${color}-${index}`} className="h-7 w-5" style={{ backgroundColor: color }} />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{entry.name}</span>
              <span className="block truncate text-xs opacity-70">{entry.source.name} · {themeModeLabel(entry.mode)}</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
            themeId === "custom" ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
          )}
          onClick={() => selectTheme("custom")}
        >
          <span className="size-7 shrink-0 border" style={{ backgroundColor: activeTheme.ui.primary }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">自定义主题</span>
            <span className="block truncate text-xs opacity-70">当前编辑副本</span>
          </span>
        </button>
        {visibleEntries.length === 0 ? <div className="px-3 py-8 text-center text-xs text-muted-foreground">没有匹配主题</div> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-8 px-3" onClick={() => onPreview("custom", toCustomTheme(activeTheme))}>复制当前</Button>
        <Button variant="ghost" className="h-8 px-3" onClick={() => onPreview(DEFAULT_EDITOR_THEME.id, customTheme)}>恢复默认</Button>
      </div>
    </div>
  );
}
