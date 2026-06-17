import { DEFAULT_CANVAS_GRID, type CanvasGridSpec } from "@/features/mermaid-editor/lib/canvas-grid";
import { CANVAS_VISUAL_TOKENS, type CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import { DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS, type EdgeLabelGeometryTokens } from "@/features/mermaid-editor/lib/edge-label-geometry";
import { DEFAULT_NODE_GEOMETRY_TOKENS, type NodeGeometryTokens } from "@/features/mermaid-editor/lib/node-geometry";
import { SUBGRAPH_GEOMETRY_TOKENS, type SubgraphGeometryTokens } from "@/features/mermaid-editor/lib/subgraph-geometry";

export const MERMAID_FONT_FAMILY = "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei UI, Microsoft YaHei, system-ui, sans-serif";
export const MONO_FONT_FAMILY = "Maple Mono, SF Mono, Cascadia Code, JetBrains Mono, Noto Sans SC Variable, ui-monospace, monospace";

export type EditorThemeId = "warm-paper" | "classic-light" | "high-contrast" | "custom";

export type ThemeDiagnostic = {
  severity: "warning";
  code: string;
  message: string;
};

export type EditorTheme = {
  version: 2;
  id: EditorThemeId;
  name: string;
  description: string;
  baseThemeId?: Exclude<EditorThemeId, "custom">;
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
  render: {
    background: string;
    gridDot: string;
  };
  font: {
    familySans: string;
    familyMono: string;
    sizeUiXs: number;
    sizeUiSm: number;
    sizeNode: number;
    sizeEdgeLabel: number;
    sizeSource: number;
    weightRegular: number;
    weightMedium: number;
    weightBold: number;
    lineHeightNode: number;
    lineHeightEdgeLabel: number;
    lineHeightSource: number;
    letterSpacing: number;
  };
  space: {
    panelPadding: number;
    panelHeaderHeight: number;
    panelFooterHeight: number;
    controlGap: number;
    controlPaddingX: number;
    controlPaddingY: number;
    iconButtonSize: number;
    nodePaddingX: number;
    nodePaddingY: number;
    nodeMinChars: number;
    nodeMaxChars: number;
    nodeMaxLines: number;
    gridMinorStep: number;
    gridMajorEvery: number;
  };
  radius: {
    app: number;
    controlSm: number;
    controlMd: number;
    controlLg: number;
    canvasNode: number;
    edgeLabel: number;
    polygonCorner: number;
    subgraphTitle: number;
  };
  stroke: {
    node: number;
    nodeEmphasized: number;
    edge: number;
    edgeThick: number;
    edgeDotted: readonly number[];
    overlay: number;
    anchor: number;
    selectionDash: readonly number[];
    connectionDraftDash: readonly number[];
    centerGuideDash: readonly number[];
    subgraphDash: readonly number[];
  };
  icon: {
    family: "iconoir";
    sizeSm: number;
    sizeButton: number;
    strokeWidth: number;
    buttonHeightSm: number;
    buttonHeightMd: number;
  };
  canvasInteraction: {
    anchorRadius: number;
    endpointRadius: number;
    edgeHitStrokeWidth: number;
    pointerLength: number;
    pointerWidth: number;
    endpointMarkerRadius: number;
    gridMinorAlpha: number;
    gridMajorAlpha: number;
    gridSuperAlpha: number;
    gridMaxDots: number;
    gridMinorVisibleScale: number;
    gridMajorVisibleScale: number;
    gridMinorRadiusPx: number;
    gridMajorRadiusPx: number;
    gridSuperRadiusPx: number;
  };
  subgraph: {
    paddingX: number;
    paddingTop: number;
    paddingBottom: number;
    titleHeight: number;
    titleInsetX: number;
    titleInsetTop: number;
    titlePaddingX: number;
    titleFontSize: number;
    titleFontWeight: number;
    minWidth: number;
    minHeight: number;
    fallbackGap: number;
    fillOpacity: number;
  };
  edgeLabel: {
    minChars: number;
    maxChars: number;
    paddingX: number;
    height: number;
    fontSize: number;
    lineHeight: number;
  };
  diagnostics: {
    minTextContrast: number;
    minFocusContrast: number;
    minSelectionContrast: number;
  };
};

export type MermaidThemeVariables = Record<string, string>;

export type EditorThemeGeometryTokens = {
  node: NodeGeometryTokens;
  edgeLabel: EdgeLabelGeometryTokens;
  subgraph: SubgraphGeometryTokens;
  grid: CanvasGridSpec;
};

export type CompiledEditorTheme = {
  theme: EditorTheme;
  cssVariables: Record<string, string>;
  canvasVisualTokens: CanvasVisualTokens;
  mermaidThemeVariables: MermaidThemeVariables;
  geometry: EditorThemeGeometryTokens;
  diagnostics: ThemeDiagnostic[];
};

export const DEFAULT_EDITOR_THEME: EditorTheme = {
  version: 2,
  id: "warm-paper",
  name: "暖纸红",
  description: "暖色纸面、近黑细线和珊瑚红强调。",
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
  },
  render: {
    background: "#f8f3ec",
    gridDot: "#18130f"
  },
  font: {
    familySans: MERMAID_FONT_FAMILY,
    familyMono: MONO_FONT_FAMILY,
    sizeUiXs: 12,
    sizeUiSm: 14,
    sizeNode: DEFAULT_NODE_GEOMETRY_TOKENS.fontSize,
    sizeEdgeLabel: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.fontSize,
    sizeSource: 13,
    weightRegular: 400,
    weightMedium: 500,
    weightBold: DEFAULT_NODE_GEOMETRY_TOKENS.fontWeight,
    lineHeightNode: DEFAULT_NODE_GEOMETRY_TOKENS.lineHeight,
    lineHeightEdgeLabel: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.lineHeight,
    lineHeightSource: 30,
    letterSpacing: 0
  },
  space: {
    panelPadding: 16,
    panelHeaderHeight: 52,
    panelFooterHeight: 56,
    controlGap: 8,
    controlPaddingX: 12,
    controlPaddingY: 8,
    iconButtonSize: 32,
    nodePaddingX: DEFAULT_NODE_GEOMETRY_TOKENS.paddingX,
    nodePaddingY: DEFAULT_NODE_GEOMETRY_TOKENS.paddingY,
    nodeMinChars: DEFAULT_NODE_GEOMETRY_TOKENS.minChars,
    nodeMaxChars: DEFAULT_NODE_GEOMETRY_TOKENS.maxChars,
    nodeMaxLines: DEFAULT_NODE_GEOMETRY_TOKENS.maxLines,
    gridMinorStep: DEFAULT_CANVAS_GRID.minorStep,
    gridMajorEvery: DEFAULT_CANVAS_GRID.majorEvery
  },
  radius: {
    app: 8,
    controlSm: 4,
    controlMd: 6,
    controlLg: 8,
    canvasNode: CANVAS_VISUAL_TOKENS.node.cornerRadius,
    edgeLabel: CANVAS_VISUAL_TOKENS.edge.labelCornerRadius,
    polygonCorner: CANVAS_VISUAL_TOKENS.shape.polygonCornerRadius,
    subgraphTitle: CANVAS_VISUAL_TOKENS.subgraph.titleCornerRadius
  },
  stroke: {
    node: CANVAS_VISUAL_TOKENS.node.strokeWidth,
    nodeEmphasized: CANVAS_VISUAL_TOKENS.node.emphasizedStrokeWidth,
    edge: CANVAS_VISUAL_TOKENS.edge.strokeWidth,
    edgeThick: CANVAS_VISUAL_TOKENS.edge.thickStrokeWidth,
    edgeDotted: CANVAS_VISUAL_TOKENS.edge.dottedDash,
    overlay: CANVAS_VISUAL_TOKENS.overlay.strokeWidth,
    anchor: CANVAS_VISUAL_TOKENS.anchor.strokeWidth,
    selectionDash: CANVAS_VISUAL_TOKENS.overlay.selectionDash,
    connectionDraftDash: CANVAS_VISUAL_TOKENS.overlay.connectionDash,
    centerGuideDash: CANVAS_VISUAL_TOKENS.overlay.centerGuideDash,
    subgraphDash: CANVAS_VISUAL_TOKENS.overlay.subgraphDash
  },
  icon: {
    family: "iconoir",
    sizeSm: 16,
    sizeButton: 16,
    strokeWidth: 2.2,
    buttonHeightSm: 32,
    buttonHeightMd: 40
  },
  canvasInteraction: {
    anchorRadius: CANVAS_VISUAL_TOKENS.anchor.radius,
    endpointRadius: CANVAS_VISUAL_TOKENS.anchor.endpointRadius,
    edgeHitStrokeWidth: CANVAS_VISUAL_TOKENS.edge.hitStrokeWidth,
    pointerLength: CANVAS_VISUAL_TOKENS.edge.pointerLength,
    pointerWidth: CANVAS_VISUAL_TOKENS.edge.pointerWidth,
    endpointMarkerRadius: CANVAS_VISUAL_TOKENS.edge.endpointMarkerRadius,
    gridMinorAlpha: DEFAULT_CANVAS_GRID.minorAlpha,
    gridMajorAlpha: DEFAULT_CANVAS_GRID.majorAlpha,
    gridSuperAlpha: DEFAULT_CANVAS_GRID.superAlpha,
    gridMaxDots: DEFAULT_CANVAS_GRID.maxDots,
    gridMinorVisibleScale: DEFAULT_CANVAS_GRID.minorVisibleScale,
    gridMajorVisibleScale: DEFAULT_CANVAS_GRID.majorVisibleScale,
    gridMinorRadiusPx: DEFAULT_CANVAS_GRID.minorRadiusPx,
    gridMajorRadiusPx: DEFAULT_CANVAS_GRID.majorRadiusPx,
    gridSuperRadiusPx: DEFAULT_CANVAS_GRID.superRadiusPx
  },
  subgraph: {
    paddingX: SUBGRAPH_GEOMETRY_TOKENS.paddingX,
    paddingTop: SUBGRAPH_GEOMETRY_TOKENS.paddingTop,
    paddingBottom: SUBGRAPH_GEOMETRY_TOKENS.paddingBottom,
    titleHeight: SUBGRAPH_GEOMETRY_TOKENS.titleHeight,
    titleInsetX: SUBGRAPH_GEOMETRY_TOKENS.titleInsetX,
    titleInsetTop: SUBGRAPH_GEOMETRY_TOKENS.titleInsetTop,
    titlePaddingX: SUBGRAPH_GEOMETRY_TOKENS.titlePaddingX,
    titleFontSize: CANVAS_VISUAL_TOKENS.subgraph.titleFontSize,
    titleFontWeight: 700,
    minWidth: SUBGRAPH_GEOMETRY_TOKENS.minWidth,
    minHeight: SUBGRAPH_GEOMETRY_TOKENS.minHeight,
    fallbackGap: SUBGRAPH_GEOMETRY_TOKENS.fallbackGap,
    fillOpacity: CANVAS_VISUAL_TOKENS.subgraph.fillOpacity
  },
  edgeLabel: {
    minChars: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.minChars,
    maxChars: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.maxChars,
    paddingX: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.paddingX,
    height: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.height,
    fontSize: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.fontSize,
    lineHeight: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.lineHeight
  },
  diagnostics: {
    minTextContrast: 4.5,
    minFocusContrast: 3,
    minSelectionContrast: 3
  }
};

