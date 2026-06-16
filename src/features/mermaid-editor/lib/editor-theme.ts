import { CANVAS_VISUAL_TOKENS, type CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";

export const MERMAID_FONT_FAMILY = "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei UI, Microsoft YaHei, system-ui, sans-serif";

export type EditorThemeId = "warm-paper" | "classic-light" | "high-contrast" | "custom";

export type EditorTheme = {
  version: 1;
  id: EditorThemeId;
  name: string;
  ui: {
    background: string;
    foreground: string;
    icon: string;
    card: string;
    popover: string;
    primary: string;
    secondary: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    border: string;
  };
  canvas: {
    surface: string;
    nodeStroke: string;
    nodeText: string;
    edge: string;
    edgeText: string;
    labelStroke: string;
    connectionInvalid: string;
    previewInvalid: string;
  };
  source: {
    line: string;
  };
};

export type MermaidThemeVariables = Record<string, string>;

export const DEFAULT_EDITOR_THEME: EditorTheme = {
  version: 1,
  id: "warm-paper",
  name: "暖纸红",
  ui: {
    background: "#f8f3ec",
    foreground: "#18130f",
    icon: "#66584d",
    card: "#fcf8f2",
    popover: "#fcf8f2",
    primary: "#ff4050",
    secondary: "#eee8df",
    muted: "#f0ebe4",
    mutedForeground: "#6b625a",
    accent: "#ffe7ea",
    accentForeground: "#b91f31",
    destructive: "#b91f31",
    border: "#b8ada0"
  },
  canvas: {
    surface: "#fbf6ef",
    nodeStroke: "#2a251f",
    nodeText: "#18130f",
    edge: "#2a251f",
    edgeText: "#1c1712",
    labelStroke: "#b8ada0",
    connectionInvalid: "#9b5a50",
    previewInvalid: "#9f9286"
  },
  source: {
    line: "#d7ccc0"
  }
};

export const BUILT_IN_EDITOR_THEMES: EditorTheme[] = [
  DEFAULT_EDITOR_THEME,
  {
    version: 1,
    id: "classic-light",
    name: "经典浅色",
    ui: {
      background: "#f7faf9",
      foreground: "#172022",
      icon: "#526766",
      card: "#ffffff",
      popover: "#ffffff",
      primary: "#1f7a68",
      secondary: "#edf3f1",
      muted: "#eef4f2",
      mutedForeground: "#667977",
      accent: "#e4f3ef",
      accentForeground: "#185f52",
      destructive: "#b63e4b",
      border: "#c9d5d3"
    },
    canvas: {
      surface: "#ffffff",
      nodeStroke: "#526766",
      nodeText: "#172022",
      edge: "#526766",
      edgeText: "#344441",
      labelStroke: "#c9d5d3",
      connectionInvalid: "#a06a5f",
      previewInvalid: "#8a9996"
    },
    source: {
      line: "#dce8e5"
    }
  },
  {
    version: 1,
    id: "high-contrast",
    name: "高对比",
    ui: {
      background: "#fdfbf7",
      foreground: "#090807",
      icon: "#25211d",
      card: "#ffffff",
      popover: "#ffffff",
      primary: "#ff3045",
      secondary: "#ebe6df",
      muted: "#efebe5",
      mutedForeground: "#4d463f",
      accent: "#ffe0e4",
      accentForeground: "#8f1021",
      destructive: "#9f1020",
      border: "#756b60"
    },
    canvas: {
      surface: "#ffffff",
      nodeStroke: "#090807",
      nodeText: "#090807",
      edge: "#090807",
      edgeText: "#090807",
      labelStroke: "#756b60",
      connectionInvalid: "#7a3e36",
      previewInvalid: "#6f665c"
    },
    source: {
      line: "#cfc6bb"
    }
  }
];

const builtInThemeById = new Map(BUILT_IN_EDITOR_THEMES.map((theme) => [theme.id, theme]));
const hexColorPattern = /^#[0-9a-f]{6}$/i;

export function resolveEditorTheme(themeId: string | undefined, customTheme: unknown): EditorTheme {
  if (themeId === "custom") return normalizeEditorTheme(customTheme, { ...DEFAULT_EDITOR_THEME, id: "custom", name: "自定义主题" });
  return builtInThemeById.get(themeId as EditorThemeId) ?? DEFAULT_EDITOR_THEME;
}

export function normalizeEditorTheme(value: unknown, fallback: EditorTheme = DEFAULT_EDITOR_THEME): EditorTheme {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<EditorTheme>;

  return {
    version: 1,
    id: "custom",
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : fallback.name,
    ui: normalizeColorGroup(raw.ui, fallback.ui),
    canvas: normalizeColorGroup(raw.canvas, fallback.canvas),
    source: normalizeColorGroup(raw.source, fallback.source)
  };
}

export function themeToCssVariables(theme: EditorTheme): Record<string, string> {
  return {
    "--background": hexToHslTriplet(theme.ui.background),
    "--foreground": hexToHslTriplet(theme.ui.foreground),
    "--icon": hexToHslTriplet(theme.ui.icon),
    "--card": hexToHslTriplet(theme.ui.card),
    "--card-foreground": hexToHslTriplet(theme.ui.foreground),
    "--popover": hexToHslTriplet(theme.ui.popover),
    "--popover-foreground": hexToHslTriplet(theme.ui.foreground),
    "--primary": hexToHslTriplet(theme.ui.primary),
    "--primary-foreground": hexToHslTriplet(theme.ui.background),
    "--secondary": hexToHslTriplet(theme.ui.secondary),
    "--secondary-foreground": hexToHslTriplet(theme.ui.foreground),
    "--muted": hexToHslTriplet(theme.ui.muted),
    "--muted-foreground": hexToHslTriplet(theme.ui.mutedForeground),
    "--accent": hexToHslTriplet(theme.ui.accent),
    "--accent-foreground": hexToHslTriplet(theme.ui.accentForeground),
    "--destructive": hexToHslTriplet(theme.ui.destructive),
    "--destructive-foreground": hexToHslTriplet(theme.ui.background),
    "--border": hexToHslTriplet(theme.ui.border),
    "--input": hexToHslTriplet(theme.ui.border),
    "--ring": hexToHslTriplet(theme.ui.primary),
    "--source-line": hexToHslTriplet(theme.source.line)
  };
}

export function applyEditorThemeToDocument(theme: EditorTheme, target: HTMLElement = document.documentElement) {
  const variables = themeToCssVariables(theme);
  for (const [name, value] of Object.entries(variables)) target.style.setProperty(name, value);
}

export function themeToCanvasVisualTokens(theme: EditorTheme): CanvasVisualTokens {
  return {
    ...CANVAS_VISUAL_TOKENS,
    colors: {
      accent: theme.ui.primary,
      accentHover: theme.ui.accentForeground,
      connection: theme.ui.primary,
      connectionInvalid: theme.canvas.connectionInvalid,
      edge: theme.canvas.edge,
      edgeText: theme.canvas.edgeText,
      labelStroke: theme.canvas.labelStroke,
      nodeStroke: theme.canvas.nodeStroke,
      nodeText: theme.canvas.nodeText,
      surface: theme.canvas.surface,
      selectionFill: hexToRgba(theme.ui.primary, 0.08),
      anchorStroke: theme.canvas.surface,
      gridDotRgb: hexToRgbCsv(theme.canvas.edge),
      previewInvalid: theme.canvas.previewInvalid
    }
  };
}

export function themeToMermaidThemeVariables(theme: EditorTheme): MermaidThemeVariables {
  return {
    background: theme.ui.background,
    mainBkg: theme.canvas.surface,
    primaryColor: theme.canvas.surface,
    primaryTextColor: theme.canvas.nodeText,
    primaryBorderColor: theme.canvas.nodeStroke,
    secondaryColor: theme.ui.accent,
    secondaryTextColor: theme.ui.foreground,
    tertiaryColor: theme.ui.secondary,
    tertiaryTextColor: theme.ui.foreground,
    lineColor: theme.canvas.edge,
    textColor: theme.ui.foreground,
    edgeLabelBackground: theme.canvas.surface,
    clusterBkg: theme.ui.secondary,
    clusterBorder: theme.ui.border,
    nodeBorder: theme.canvas.nodeStroke,
    fontFamily: MERMAID_FONT_FAMILY
  };
}

export function isHexColor(value: string) {
  return hexColorPattern.test(value);
}

function normalizeColorGroup<T extends object>(raw: unknown, fallback: T): T {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => {
      const value = source[key];
      return [key, typeof value === "string" && isHexColor(value) ? value : fallbackValue];
    })
  ) as T;
}

function hexToRgb(value: string) {
  const normalized = isHexColor(value) ? value.slice(1) : "000000";
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function hexToRgbCsv(value: string) {
  const { r, g, b } = hexToRgb(value);
  return `${r}, ${g}, ${b}`;
}

function hexToRgba(value: string, alpha: number) {
  return `rgba(${hexToRgbCsv(value)}, ${alpha})`;
}

function hexToHslTriplet(value: string) {
  const { r, g, b } = hexToRgb(value);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) return `0 0% ${toPercent(lightness)}%`;

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  if (max === green) hue = (blue - red) / delta + 2;
  if (max === blue) hue = (red - green) / delta + 4;
  hue *= 60;

  return `${Math.round(hue)} ${toPercent(saturation)}% ${toPercent(lightness)}%`;
}

function toPercent(value: number) {
  return Math.round(value * 1000) / 10;
}
