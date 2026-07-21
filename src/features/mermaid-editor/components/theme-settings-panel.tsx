import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ColorWheel, WarningTriangle } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import {
  EditorList,
  EditorListRow,
  EditorNotice,
  EditorPanelFooter,
  EditorPanelHeader,
  EditorStatusBadge
} from "@/features/mermaid-editor/components/editor-ui";
import {
  compileEditorTheme,
  MARKDOWN_ELEMENT_DEFINITIONS,
  normalizeEditorTheme,
  type EditorTheme,
  type EditorThemeId,
  type MarkdownElementCategory,
  type TypographyRoleTokens
} from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";
import type { EditorRuntime, RuntimeSystemFont } from "@/features/mermaid-editor/lib/editor-runtime";

import { ThemeSettingsGroup } from "./theme-settings-controls";
import { ThemeSettingsLibrary } from "./theme-settings-library";
import { ThemeSettingsMarkdown } from "./theme-settings-markdown";
import { ThemeSettingsTypography } from "./theme-settings-typography";
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
  runtime,
  hasDraft,
  onPreview,
  onDiscard,
  onApply,
  windowControls
}: {
  themeId: EditorThemeId;
  customTheme: EditorTheme | null;
  activeTheme: EditorTheme;
  runtime?: Pick<EditorRuntime, "listSystemFonts">;
  hasDraft: boolean;
  onPreview: (themeId: EditorThemeId, customTheme: EditorTheme | null) => void;
  onDiscard: () => void;
  onApply: () => void;
  windowControls: ReactNode;
}) {
  const [activeCategory, setActiveCategory] = useState<ThemeSettingsCategoryId>("library");
  const groups = useMemo(() => THEME_TOKEN_GROUPS.filter((group) => group.category === activeCategory), [activeCategory]);
  const diagnostics = useMemo(() => compileEditorTheme(activeTheme).diagnostics, [activeTheme]);
  const [systemFonts, setSystemFonts] = useState<RuntimeSystemFont[]>([]);
  const [fontsLoading, setFontsLoading] = useState(Boolean(runtime));
  const [fontsError, setFontsError] = useState<string | null>(null);

  useEffect(() => {
    if (!runtime) return;
    let cancelled = false;
    setFontsLoading(true);
    setFontsError(null);
    void runtime.listSystemFonts().then((fonts) => {
      if (!cancelled) setSystemFonts(fonts);
    }).catch(() => {
      if (!cancelled) setFontsError("无法读取系统字体");
    }).finally(() => {
      if (!cancelled) setFontsLoading(false);
    });
    return () => { cancelled = true; };
  }, [runtime]);

  function updateGroupField(definition: ThemeTokenGroupDefinition, key: string, value: ThemeTokenValue) {
    const custom = toCustomTheme(activeTheme);
    onPreview("custom", normalizeEditorTheme(updateThemeValueAtPath(custom, [...definition.path, key], value), custom));
  }

  function resetGroup(definition: ThemeTokenGroupDefinition) {
    const custom = toCustomTheme(activeTheme);
    const baseValue = themeValueAtPath(baseThemeFor(activeTheme), definition.path);
    onPreview("custom", normalizeEditorTheme(updateThemeValueAtPath(custom, definition.path, baseValue), custom));
  }

  function updateTypographyRole(group: keyof EditorTheme["typography"], role: string, value: TypographyRoleTokens) {
    const custom = toCustomTheme(activeTheme);
    onPreview("custom", normalizeEditorTheme(updateThemeValueAtPath(custom, ["typography", group, role], value), custom));
  }

  function resetTypographyPath(group: keyof EditorTheme["typography"], role?: string) {
    const custom = toCustomTheme(activeTheme);
    const path = role ? ["typography", group, role] : ["typography", group];
    const baseValue = themeValueAtPath(baseThemeFor(activeTheme), path);
    onPreview("custom", normalizeEditorTheme(updateThemeValueAtPath(custom, path, baseValue), custom));
  }

  function updateMarkdownField(path: readonly string[], value: ThemeTokenValue) {
    const custom = toCustomTheme(activeTheme);
    onPreview("custom", normalizeEditorTheme(updateThemeValueAtPath(custom, ["markdown", ...path], value), custom));
  }

  function resetMarkdownPath(path: readonly string[]) {
    const custom = toCustomTheme(activeTheme);
    const fullPath = ["markdown", ...path];
    const baseValue = themeValueAtPath(baseThemeFor(activeTheme), fullPath);
    onPreview("custom", normalizeEditorTheme(updateThemeValueAtPath(custom, fullPath, baseValue), custom));
  }

  function resetMarkdownCategory(category: MarkdownElementCategory) {
    const base = baseThemeFor(activeTheme);
    const next = MARKDOWN_ELEMENT_DEFINITIONS.filter((element) => element.category === category).reduce(
      (current, element) => updateThemeValueAtPath(current, ["markdown", ...element.path], themeValueAtPath(base, ["markdown", ...element.path])),
      toCustomTheme(activeTheme)
    );
    onPreview("custom", normalizeEditorTheme(next, next));
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]" data-theme-settings-panel>
      <EditorPanelHeader
        icon={<ColorWheel className="editor-ui-icon shrink-0 text-icon" />}
        title={<span className="flex items-center gap-2">主题{hasDraft ? <EditorStatusBadge tone="accent">未应用</EditorStatusBadge> : null}</span>}
        actions={windowControls}
      />

      <div className="grid min-h-0 grid-cols-[148px_minmax(0,1fr)] max-[520px]:grid-cols-[120px_minmax(0,1fr)]">
        <nav className="min-h-0 overflow-y-auto border-r bg-muted/20 p-2" aria-label="主题设置分类">
          <EditorList>
            {THEME_SETTINGS_CATEGORIES.map((entry) => (
            <EditorListRow
              key={entry.id}
              type="button"
              title={entry.label}
              selected={entry.id === activeCategory}
              className={cn("type-interface-navigation", entry.id !== activeCategory && "text-muted-foreground")}
              onClick={() => setActiveCategory(entry.id)}
            />
          ))}
          </EditorList>
        </nav>

        <main className="min-h-0 overflow-y-auto p-4">
          {activeCategory === "library" ? (
            <ThemeSettingsLibrary themeId={themeId} customTheme={customTheme} activeTheme={activeTheme} onPreview={onPreview} />
          ) : activeCategory === "typography" ? (
            <ThemeSettingsTypography
              value={activeTheme.typography}
              visibleGroups={["interface", "canvas", "linkCard", "markdownCard", "mermaid", "canvasDocument", "source", "terminal"]}
              systemFonts={systemFonts}
              loading={fontsLoading}
              error={fontsError}
              onChangeRole={updateTypographyRole}
              onResetRole={(group, role) => resetTypographyPath(group, role)}
              onResetGroup={(group) => resetTypographyPath(group)}
            />
          ) : (
            <div className="grid gap-4">
              {activeCategory === "markdown" ? (
                <ThemeSettingsMarkdown
                  value={activeTheme.markdown}
                  systemFonts={systemFonts}
                  loading={fontsLoading}
                  error={fontsError}
                  resetDisabled={activeTheme.id !== "custom"}
                  onChange={updateMarkdownField}
                  onResetPath={resetMarkdownPath}
                  onResetCategory={resetMarkdownCategory}
                  onResetAll={() => resetMarkdownPath([])}
                />
              ) : null}
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

      <EditorPanelFooter className="justify-end">
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" disabled={!hasDraft} onClick={onDiscard}>放弃</Button>
          <Button disabled={!hasDraft} onClick={onApply}>应用</Button>
        </div>
      </EditorPanelFooter>
    </div>
  );
}

function ThemeDiagnostics({ diagnostics }: { diagnostics: ReturnType<typeof compileEditorTheme>["diagnostics"] }) {
  if (!diagnostics.length) {
    return <EditorNotice tone="accent" description="无警告" />;
  }

  return (
    <EditorNotice
      tone="danger"
      icon={<WarningTriangle className="editor-ui-icon text-destructive" />}
      title="当前主题警告"
      description={<div className="grid gap-2">{diagnostics.map((diagnostic) => <p key={diagnostic.code}>{diagnostic.message}</p>)}</div>}
    />
  );
}

function isThemeTokenGroup(value: unknown): value is Record<string, ThemeTokenValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