export const BUILT_IN_EDITOR_THEMES: EditorTheme[] = [
  DEFAULT_EDITOR_THEME,
  builtInTheme({
    id: "classic-light",
    name: "经典浅色",
    description: "清爽浅色界面和绿色主强调。",
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
    },
    render: {
      background: "#f7faf9",
      gridDot: "#172022"
    }
  }),
  builtInTheme({
    id: "high-contrast",
    name: "高对比",
    description: "更强文本、边框和操作反馈对比度。",
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
    },
    render: {
      background: "#fdfbf7",
      gridDot: "#090807"
    }
  })
];

const builtInThemeById = new Map(BUILT_IN_EDITOR_THEMES.map((theme) => [theme.id, theme]));
const hexColorPattern = /^#[0-9a-f]{6}$/i;

export function resolveEditorTheme(themeId: string | undefined, customTheme: unknown): EditorTheme {
  if (themeId === "custom") return normalizeEditorTheme(customTheme, { ...DEFAULT_EDITOR_THEME, id: "custom", name: "自定义主题" });
  return builtInThemeById.get(themeId as EditorThemeId) ?? DEFAULT_EDITOR_THEME;
}

export function normalizeEditorTheme(value: unknown, fallback: EditorTheme = DEFAULT_EDITOR_THEME): EditorTheme {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<EditorTheme> & Record<string, unknown>;

  return {
    version: 2,
    id: "custom",
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : fallback.name,
    description: typeof raw.description === "string" ? raw.description : fallback.description,
    baseThemeId: normalizeBaseThemeId(raw.baseThemeId, fallback.baseThemeId),
    ui: normalizeColorGroup(raw.ui, fallback.ui),
    canvas: normalizeColorGroup(raw.canvas, fallback.canvas),
    source: normalizeColorGroup(raw.source, fallback.source),
    render: normalizeColorGroup(raw.render, fallback.render),
    font: normalizeFontGroup(raw.font, fallback.font),
    space: normalizeNumberGroup(raw.space, fallback.space, numberRanges.space),
    radius: normalizeNumberGroup(raw.radius, fallback.radius, numberRanges.radius),
    stroke: normalizeStrokeGroup(raw.stroke, fallback.stroke),
    icon: normalizeIconGroup(raw.icon, fallback.icon),
    canvasInteraction: normalizeNumberGroup(raw.canvasInteraction, fallback.canvasInteraction, numberRanges.canvasInteraction),
    subgraph: normalizeNumberGroup(raw.subgraph, fallback.subgraph, numberRanges.subgraph),
    edgeLabel: normalizeNumberGroup(raw.edgeLabel, fallback.edgeLabel, numberRanges.edgeLabel),
    diagnostics: normalizeNumberGroup(raw.diagnostics, fallback.diagnostics, numberRanges.diagnostics)
  };
}

