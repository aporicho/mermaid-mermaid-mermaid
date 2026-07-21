import type { CanvasGridSpec } from "@/features/mermaid-editor/lib/canvas-grid";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { EdgeLabelGeometryTokens } from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { NodeGeometryTokens } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometryTokens } from "@/features/mermaid-editor/lib/subgraph-geometry";
import type { MarkdownThemeTokens } from "./markdown-types";
import type { SpecialNodeThemeTokens } from "./special-node-types";
import type { EditorTypographyTokens } from "./typography-types";
import type { CanvasThemeTokens, InterfaceThemeTokens } from "./appearance-types";

export type {
  MarkdownBlockquoteTokens,
  MarkdownBodyTokens,
  MarkdownCodeBlockTokens,
  MarkdownHeadingTokens,
  MarkdownInlineCodeTokens,
  MarkdownLinkTokens,
  MarkdownListTokens,
  MarkdownStrikethroughTokens,
  MarkdownTableTokens,
  MarkdownTaskListTokens,
  MarkdownTextTokens,
  MarkdownThemeTokens
} from "./markdown-types";
export type { EditorTypographyTokens, TypographyRoleTokens } from "./typography-types";
export type {
  SpecialNodeCommonTokens,
  SpecialNodeImageTokens,
  SpecialNodeLinkCardTokens,
  SpecialNodeMarkdownDocumentTokens,
  SpecialNodeSharedTokens,
  SpecialNodeStateTokens,
  SpecialNodeSurfaceTokens,
  SpecialNodeTableTokens,
  SpecialNodeThemeTokens,
  SpecialNodeVisualState
} from "./special-node-types";
export type { CanvasBorderTokens, CanvasStrokeStyle, CanvasThemeTokens, CssBorderStyle, CssBorderTokens, InterfaceThemeTokens, ShadowTokens } from "./appearance-types";

export const MERMAID_FONT_FAMILY = "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei UI, Microsoft YaHei, system-ui, sans-serif";
export const MONO_FONT_FAMILY = "Maple Mono, SF Mono, Cascadia Code, JetBrains Mono, Noto Sans SC Variable, ui-monospace, monospace";

export type EditorThemeId = string;

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
  version: 11;
  id: EditorThemeId;
  name: string;
  description: string;
  baseThemeId?: string;
  interface: InterfaceThemeTokens;
  canvas: CanvasThemeTokens;
  specialNode: SpecialNodeThemeTokens;
  source: {
    line: string;
  };
  markdown: MarkdownThemeTokens;
  ansi: AnsiColorTokens;
  terminal: TerminalColorTokens;
  typography: EditorTypographyTokens;
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
  typography: EditorTypographyTokens;
  specialNode: SpecialNodeThemeTokens;
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
