import { createEditorTheme } from "./base";
import { inferThemeMode, editorThemeFromKittyDefinition } from "./kitty-theme";
import type { EditorTheme } from "./types";
import type { EditorThemeCatalogEntry, EditorThemeDefinition, ThemeMode, ThemeSourceInfo } from "./theme-definition";

const DEFAULT_THEME_ID = "warm-paper";
const LOCAL_THEME_SOURCE: ThemeSourceInfo = {
  id: "local",
  name: "内置"
};

const themeModules = import.meta.glob("./themes/**/*.theme.json", { eager: true, import: "default" }) as Record<string, unknown>;
const themeDefinitions = Object.values(themeModules).filter(isThemeDefinition);

export const BUILT_IN_EDITOR_THEME_CATALOG: EditorThemeCatalogEntry[] = themeDefinitions.map(themeCatalogEntryFromDefinition).sort(compareThemeCatalogEntries);
export const BUILT_IN_EDITOR_THEMES: EditorTheme[] = BUILT_IN_EDITOR_THEME_CATALOG.map((entry) => entry.theme);

const builtInThemeById = new Map(BUILT_IN_EDITOR_THEMES.map((theme) => [theme.id, theme]));

export const DEFAULT_EDITOR_THEME = builtInThemeById.get(DEFAULT_THEME_ID) ?? createEditorTheme({
  id: DEFAULT_THEME_ID,
  name: "暖纸红",
  description: "暖色纸面、近黑细线和珊瑚红强调。"
});

export function getBuiltInEditorTheme(themeId: string | undefined): EditorTheme | undefined {
  return themeId ? builtInThemeById.get(themeId) : undefined;
}

export function isBuiltInThemeId(value: unknown): value is string {
  return typeof value === "string" && value !== "custom" && builtInThemeById.has(value);
}

function themeCatalogEntryFromDefinition(definition: EditorThemeDefinition): EditorThemeCatalogEntry {
  const theme = themeFromDefinition(definition);
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    mode: definition.mode ?? inferThemeMode(theme.ui.background),
    source: definition.source ?? LOCAL_THEME_SOURCE,
    order: definition.order ?? sourceOrder(definition.source?.id),
    swatches: [theme.ui.background, theme.ui.primary, theme.terminal.foreground],
    theme
  };
}

function themeFromDefinition(definition: EditorThemeDefinition): EditorTheme {
  if (definition.kind === "kitty") return editorThemeFromKittyDefinition(definition);
  return createEditorTheme({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    ...(definition.theme ?? {})
  });
}

function compareThemeCatalogEntries(a: EditorThemeCatalogEntry, b: EditorThemeCatalogEntry) {
  return a.order - b.order || a.source.name.localeCompare(b.source.name) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function sourceOrder(sourceId: string | undefined) {
  if (!sourceId || sourceId === "local") return 0;
  if (sourceId === "dexpota") return 1000;
  if (sourceId === "kovidgoyal") return 2000;
  return 3000;
}

function isThemeDefinition(value: unknown): value is EditorThemeDefinition {
  if (!value || typeof value !== "object") return false;
  const definition = value as Partial<EditorThemeDefinition>;
  return (
    (definition.kind === "editor" || definition.kind === "kitty") &&
    typeof definition.id === "string" &&
    definition.id !== "custom" &&
    typeof definition.name === "string" &&
    typeof definition.description === "string"
  );
}

export function themeModeLabel(mode: ThemeMode) {
  return mode === "dark" ? "深色" : "浅色";
}