export function compileEditorTheme(theme: EditorTheme): CompiledEditorTheme {
  return {
    theme,
    cssVariables: themeToCssVariables(theme),
    canvasVisualTokens: themeToCanvasVisualTokens(theme),
    mermaidThemeVariables: themeToMermaidThemeVariables(theme),
    geometry: themeToGeometryTokens(theme),
    diagnostics: themeDiagnostics(theme)
  };
}

export function themeToCssVariables(theme: EditorTheme): Record<string, string> {
  return {
    "--font-sans": theme.font.familySans,
    "--font-mono": theme.font.familyMono,
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
    "--source-line": hexToHslTriplet(theme.source.line),
    "--render-background": hexToHslTriplet(theme.render.background),
    "--render-grid-dot": hexToHslTriplet(theme.render.gridDot),
    "--radius": `${theme.radius.app}px`,
    "--theme-panel-padding": `${theme.space.panelPadding}px`,
    "--theme-panel-header-height": `${theme.space.panelHeaderHeight}px`,
    "--theme-panel-footer-height": `${theme.space.panelFooterHeight}px`,
    "--theme-source-line-height": `${theme.font.lineHeightSource}px`
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
    },
    node: {
      cornerRadius: theme.radius.canvasNode,
      strokeWidth: theme.stroke.node,
      emphasizedStrokeWidth: theme.stroke.nodeEmphasized
    },
    anchor: {
      radius: theme.canvasInteraction.anchorRadius,
      endpointRadius: theme.canvasInteraction.endpointRadius,
      strokeWidth: theme.stroke.anchor
    },
    edge: {
      hitStrokeWidth: theme.canvasInteraction.edgeHitStrokeWidth,
      strokeWidth: theme.stroke.edge,
      thickStrokeWidth: theme.stroke.edgeThick,
      dottedStrokeWidth: theme.stroke.edge,
      dottedDash: [...theme.stroke.edgeDotted],
      pointerLength: theme.canvasInteraction.pointerLength,
      pointerWidth: theme.canvasInteraction.pointerWidth,
      labelCornerRadius: theme.radius.edgeLabel,
      endpointMarkerRadius: theme.canvasInteraction.endpointMarkerRadius
    },
    overlay: {
      strokeWidth: theme.stroke.overlay,
      selectionDash: [...theme.stroke.selectionDash],
      connectionDash: [...theme.stroke.connectionDraftDash],
      centerGuideDash: [...theme.stroke.centerGuideDash],
      subgraphDash: [...theme.stroke.subgraphDash]
    },
    shape: {
      polygonCornerRadius: theme.radius.polygonCorner,
      fallbackCornerRadius: Math.max(0, theme.radius.controlSm),
      forkCornerRadius: Math.max(0, Math.min(4, theme.radius.controlSm))
    },
    subgraph: {
      fillOpacity: theme.subgraph.fillOpacity,
      titleCornerRadius: theme.radius.subgraphTitle,
      titleInsetX: theme.subgraph.titlePaddingX,
      titleFontSize: theme.subgraph.titleFontSize,
      titleFontWeight: String(theme.subgraph.titleFontWeight),
      titleStrokeWidth: theme.stroke.node,
      anchorCornerScale: CANVAS_VISUAL_TOKENS.subgraph.anchorCornerScale,
      anchorCornerOpacity: CANVAS_VISUAL_TOKENS.subgraph.anchorCornerOpacity
    }
  };
}

