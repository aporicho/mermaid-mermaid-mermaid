import {
  cloneEditorTypography,
  cloneMarkdownTheme,
  cloneSpecialNodeTheme,
  DEFAULT_EDITOR_THEME,
  getBuiltInEditorTheme,
  type EditorTheme
} from "@/features/mermaid-editor/lib/editor-theme";

export function toCustomTheme(theme: EditorTheme): EditorTheme {
  return {
    version: 9,
    id: "custom",
    name: theme.id === "custom" ? theme.name : "自定义主题",
    description: theme.description,
    baseThemeId: theme.id === "custom" ? theme.baseThemeId : theme.id,
    ui: { ...theme.ui },
    canvas: { ...theme.canvas },
    canvasAppearance: { ...theme.canvasAppearance },
    specialNode: cloneSpecialNodeTheme(theme.specialNode),
    chrome: { ...theme.chrome },
    source: { ...theme.source },
    render: { ...theme.render },
    markdown: cloneMarkdownTheme(theme.markdown),
    ansi: { ...theme.ansi },
    terminal: { ...theme.terminal },
    typography: cloneEditorTypography(theme.typography),
    font: { ...theme.font },
    space: { ...theme.space },
    radius: { ...theme.radius },
    stroke: {
      ...theme.stroke,
      edgeDotted: [...theme.stroke.edgeDotted],
      selectionDash: [...theme.stroke.selectionDash],
      connectionDraftDash: [...theme.stroke.connectionDraftDash],
      centerGuideDash: [...theme.stroke.centerGuideDash],
      subgraphDash: [...theme.stroke.subgraphDash]
    },
    icon: { ...theme.icon },
    canvasInteraction: { ...theme.canvasInteraction },
    subgraph: { ...theme.subgraph },
    edgeLabel: { ...theme.edgeLabel },
    motion: {
      duration: { ...theme.motion.duration },
      ease: { ...theme.motion.ease },
      distance: { ...theme.motion.distance },
      stagger: { ...theme.motion.stagger },
      canvas: { ...theme.motion.canvas }
    },
    diagnostics: { ...theme.diagnostics }
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
