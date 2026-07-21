import { DEFAULT_EDITOR_THEME, getBuiltInEditorTheme, type EditorTheme } from "@/features/mermaid-editor/lib/editor-theme";

export function toCustomTheme(theme: EditorTheme): EditorTheme {
  const clone = structuredClone(theme);
  return {
    ...clone,
    version: 11,
    id: "custom",
    name: theme.id === "custom" ? theme.name : "自定义主题",
    description: theme.description,
    baseThemeId: theme.id === "custom" ? theme.baseThemeId : theme.id
  };
}

export function themeValueAtPath(theme: EditorTheme, path: readonly string[]): unknown {
  return path.reduce<unknown>((current, key) => (current as Record<string, unknown>)?.[key], theme);
}

export function updateThemeValueAtPath(theme: EditorTheme, path: readonly string[], value: unknown): EditorTheme {
  function update(current: unknown, depth: number): unknown {
    if (depth === path.length) return cloneThemeValue(value);
    const record = current as Record<string, unknown>;
    const key = path[depth];
    return { ...record, [key]: update(record[key], depth + 1) };
  }

  return update(theme, 0) as EditorTheme;
}

export function baseThemeFor(theme: EditorTheme) {
  if (theme.id !== "custom") return theme;
  return getBuiltInEditorTheme(theme.baseThemeId) ?? DEFAULT_EDITOR_THEME;
}

function cloneThemeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneThemeValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, cloneThemeValue(entry)]));
}