export function themeToGeometryTokens(theme: EditorTheme): EditorThemeGeometryTokens {
  return {
    node: {
      minChars: theme.space.nodeMinChars,
      maxChars: theme.space.nodeMaxChars,
      paddingX: theme.space.nodePaddingX,
      paddingY: theme.space.nodePaddingY,
      fontSize: theme.font.sizeNode,
      lineHeight: theme.font.lineHeightNode,
      maxLines: theme.space.nodeMaxLines,
      fontFamily: theme.font.familySans,
      fontWeight: theme.font.weightBold
    },
    edgeLabel: {
      minChars: theme.edgeLabel.minChars,
      maxChars: theme.edgeLabel.maxChars,
      paddingX: theme.edgeLabel.paddingX,
      height: theme.edgeLabel.height,
      fontSize: theme.edgeLabel.fontSize,
      lineHeight: theme.edgeLabel.lineHeight,
      fontFamily: theme.font.familySans,
      fontWeight: theme.font.weightRegular
    },
    subgraph: {
      paddingX: theme.subgraph.paddingX,
      paddingTop: theme.subgraph.paddingTop,
      paddingBottom: theme.subgraph.paddingBottom,
      titleHeight: theme.subgraph.titleHeight,
      titleInsetX: theme.subgraph.titleInsetX,
      titleInsetTop: theme.subgraph.titleInsetTop,
      titlePaddingX: theme.subgraph.titlePaddingX,
      minWidth: theme.subgraph.minWidth,
      minHeight: theme.subgraph.minHeight,
      fallbackGap: theme.subgraph.fallbackGap
    },
    grid: {
      origin: DEFAULT_CANVAS_GRID.origin,
      minorStep: theme.space.gridMinorStep,
      majorEvery: theme.space.gridMajorEvery,
      minorAlpha: theme.canvasInteraction.gridMinorAlpha,
      majorAlpha: theme.canvasInteraction.gridMajorAlpha,
      superAlpha: theme.canvasInteraction.gridSuperAlpha,
      minorRadiusPx: theme.canvasInteraction.gridMinorRadiusPx,
      majorRadiusPx: theme.canvasInteraction.gridMajorRadiusPx,
      superRadiusPx: theme.canvasInteraction.gridSuperRadiusPx,
      maxDots: theme.canvasInteraction.gridMaxDots,
      minorVisibleScale: theme.canvasInteraction.gridMinorVisibleScale,
      majorVisibleScale: theme.canvasInteraction.gridMajorVisibleScale
    }
  };
}

