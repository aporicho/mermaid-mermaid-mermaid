import { DEFAULT_CANVAS_GRID } from "@/features/mermaid-editor/lib/canvas-grid";
import { CANVAS_VISUAL_TOKENS } from "@/features/mermaid-editor/lib/canvas-visual-state";
import { DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/edge-label-geometry";
import { DEFAULT_NODE_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/node-geometry";
import { SUBGRAPH_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/subgraph-geometry";
import { DEFAULT_EDITOR_MOTION, MERMAID_FONT_FAMILY, MONO_FONT_FAMILY, type EditorMotionTokens, type EditorTheme } from "./types";

export const DEFAULT_EDITOR_THEME: EditorTheme = {
  version: 4,
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
  ansi: {
    black: "#2a251f",
    red: "#b91f31",
    green: "#36724f",
    yellow: "#a66a00",
    blue: "#2f5f9f",
    magenta: "#8b4a82",
    cyan: "#2f7380",
    white: "#e7ded3",
    brightBlack: "#76695e",
    brightRed: "#ff4050",
    brightGreen: "#4c9567",
    brightYellow: "#d8901e",
    brightBlue: "#4f7fc5",
    brightMagenta: "#b869a9",
    brightCyan: "#4896a6",
    brightWhite: "#fffaf4"
  },
  terminal: {
    background: "#fcf8f2",
    foreground: "#18130f",
    cursor: "#ff4050",
    cursorAccent: "#f8f3ec",
    selectionBackground: "#ffe7ea",
    selectionForeground: "#18130f"
  },
  font: {
    familySans: MERMAID_FONT_FAMILY,
    familyMono: MONO_FONT_FAMILY,
    sizeUiXs: 12,
    sizeUiSm: 14,
    sizeNode: DEFAULT_NODE_GEOMETRY_TOKENS.fontSize,
    sizeEdgeLabel: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.fontSize,
    sizeSource: 13,
    sizeTerminal: 13,
    weightRegular: 400,
    weightMedium: 500,
    weightBold: DEFAULT_NODE_GEOMETRY_TOKENS.fontWeight,
    lineHeightNode: DEFAULT_NODE_GEOMETRY_TOKENS.lineHeight,
    lineHeightEdgeLabel: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.lineHeight,
    lineHeightSource: 30,
    lineHeightTerminal: 20,
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
    parallelEdgeSpacing: CANVAS_VISUAL_TOKENS.edge.parallelSpacing,
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
  motion: DEFAULT_EDITOR_MOTION,
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
    },
    ansi: {
      black: "#25302f",
      red: "#b63e4b",
      green: "#1f7a68",
      yellow: "#8a6f19",
      blue: "#326c8a",
      magenta: "#80618f",
      cyan: "#297782",
      white: "#e8f0ee",
      brightBlack: "#667977",
      brightRed: "#d85a66",
      brightGreen: "#2f9a83",
      brightYellow: "#ae8d2a",
      brightBlue: "#4c8aac",
      brightMagenta: "#9e78ad",
      brightCyan: "#3b98a5",
      brightWhite: "#ffffff"
    },
    terminal: {
      background: "#ffffff",
      foreground: "#172022",
      cursor: "#1f7a68",
      cursorAccent: "#f7faf9",
      selectionBackground: "#e4f3ef",
      selectionForeground: "#172022"
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
    },
    ansi: {
      black: "#090807",
      red: "#9f1020",
      green: "#126b45",
      yellow: "#8c6100",
      blue: "#174f94",
      magenta: "#7a2875",
      cyan: "#126a72",
      white: "#e8e0d8",
      brightBlack: "#4d463f",
      brightRed: "#ff3045",
      brightGreen: "#0f8a58",
      brightYellow: "#b87f00",
      brightBlue: "#276fc2",
      brightMagenta: "#a43a9d",
      brightCyan: "#188996",
      brightWhite: "#ffffff"
    },
    terminal: {
      background: "#ffffff",
      foreground: "#090807",
      cursor: "#ff3045",
      cursorAccent: "#fdfbf7",
      selectionBackground: "#ffe0e4",
      selectionForeground: "#090807"
    }
  })
];

function builtInTheme(overrides: Pick<EditorTheme, "id" | "name" | "description"> & Partial<Omit<EditorTheme, "version" | "id" | "name" | "description">>): EditorTheme {
  return {
    ...DEFAULT_EDITOR_THEME,
    ...overrides,
    version: 4,
    ui: { ...DEFAULT_EDITOR_THEME.ui, ...overrides.ui },
    canvas: { ...DEFAULT_EDITOR_THEME.canvas, ...overrides.canvas },
    source: { ...DEFAULT_EDITOR_THEME.source, ...overrides.source },
    render: { ...DEFAULT_EDITOR_THEME.render, ...overrides.render },
    ansi: { ...DEFAULT_EDITOR_THEME.ansi, ...overrides.ansi },
    terminal: { ...DEFAULT_EDITOR_THEME.terminal, ...overrides.terminal },
    font: { ...DEFAULT_EDITOR_THEME.font, ...overrides.font },
    space: { ...DEFAULT_EDITOR_THEME.space, ...overrides.space },
    radius: { ...DEFAULT_EDITOR_THEME.radius, ...overrides.radius },
    stroke: { ...DEFAULT_EDITOR_THEME.stroke, ...overrides.stroke },
    icon: { ...DEFAULT_EDITOR_THEME.icon, ...overrides.icon },
    canvasInteraction: { ...DEFAULT_EDITOR_THEME.canvasInteraction, ...overrides.canvasInteraction },
    subgraph: { ...DEFAULT_EDITOR_THEME.subgraph, ...overrides.subgraph },
    edgeLabel: { ...DEFAULT_EDITOR_THEME.edgeLabel, ...overrides.edgeLabel },
    motion: mergeMotionTokens(DEFAULT_EDITOR_THEME.motion, overrides.motion),
    diagnostics: { ...DEFAULT_EDITOR_THEME.diagnostics, ...overrides.diagnostics }
  };
}

function mergeMotionTokens(fallback: EditorMotionTokens, overrides: Partial<EditorMotionTokens> | undefined): EditorMotionTokens {
  return {
    duration: { ...fallback.duration, ...overrides?.duration },
    ease: { ...fallback.ease, ...overrides?.ease },
    distance: { ...fallback.distance, ...overrides?.distance },
    stagger: { ...fallback.stagger, ...overrides?.stagger },
    canvas: { ...fallback.canvas, ...overrides?.canvas }
  };
}
