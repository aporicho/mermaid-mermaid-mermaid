import { DEFAULT_CANVAS_GRID } from "@/features/mermaid-editor/lib/canvas-grid";
import { CANVAS_VISUAL_TOKENS } from "@/features/mermaid-editor/lib/canvas-visual-state";
import { DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/edge-label-geometry";
import { DEFAULT_NODE_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/node-geometry";
import { SUBGRAPH_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/subgraph-geometry";
import { createDefaultMarkdownTheme, mergeMarkdownTheme, type DeepPartial } from "./markdown-theme";
import { DEFAULT_EDITOR_MOTION, MERMAID_FONT_FAMILY, MONO_FONT_FAMILY, type EditorMotionTokens, type EditorTheme } from "./types";

export type EditorThemeOverrides = Pick<EditorTheme, "id" | "name" | "description"> &
  DeepPartial<Omit<EditorTheme, "version" | "id" | "name" | "description">>;

const BASE_UI: EditorTheme["ui"] = {
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
};

const BASE_FONT: EditorTheme["font"] = {
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
};

export const EDITOR_THEME_BASE: Omit<EditorTheme, "id" | "name" | "description" | "baseThemeId"> = {
  version: 5,
  ui: BASE_UI,
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
  markdown: createDefaultMarkdownTheme({ ui: BASE_UI, font: BASE_FONT }),
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
  font: BASE_FONT,
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

export function createEditorTheme(overrides: EditorThemeOverrides): EditorTheme {
  const ui = { ...EDITOR_THEME_BASE.ui, ...overrides.ui };
  const font = { ...EDITOR_THEME_BASE.font, ...overrides.font };
  const markdown = mergeMarkdownTheme(createDefaultMarkdownTheme({ ui, font }), overrides.markdown);

  return {
    ...EDITOR_THEME_BASE,
    ...overrides,
    version: 5,
    id: overrides.id,
    name: overrides.name,
    description: overrides.description,
    ui,
    canvas: { ...EDITOR_THEME_BASE.canvas, ...overrides.canvas },
    source: { ...EDITOR_THEME_BASE.source, ...overrides.source },
    render: { ...EDITOR_THEME_BASE.render, ...overrides.render },
    markdown,
    ansi: { ...EDITOR_THEME_BASE.ansi, ...overrides.ansi },
    terminal: { ...EDITOR_THEME_BASE.terminal, ...overrides.terminal },
    font,
    space: { ...EDITOR_THEME_BASE.space, ...overrides.space },
    radius: { ...EDITOR_THEME_BASE.radius, ...overrides.radius },
    stroke: { ...EDITOR_THEME_BASE.stroke, ...overrides.stroke },
    icon: { ...EDITOR_THEME_BASE.icon, ...overrides.icon },
    canvasInteraction: { ...EDITOR_THEME_BASE.canvasInteraction, ...overrides.canvasInteraction },
    subgraph: { ...EDITOR_THEME_BASE.subgraph, ...overrides.subgraph },
    edgeLabel: { ...EDITOR_THEME_BASE.edgeLabel, ...overrides.edgeLabel },
    motion: mergeMotionTokens(EDITOR_THEME_BASE.motion, overrides.motion),
    diagnostics: { ...EDITOR_THEME_BASE.diagnostics, ...overrides.diagnostics }
  };
}

function mergeMotionTokens(fallback: EditorMotionTokens, overrides: DeepPartial<EditorMotionTokens> | undefined): EditorMotionTokens {
  return {
    duration: { ...fallback.duration, ...overrides?.duration },
    ease: { ...fallback.ease, ...overrides?.ease },
    distance: { ...fallback.distance, ...overrides?.distance },
    stagger: { ...fallback.stagger, ...overrides?.stagger },
    canvas: { ...fallback.canvas, ...overrides?.canvas }
  };
}