export function themeToMermaidThemeVariables(theme: EditorTheme): MermaidThemeVariables {
  return {
    background: theme.render.background,
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
    fontFamily: theme.font.familySans
  };
}

export function isHexColor(value: string) {
  return hexColorPattern.test(value);
}

function builtInTheme(overrides: Pick<EditorTheme, "id" | "name" | "description"> & Partial<Omit<EditorTheme, "version" | "id" | "name" | "description">>): EditorTheme {
  return {
    ...DEFAULT_EDITOR_THEME,
    ...overrides,
    version: 2,
    ui: { ...DEFAULT_EDITOR_THEME.ui, ...overrides.ui },
    canvas: { ...DEFAULT_EDITOR_THEME.canvas, ...overrides.canvas },
    source: { ...DEFAULT_EDITOR_THEME.source, ...overrides.source },
    render: { ...DEFAULT_EDITOR_THEME.render, ...overrides.render },
    font: { ...DEFAULT_EDITOR_THEME.font, ...overrides.font },
    space: { ...DEFAULT_EDITOR_THEME.space, ...overrides.space },
    radius: { ...DEFAULT_EDITOR_THEME.radius, ...overrides.radius },
    stroke: { ...DEFAULT_EDITOR_THEME.stroke, ...overrides.stroke },
    icon: { ...DEFAULT_EDITOR_THEME.icon, ...overrides.icon },
    canvasInteraction: { ...DEFAULT_EDITOR_THEME.canvasInteraction, ...overrides.canvasInteraction },
    subgraph: { ...DEFAULT_EDITOR_THEME.subgraph, ...overrides.subgraph },
    edgeLabel: { ...DEFAULT_EDITOR_THEME.edgeLabel, ...overrides.edgeLabel },
    diagnostics: { ...DEFAULT_EDITOR_THEME.diagnostics, ...overrides.diagnostics }
  };
}

