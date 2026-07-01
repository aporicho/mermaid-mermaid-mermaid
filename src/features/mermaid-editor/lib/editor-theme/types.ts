import type { CanvasGridSpec } from "@/features/mermaid-editor/lib/canvas-grid";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { EdgeLabelGeometryTokens } from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { NodeGeometryTokens } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometryTokens } from "@/features/mermaid-editor/lib/subgraph-geometry";

export const MERMAID_FONT_FAMILY = "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei UI, Microsoft YaHei, system-ui, sans-serif";
export const MONO_FONT_FAMILY = "Maple Mono, SF Mono, Cascadia Code, JetBrains Mono, Noto Sans SC Variable, ui-monospace, monospace";

export type EditorThemeId = "warm-paper" | "classic-light" | "high-contrast" | "custom";

export type ThemeDiagnostic = {
  severity: "warning";
  code: string;
  message: string;
};

export type AnsiColorTokens = {
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
};

export type TerminalColorTokens = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground: string;
};

export type EditorMotionTokens = {
  duration: {
    fast: number;
    base: number;
    slow: number;
    layout: number;
  };
  ease: {
    standard: string;
    emphasized: string;
    exit: string;
    linear: string;
  };
  distance: {
    chrome: number;
    panel: number;
    viewport: number;
  };
  stagger: {
    button: number;
    list: number;
  };
  canvas: {
    createScale: number;
    selectedScale: number;
    highlightDuration: number;
    maxAnimatedItems: number;
    proximityRadiusPx: number;
    proximityMaxScale: number;
    proximityDuration: number;
  };
};

export type XtermThemeTokens = TerminalColorTokens &
  AnsiColorTokens & {
    selectionInactiveBackground: string;
    scrollbarSliderBackground: string;
    scrollbarSliderHoverBackground: string;
    scrollbarSliderActiveBackground: string;
    overviewRulerBorder: string;
  };

export type EditorTheme = {
  version: 4;
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
  ansi: AnsiColorTokens;
  terminal: TerminalColorTokens;
  font: {
    familySans: string;
    familyMono: string;
    sizeUiXs: number;
    sizeUiSm: number;
    sizeNode: number;
    sizeEdgeLabel: number;
    sizeSource: number;
    sizeTerminal: number;
    weightRegular: number;
    weightMedium: number;
    weightBold: number;
    lineHeightNode: number;
    lineHeightEdgeLabel: number;
    lineHeightSource: number;
    lineHeightTerminal: number;
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
    parallelEdgeSpacing: number;
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
  motion: EditorMotionTokens;
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
  terminalTheme: XtermThemeTokens;
  motion: EditorMotionTokens;
  geometry: EditorThemeGeometryTokens;
  diagnostics: ThemeDiagnostic[];
};

export const DEFAULT_EDITOR_MOTION: EditorMotionTokens = {
  duration: {
    fast: 0.1,
    base: 0.18,
    slow: 0.28,
    layout: 0.36
  },
  ease: {
    standard: "power2.out",
    emphasized: "power3.out",
    exit: "power2.in",
    linear: "none"
  },
  distance: {
    chrome: 8,
    panel: 24,
    viewport: 64
  },
  stagger: {
    button: 0.025,
    list: 0.018
  },
  canvas: {
    createScale: 0.98,
    selectedScale: 1.015,
    highlightDuration: 0.55,
    maxAnimatedItems: 80,
    proximityRadiusPx: 200,
    proximityMaxScale: 2.5,
    proximityDuration: 0.35
  }
};
