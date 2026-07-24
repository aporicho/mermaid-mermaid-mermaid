import { DEFAULT_EDITOR_THEME, getBuiltInEditorTheme, type EditorTheme } from "@/features/mermaid-editor/lib/editor-theme";

export function toCustomTheme(theme: EditorTheme): EditorTheme {
  const clone = structuredClone(theme);
  return {
    ...clone,
    version: 15,
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

export function updateMarkdownPreviewTypography(
  theme: EditorTheme,
  key: "titleFontSize" | "contentFontSize",
  value: number
) {
  const previous = theme.specialNode.markdownDocument.previewTypography[key];
  let next = updateThemeValueAtPath(
    theme,
    ["specialNode", "markdownDocument", "previewTypography", key],
    value
  );
  if (!Number.isFinite(previous) || previous <= 0 || previous === value) return next;
  const ratio = value / previous;
  const preview = next.specialNode.markdownDocument.previewContent;
  if (key === "titleFontSize") {
    next = updateThemeValueAtPath(next, ["specialNode", "markdownDocument", "previewContent", "title"], scalePreviewText(preview.title, ratio));
    return next;
  }

  const scalablePaths = [
    ["paragraph"],
    ["heading", "h1"],
    ["heading", "h2"],
    ["heading", "h3"],
    ["heading", "h4"],
    ["heading", "h5"],
    ["heading", "h6"],
    ["list", "unordered"],
    ["list", "ordered"],
    ["blockquote"]
  ] as const;
  return scalablePaths.reduce((current, path) => {
    const text = themeValueAtPath(current, ["specialNode", "markdownDocument", "previewContent", ...path]);
    return updateThemeValueAtPath(
      current,
      ["specialNode", "markdownDocument", "previewContent", ...path],
      scalePreviewText(text as { fontSize: number; lineHeight: number }, ratio)
    );
  }, next);
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

function scalePreviewText<T extends { fontSize: number; lineHeight: number }>(text: T, ratio: number): T {
  return {
    ...text,
    fontSize: roundedPreviewMetric(text.fontSize * ratio),
    lineHeight: roundedPreviewMetric(text.lineHeight * ratio)
  };
}

function roundedPreviewMetric(value: number) {
  return Math.round(value * 1000) / 1000;
}