function normalizeBaseThemeId(value: unknown, fallback: EditorTheme["baseThemeId"]) {
  return value === "warm-paper" || value === "classic-light" || value === "high-contrast" ? value : fallback;
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

function normalizeFontGroup(raw: unknown, fallback: EditorTheme["font"]): EditorTheme["font"] {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    familySans: typeof source.familySans === "string" && source.familySans.trim() ? source.familySans : fallback.familySans,
    familyMono: typeof source.familyMono === "string" && source.familyMono.trim() ? source.familyMono : fallback.familyMono,
    sizeUiXs: numberValue(source.sizeUiXs, fallback.sizeUiXs, 10, 18),
    sizeUiSm: numberValue(source.sizeUiSm, fallback.sizeUiSm, 11, 20),
    sizeNode: numberValue(source.sizeNode, fallback.sizeNode, 10, 28),
    sizeEdgeLabel: numberValue(source.sizeEdgeLabel, fallback.sizeEdgeLabel, 9, 24),
    sizeSource: numberValue(source.sizeSource, fallback.sizeSource, 10, 22),
    weightRegular: numberValue(source.weightRegular, fallback.weightRegular, 300, 700),
    weightMedium: numberValue(source.weightMedium, fallback.weightMedium, 400, 800),
    weightBold: numberValue(source.weightBold, fallback.weightBold, 500, 900),
    lineHeightNode: numberValue(source.lineHeightNode, fallback.lineHeightNode, 12, 42),
    lineHeightEdgeLabel: numberValue(source.lineHeightEdgeLabel, fallback.lineHeightEdgeLabel, 12, 36),
    lineHeightSource: numberValue(source.lineHeightSource, fallback.lineHeightSource, 20, 44),
    letterSpacing: numberValue(source.letterSpacing, fallback.letterSpacing, 0, 2)
  };
}

