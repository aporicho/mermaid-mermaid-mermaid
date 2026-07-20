import { useMemo, useState, type ReactNode } from "react";
import { ColorWheel, WarningTriangle } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import {
  compileEditorTheme,
  normalizeEditorTheme,
  type EditorTheme,
  type EditorThemeId
} from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";

import { ThemeSettingsGroup } from "./theme-settings-controls";
import { ThemeSettingsLibrary } from "./theme-settings-library";
import {
  THEME_SETTINGS_CATEGORIES,
  THEME_TOKEN_GROUPS,
  type ThemeSettingsCategoryId,
  type ThemeTokenGroupDefinition
} from "./theme-settings-schema";
import {
  baseThemeFor,
  themeValueAtPath,
  toCustomTheme,
  updateThemeValueAtPath
} from "./theme-settings-utils";

type ThemeTokenValue = string | number | readonly number[];

export function ThemeSettingsPanel({
  themeId,
  customTheme,
  activeTheme,
  hasDraft,
  onPreview,
  onDiscard,
  onApply,
  windowControls
}: {
  themeId: EditorThemeId;
  customTheme: EditorTheme | null;
  activeTheme: EditorTheme;
  hasDraft: boolean;
  onPreview: (themeId: EditorThemeId, customTheme: EditorTheme | null) => void;
  onDiscard: () => void;
  onApply: () => void;
  windowControls: ReactNode;
}) {
  const [activeCategory, setActiveCategory] = useState<ThemeSettingsCategoryId>("library");
  const category = THEME_SETTINGS_CATEGORIES.find((entry) => entry.id === activeCategory) ?? THEME_SETTINGS_CATEGORIES[0];
  const groups = useMemo(() => THEME_TOKEN_GROUPS.filter((group) => group.category === activeCategory), [activeCategory]);
  const diagnostics = useMemo(() => compileEditorTheme(activeTheme).diagnostics, [activeTheme]);

  function updateGroupField(definition: ThemeTokenGroupDefinition, key: string, value: ThemeTokenValue) {
    const custom = toCustomTheme(activeTheme);
    onPreview("custom", normalizeEditorTheme(updateThemeValueAtPath(custom, [...definition.path, key], value), custom));
  }

  function resetGroup(definition: ThemeTokenGroupDefinition) {
    const custom = toCustomTheme(activeTheme);
    const baseValue = themeValueAtPath(baseThemeFor(activeTheme), definition.path);
    onPreview("custom", normalizeEditorTheme(updateThemeValueAtPath(custom, definition.path, baseValue), custom));
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[52px_minmax(0,1fr)_56px]" data-theme-settings-panel>
      <header className="flex items-center justify-between gap-3 border-b px-3" data-floating-panel-drag-handle>
        <div className="flex min-w-0 items-center gap-2">
          <ColorWheel className="size-4 shrink-0 text-icon" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-medium">主题</h1>
              {hasDraft ? <span className="shrink-0 border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">未应用</span> : null}
            </div>
            <p className="truncate text-[10px] text-muted-foreground">{activeTheme.name}</p>
          </div>
        </div>
        {windowControls}
      </header>

      <div className="grid min-h-0 grid-cols-[148px_minmax(0,1fr)] max-[520px]:grid-cols-[120px_minmax(0,1fr)]">
        <nav className="min-h-0 overflow-y-auto border-r bg-muted/20 p-2" aria-label="主题设置分类">
          {THEME_SETTINGS_CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={cn(
                "mb-1 flex min-h-9 w-full items-center px-2 text-left text-xs transition-colors",
                entry.id === activeCategory ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => setActiveCategory(entry.id)}
              aria-current={entry.id === activeCategory ? "page" : undefined}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        <main className="min-h-0 overflow-y-auto p-4">
          {activeCategory === "library" ? (
            <ThemeSettingsLibrary themeId={themeId} customTheme={customTheme} activeTheme={activeTheme} onPreview={onPreview} />
          ) : (
            <div className="grid gap-4">
              <div>
                <h2 className="text-sm font-medium">{category.label}</h2>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{category.description}</p>
              </div>
              {groups.map((definition) => {
                const groupValue = themeValueAtPath(activeTheme, definition.path);
                if (!isThemeTokenGroup(groupValue)) return null;
                return (
                  <ThemeSettingsGroup
                    key={definition.id}
                    definition={definition}
                    value={groupValue}
                    onChange={(key, value) => updateGroupField(definition, key, value)}
                    onReset={() => resetGroup(definition)}
                    resetDisabled={activeTheme.id !== "custom"}
                  />
                );
              })}
              {activeCategory === "diagnostics" ? <ThemeDiagnostics diagnostics={diagnostics} /> : null}
            </div>
          )}
        </main>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t px-3" data-floating-panel-drag-exclude>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {hasDraft ? "正在实时预览未应用的修改" : "当前设置已应用"}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" disabled={!hasDraft} onClick={onDiscard}>放弃更改</Button>
          <Button disabled={!hasDraft} onClick={onApply}>应用</Button>
        </div>
      </footer>
    </div>
  );
}

function ThemeDiagnostics({ diagnostics }: { diagnostics: ReturnType<typeof compileEditorTheme>["diagnostics"] }) {
  if (!diagnostics.length) {
    return <div className="border border-primary/20 bg-primary/5 px-3 py-3 text-xs text-muted-foreground">当前主题没有可读性警告。</div>;
  }

  return (
    <section className="grid gap-2 border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-destructive">
        <WarningTriangle className="size-4" />
        当前主题警告
      </div>
      {diagnostics.map((diagnostic) => <p key={diagnostic.code} className="text-xs leading-5 text-muted-foreground">{diagnostic.message}</p>)}
    </section>
  );
}

function isThemeTokenGroup(value: unknown): value is Record<string, ThemeTokenValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
