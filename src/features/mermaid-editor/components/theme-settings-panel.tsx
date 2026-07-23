import { useEffect, useMemo, useState } from "react";
import { ColorWheel, WarningTriangle } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import {
  EditorList,
  EditorListRow,
  EditorNotice,
  EditorPanelFooter,
  EditorSearchField,
  EditorStatusBadge
} from "@/features/mermaid-editor/components/editor-ui";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
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
  onApply
}: {
  themeId: EditorThemeId;
  customTheme: EditorTheme | null;
  activeTheme: EditorTheme;
  runtime?: Pick<EditorRuntime, "listSystemFonts">;
  hasDraft: boolean;
  onPreview: (themeId: EditorThemeId, customTheme: EditorTheme | null) => void;
  onDiscard: () => void;
  onApply: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<ThemeSettingsCategoryId>("library");
  const [query, setQuery] = useState("");
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

  function updateGroupField(definition: ThemeTokenGroupDefinition, path: readonly string[], value: ThemeTokenValue) {
    const custom = toCustomTheme(activeTheme);
    onPreview("custom", normalizeEditorTheme(updateThemeValueAtPath(custom, [...definition.path, ...path], value), custom));
  }

  function resetGroup(definition: ThemeTokenGroupDefinition) {
    const custom = toCustomTheme(activeTheme);
    const base = baseThemeFor(activeTheme);
    const next = definition.includeKeys?.length
      ? definition.includeKeys.reduce((current, key) => updateThemeValueAtPath(current, [...definition.path, key], themeValueAtPath(base, [...definition.path, key])), custom)
      : updateThemeValueAtPath(custom, definition.path, themeValueAtPath(base, definition.path));
    onPreview("custom", normalizeEditorTheme(next, next));
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

  function resetTypographyRoles(group: keyof EditorTheme["typography"], roles: readonly string[]) {
    const base = baseThemeFor(activeTheme);
    const next = roles.reduce((current, role) => updateThemeValueAtPath(
      current,
      ["typography", group, role],
      themeValueAtPath(base, ["typography", group, role])
    ), toCustomTheme(activeTheme));
    onPreview("custom", normalizeEditorTheme(next, next));
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

  function renderTokenGroup(definition: ThemeTokenGroupDefinition) {
    if (definition.typographyGroup) {
      return (
        <ThemeSettingsTypography
          key={definition.id}
          value={activeTheme.typography}
          visibleGroups={[definition.typographyGroup]}
          visibleRoles={definition.typographyRoles}
          groupTitle={definition.title}
          systemFonts={systemFonts}
          loading={fontsLoading}
          error={fontsError}
          query={query}
          showSearch={false}
          resetDisabled={activeTheme.id !== "custom"}
          onChangeRole={updateTypographyRole}
          onResetRole={(group, role) => resetTypographyPath(group, role)}
          onResetGroup={(group) => resetTypographyPath(group)}
          onResetVisibleRoles={resetTypographyRoles}
        />
      );
    }
    const groupValue = themeValueAtPath(activeTheme, definition.path);
    if (!isThemeTokenGroup(groupValue)) return null;
    return (
      <ThemeSettingsGroup
        key={definition.id}
        definition={definition}
        value={groupValue}
        query={query}
        onChange={(path, value) => updateGroupField(definition, path, value)}
        onReset={() => resetGroup(definition)}
        resetDisabled={activeTheme.id !== "custom"}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-theme-settings-panel>
      <WorkspaceWindowHeader
        icon={<ColorWheel className="editor-ui-icon shrink-0 text-icon" />}
        title="主题"
        status={hasDraft ? <EditorStatusBadge tone="accent">未应用</EditorStatusBadge> : null}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[148px_minmax(0,1fr)] max-[520px]:grid-cols-[120px_minmax(0,1fr)]">
        <nav className="min-h-0 overflow-y-auto border-r bg-muted/20 p-2" aria-label="主题设置分类">
          <EditorList>
            {THEME_SETTINGS_CATEGORIES.map((entry) => (
            <EditorListRow
              key={entry.id}
              type="button"
              title={entry.label}
              selected={entry.id === activeCategory}
              className={cn("type-interface-navigation", entry.id !== activeCategory && "text-muted-foreground")}
              onClick={() => { setActiveCategory(entry.id); setQuery(""); }}
            />
          ))}
          </EditorList>
        </nav>

        <main className="min-h-0 overflow-y-auto p-4">
          {activeCategory === "library" ? (
            <ThemeSettingsLibrary themeId={themeId} customTheme={customTheme} activeTheme={activeTheme} onPreview={onPreview} />
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
              {activeCategory !== "markdown" ? (
                <EditorSearchField
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索外观…"
                  aria-label="搜索外观 token"
                />
              ) : null}
              {groups.map(renderTokenGroup)}
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