function normalizeNumberGroup<T extends Record<string, number>>(raw: unknown, fallback: T, ranges: Record<keyof T, [number, number]>): T {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => {
      const range = ranges[key as keyof T];
      return [key, numberValue(source[key], fallbackValue, range[0], range[1])];
    })
  ) as T;
}

function normalizeStrokeGroup(raw: unknown, fallback: EditorTheme["stroke"]): EditorTheme["stroke"] {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    node: numberValue(source.node, fallback.node, 0.5, 8),
    nodeEmphasized: numberValue(source.nodeEmphasized, fallback.nodeEmphasized, 0.5, 10),
    edge: numberValue(source.edge, fallback.edge, 0.5, 10),
    edgeThick: numberValue(source.edgeThick, fallback.edgeThick, 1, 14),
    edgeDotted: dashValue(source.edgeDotted, fallback.edgeDotted),
    overlay: numberValue(source.overlay, fallback.overlay, 0.5, 6),
    anchor: numberValue(source.anchor, fallback.anchor, 0.5, 8),
    selectionDash: dashValue(source.selectionDash, fallback.selectionDash),
    connectionDraftDash: dashValue(source.connectionDraftDash, fallback.connectionDraftDash),
    centerGuideDash: dashValue(source.centerGuideDash, fallback.centerGuideDash),
    subgraphDash: dashValue(source.subgraphDash, fallback.subgraphDash)
  };
}

function normalizeIconGroup(raw: unknown, fallback: EditorTheme["icon"]): EditorTheme["icon"] {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    family: "iconoir",
    sizeSm: numberValue(source.sizeSm, fallback.sizeSm, 12, 24),
    sizeButton: numberValue(source.sizeButton, fallback.sizeButton, 12, 28),
    strokeWidth: numberValue(source.strokeWidth, fallback.strokeWidth, 1, 4),
    buttonHeightSm: numberValue(source.buttonHeightSm, fallback.buttonHeightSm, 24, 48),
    buttonHeightMd: numberValue(source.buttonHeightMd, fallback.buttonHeightMd, 32, 56)
  };
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function dashValue(value: unknown, fallback: readonly number[]) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) return [...fallback];
  const numbers = value.map((item) => (typeof item === "number" && Number.isFinite(item) ? item : NaN));
  return numbers.every((item) => item >= 0 && item <= 48) ? numbers : [...fallback];
}

const numberRanges = {
  space: {
    panelPadding: [8, 32],
    panelHeaderHeight: [40, 72],
    panelFooterHeight: [44, 80],
    controlGap: [2, 20],
    controlPaddingX: [4, 28],
    controlPaddingY: [2, 20],
    iconButtonSize: [24, 48],
    nodePaddingX: [4, 40],
    nodePaddingY: [4, 40],
    nodeMinChars: [2, 24],
    nodeMaxChars: [8, 60],
    nodeMaxLines: [2, 30],
    gridMinorStep: [8, 80],
    gridMajorEvery: [2, 12]
  },
  radius: {
    app: [0, 16],
    controlSm: [0, 16],
    controlMd: [0, 20],
    controlLg: [0, 24],
    canvasNode: [0, 48],
    edgeLabel: [0, 24],
    polygonCorner: [0, 24],
    subgraphTitle: [0, 24]
  },
  canvasInteraction: {
    anchorRadius: [3, 16],
    endpointRadius: [3, 18],
    edgeHitStrokeWidth: [8, 40],
    pointerLength: [0, 32],
    pointerWidth: [0, 32],
    endpointMarkerRadius: [2, 12],
    gridMinorAlpha: [0, 1],
    gridMajorAlpha: [0, 1],
    gridSuperAlpha: [0, 1],
    gridMaxDots: [800, 20000],
    gridMinorVisibleScale: [0.1, 2],
    gridMajorVisibleScale: [0.05, 1],
    gridMinorRadiusPx: [0.2, 3],
    gridMajorRadiusPx: [0.2, 4],
    gridSuperRadiusPx: [0.2, 5]
  },
  subgraph: {
    paddingX: [8, 96],
    paddingTop: [24, 120],
    paddingBottom: [8, 96],
    titleHeight: [18, 56],
    titleInsetX: [4, 48],
    titleInsetTop: [4, 40],
    titlePaddingX: [4, 32],
    titleFontSize: [9, 24],
    titleFontWeight: [300, 900],
    minWidth: [80, 520],
    minHeight: [60, 360],
    fallbackGap: [16, 160],
    fillOpacity: [0, 1]
  },
  edgeLabel: {
    minChars: [1, 20],
    maxChars: [4, 60],
    paddingX: [2, 32],
    height: [18, 64],
    fontSize: [9, 24],
    lineHeight: [10, 36]
  },
  diagnostics: {
    minTextContrast: [1, 7],
    minFocusContrast: [1, 7],
    minSelectionContrast: [1, 7]
  }
} as const satisfies {
  space: Record<keyof EditorTheme["space"], [number, number]>;
  radius: Record<keyof EditorTheme["radius"], [number, number]>;
  canvasInteraction: Record<keyof EditorTheme["canvasInteraction"], [number, number]>;
  subgraph: Record<keyof EditorTheme["subgraph"], [number, number]>;
  edgeLabel: Record<keyof EditorTheme["edgeLabel"], [number, number]>;
  diagnostics: Record<keyof EditorTheme["diagnostics"], [number, number]>;
};

function themeDiagnostics(theme: EditorTheme): ThemeDiagnostic[] {
  const diagnostics: ThemeDiagnostic[] = [];
  addContrastDiagnostic(diagnostics, "APP_TEXT_CONTRAST", "应用文字与背景对比度不足。", theme.ui.foreground, theme.ui.background, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(diagnostics, "CANVAS_NODE_TEXT_CONTRAST", "节点文字与节点表面对比度不足。", theme.canvas.nodeText, theme.canvas.surface, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(diagnostics, "FOCUS_CONTRAST", "主强调色与应用背景对比度偏低，焦点和选中状态可能不清晰。", theme.ui.primary, theme.ui.background, theme.diagnostics.minFocusContrast);
  addContrastDiagnostic(diagnostics, "SELECTION_CONTRAST", "主强调色与画布表面对比度偏低，画布选中状态可能不清晰。", theme.ui.primary, theme.canvas.surface, theme.diagnostics.minSelectionContrast);
  return diagnostics;
}

function addContrastDiagnostic(diagnostics: ThemeDiagnostic[], code: string, message: string, foreground: string, background: string, minimum: number) {
  if (contrastRatio(foreground, background) >= minimum) return;
  diagnostics.push({ severity: "warning", code, message });
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
  const rgb = hexToRgb(value);
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

function hexToRgba(value: string, alpha: number) {
  const rgb = hexToRgb(value);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
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

function contrastRatio(foreground: string, background: string) {
  const foregroundLum = relativeLuminance(hexToRgb(foreground));
  const backgroundLum = relativeLuminance(hexToRgb(background));
  const lighter = Math.max(foregroundLum, backgroundLum);
  const darker = Math.min(foregroundLum, backgroundLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(rgb: { r: number; g: number; b: number }) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
