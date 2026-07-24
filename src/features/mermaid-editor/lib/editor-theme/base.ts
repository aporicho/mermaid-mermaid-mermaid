import { DEFAULT_CANVAS_GRID } from "@/features/mermaid-editor/lib/canvas-grid";
import { DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/edge-label-geometry";
import { DEFAULT_NODE_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/node-geometry";
import { SUBGRAPH_GEOMETRY_TOKENS } from "@/features/mermaid-editor/lib/subgraph-geometry";
import type { CanvasThemeTokens, InterfaceThemeTokens, ShadowTokens } from "./appearance-types";
import { createDefaultAgentTheme, normalizeAgentTheme } from "./agent-theme";
import { createDefaultMarkdownTheme, mergeMarkdownTheme, type DeepPartial } from "./markdown-theme";
import { createDefaultSpecialNodeTheme, normalizeSpecialNodeTheme } from "./special-node-theme";
import { migrateCanvasThemeV11, migrateInterfaceThemeV11, objectValue } from "./theme-v11-migration";
import { createDefaultEditorTypography, mergeEditorTypography } from "./typography";
import { DEFAULT_EDITOR_MOTION, MERMAID_FONT_FAMILY, MONO_FONT_FAMILY, type EditorMotionTokens, type EditorTheme } from "./types";

export type EditorThemeOverrides = Pick<EditorTheme, "id" | "name" | "description"> &
  DeepPartial<Omit<EditorTheme, "version" | "id" | "name" | "description">> &
  Record<string, unknown>;

const BASE_COLORS: InterfaceThemeTokens["colors"] = {
  background: "#f8f3ec",
  foreground: "#18130f",
  icon: "#66584d",
  card: "#fcf8f2",
  cardForeground: "#18130f",
  popover: "#fcf8f2",
  popoverForeground: "#18130f",
  primary: "#ff4050",
  primaryForeground: "#f8f3ec",
  secondary: "#eee8df",
  secondaryForeground: "#18130f",
  muted: "#f0ebe4",
  mutedForeground: "#6b625a",
  accent: "#ffe7ea",
  accentForeground: "#b91f31",
  destructive: "#b91f31",
  destructiveForeground: "#f8f3ec",
  success: "#36724f",
  successForeground: "#fffaf4",
  warning: "#a66a00",
  warningForeground: "#fffaf4",
  info: "#2f5f9f",
  infoForeground: "#fffaf4",
  border: "#b8ada0",
  input: "#b8ada0",
  focusRing: "#ff4050"
};

const shadow = (blur: number, opacity: number, offsetY: number): ShadowTokens => ({
  color: BASE_COLORS.foreground,
  blur,
  opacity,
  offsetX: 0,
  offsetY
});

const LEGACY_CANVAS_VISUAL_TOKENS = {
  node: { strokeWidth: 1, emphasizedStrokeWidth: 1.5, cornerRadius: 14 },
  shape: { fallbackCornerRadius: 4, polygonCornerRadius: 6, forkCornerRadius: 2 },
  edge: {
    strokeWidth: 2,
    thickStrokeWidth: 4,
    dottedStrokeWidth: 2,
    dottedDash: [1, 8] as const,
    pointerLength: 10,
    pointerWidth: 10,
    endpointMarkerRadius: 4.5,
    hitStrokeWidth: 18,
    parallelSpacing: 18,
    curveSegments: 120,
    labelCornerRadius: 8
  },
  overlay: {
    strokeWidth: 1,
    subgraphDash: [8, 6] as const,
    selectionDash: [6, 5] as const,
    connectionDash: [8, 6] as const,
    centerGuideDash: [6, 5] as const
  },
  subgraph: {
    fillOpacity: 0.34,
    titleCornerRadius: 8,
    anchorCornerScale: 0.72,
    anchorCornerOpacity: 0.65
  },
  anchor: { strokeWidth: 2, radius: 6, endpointRadius: 7 }
} as const;

export const BASE_INTERFACE: InterfaceThemeTokens = {
  colors: BASE_COLORS,
  surface: {
    borderWidth: 1,
    borderStyle: "solid",
    dividerWidth: 1,
    focusRingWidth: 1,
    opacity: 0.96,
    backdropBlur: 8
  },
  state: {
    hoverOpacity: 0.9,
    pressedOpacity: 0.82,
    selectedOpacity: 1,
    disabledOpacity: 0.5
  },
  radius: {
    app: 8,
    controlSm: 4,
    controlMd: 6,
    controlLg: 8
  },
  shadow: {
    popover: shadow(24, 0.112, 8),
    panel: shadow(36, 0.16, 12),
    dialog: shadow(60, 0.2, 18),
    toolbar: shadow(20, 0.112, 6)
  },
  spacing: {
    panelPadding: 16,
    panelHeaderHeight: 52,
    panelFooterHeight: 56,
    controlGap: 8,
    controlPaddingX: 12,
    controlPaddingY: 8,
    iconButtonSize: 32
  },
  icon: {
    family: "iconoir",
    sizeSm: 16,
    sizeButton: 16,
    strokeWidth: 2.2,
    buttonHeightSm: 32,
    buttonHeightMd: 40
  },
  scrollbar: {
    size: 10,
    minThumbLength: 28,
    radius: 999,
    inset: 2,
    opacity: 0.3,
    hoverOpacity: 0.48,
    activeOpacity: 0.62
  },
  tree: {
    foreground: BASE_COLORS.foreground,
    iconColor: BASE_COLORS.icon,
    connectorColor: BASE_COLORS.border,
    connectorOpacity: 0.55,
    connectorStyle: "solid",
    hoverBackground: BASE_COLORS.accent,
    hoverOpacity: 0.55,
    focusBackground: BASE_COLORS.accent,
    focusOpacity: 0.7,
    selectedBackground: BASE_COLORS.accent,
    selectedForeground: BASE_COLORS.accentForeground,
    rowHeight: 32,
    rowPaddingStart: 6,
    rowPaddingEnd: 8,
    rowPaddingY: 4,
    contentGap: 6,
    levelIndent: 20,
    connectorRailInset: 6,
    connectorWidth: 1,
    iconSize: 16
  }
};

export const BASE_CANVAS: CanvasThemeTokens = {
  surface: {
    background: "#fbf6ef",
    renderBackground: BASE_COLORS.background
  },
  grid: {
    color: BASE_COLORS.foreground,
    minorStep: DEFAULT_CANVAS_GRID.minorStep,
    majorEvery: DEFAULT_CANVAS_GRID.majorEvery,
    minorAlpha: DEFAULT_CANVAS_GRID.minorAlpha,
    majorAlpha: DEFAULT_CANVAS_GRID.majorAlpha,
    superAlpha: DEFAULT_CANVAS_GRID.superAlpha,
    minorRadiusPx: DEFAULT_CANVAS_GRID.minorRadiusPx,
    majorRadiusPx: DEFAULT_CANVAS_GRID.majorRadiusPx,
    superRadiusPx: DEFAULT_CANVAS_GRID.superRadiusPx,
    minorVisibleScale: DEFAULT_CANVAS_GRID.minorVisibleScale,
    majorVisibleScale: DEFAULT_CANVAS_GRID.majorVisibleScale,
    maxDots: DEFAULT_CANVAS_GRID.maxDots
  },
  ordinaryNode: {
    textColor: BASE_COLORS.foreground,
    borderColor: "#2a251f",
    hoverBorderColor: BASE_COLORS.accentForeground,
    selectedBorderColor: BASE_COLORS.primary,
    invalidBorderColor: "#9b5a50",
    borderWidth: LEGACY_CANVAS_VISUAL_TOKENS.node.strokeWidth,
    emphasizedBorderWidth: LEGACY_CANVAS_VISUAL_TOKENS.node.emphasizedStrokeWidth,
    highlightBorderBoost: 1,
    borderStyle: "solid",
    customDash: [],
    fillSaturation: 1,
    fillLuminanceSteps: 256,
    radius: LEGACY_CANVAS_VISUAL_TOKENS.shape.fallbackCornerRadius,
    roundedRadius: LEGACY_CANVAS_VISUAL_TOKENS.node.cornerRadius,
    polygonRadius: LEGACY_CANVAS_VISUAL_TOKENS.shape.polygonCornerRadius,
    forkRadius: LEGACY_CANVAS_VISUAL_TOKENS.shape.forkCornerRadius,
    shadow: { color: "#2a251f", blur: 0, opacity: 0, offsetX: 0, offsetY: 0 },
    dragShadow: { color: "#2a251f", blur: 12, opacity: 0.22, offsetX: 0, offsetY: 4 },
    paddingX: DEFAULT_NODE_GEOMETRY_TOKENS.paddingX,
    paddingY: DEFAULT_NODE_GEOMETRY_TOKENS.paddingY,
    minChars: DEFAULT_NODE_GEOMETRY_TOKENS.minChars,
    maxChars: DEFAULT_NODE_GEOMETRY_TOKENS.maxChars,
    maxLines: DEFAULT_NODE_GEOMETRY_TOKENS.maxLines
  },
  edge: {
    color: "#2a251f",
    textColor: "#1c1712",
    hoverColor: BASE_COLORS.accentForeground,
    selectedColor: BASE_COLORS.primary,
    invalidColor: "#9b5a50",
    width: LEGACY_CANVAS_VISUAL_TOKENS.edge.strokeWidth,
    thickWidth: LEGACY_CANVAS_VISUAL_TOKENS.edge.thickStrokeWidth,
    dottedWidth: LEGACY_CANVAS_VISUAL_TOKENS.edge.dottedStrokeWidth,
    emphasizedWidth: LEGACY_CANVAS_VISUAL_TOKENS.edge.strokeWidth + 1,
    highlightBorderBoost: 0,
    style: "solid",
    customDash: [],
    dottedDash: LEGACY_CANVAS_VISUAL_TOKENS.edge.dottedDash,
    invisibleOpacity: 0.32,
    invalidPreviewOpacity: 0.48,
    pointerLength: LEGACY_CANVAS_VISUAL_TOKENS.edge.pointerLength,
    pointerWidth: LEGACY_CANVAS_VISUAL_TOKENS.edge.pointerWidth,
    endpointMarkerRadius: LEGACY_CANVAS_VISUAL_TOKENS.edge.endpointMarkerRadius,
    hitStrokeWidth: LEGACY_CANVAS_VISUAL_TOKENS.edge.hitStrokeWidth,
    parallelSpacing: LEGACY_CANVAS_VISUAL_TOKENS.edge.parallelSpacing,
    curveSegments: LEGACY_CANVAS_VISUAL_TOKENS.edge.curveSegments
  },
  edgeLabel: {
    background: "#fbf6ef",
    textColor: "#1c1712",
    borderColor: "#b8ada0",
    hoverBorderColor: BASE_COLORS.accentForeground,
    selectedBorderColor: BASE_COLORS.primary,
    borderWidth: 1,
    borderStyle: "solid",
    customDash: [],
    radius: LEGACY_CANVAS_VISUAL_TOKENS.edge.labelCornerRadius,
    minChars: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.minChars,
    maxChars: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.maxChars,
    paddingX: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.paddingX,
    height: DEFAULT_EDGE_LABEL_GEOMETRY_TOKENS.height
  },
  group: {
    background: "#fbf6ef",
    backgroundOpacity: LEGACY_CANVAS_VISUAL_TOKENS.subgraph.fillOpacity,
    borderColor: "#b8ada0",
    hoverBorderColor: BASE_COLORS.accentForeground,
    selectedBorderColor: BASE_COLORS.primary,
    invalidBorderColor: "#9b5a50",
    borderWidth: LEGACY_CANVAS_VISUAL_TOKENS.overlay.strokeWidth,
    emphasizedBorderWidth: LEGACY_CANVAS_VISUAL_TOKENS.node.emphasizedStrokeWidth,
    borderStyle: "dashed",
    customDash: LEGACY_CANVAS_VISUAL_TOKENS.overlay.subgraphDash,
    radius: LEGACY_CANVAS_VISUAL_TOKENS.node.cornerRadius,
    shadow: { color: "#2a251f", blur: 0, opacity: 0, offsetX: 0, offsetY: 0 },
    paddingX: SUBGRAPH_GEOMETRY_TOKENS.paddingX,
    paddingTop: SUBGRAPH_GEOMETRY_TOKENS.paddingTop,
    paddingBottom: SUBGRAPH_GEOMETRY_TOKENS.paddingBottom,
    minWidth: SUBGRAPH_GEOMETRY_TOKENS.minWidth,
    minHeight: SUBGRAPH_GEOMETRY_TOKENS.minHeight,
    fallbackGap: SUBGRAPH_GEOMETRY_TOKENS.fallbackGap,
    title: {
      background: "#fbf6ef",
      textColor: BASE_COLORS.foreground,
      borderColor: "#b8ada0",
      borderWidth: 0,
      borderStyle: "solid",
      customDash: [],
      radius: LEGACY_CANVAS_VISUAL_TOKENS.subgraph.titleCornerRadius,
      shadow: { color: "#2a251f", blur: 0, opacity: 0, offsetX: 0, offsetY: 0 },
      height: SUBGRAPH_GEOMETRY_TOKENS.titleHeight,
      insetX: SUBGRAPH_GEOMETRY_TOKENS.titleInsetX,
      insetTop: SUBGRAPH_GEOMETRY_TOKENS.titleInsetTop,
      paddingX: SUBGRAPH_GEOMETRY_TOKENS.titlePaddingX
    },
    anchorCornerScale: LEGACY_CANVAS_VISUAL_TOKENS.subgraph.anchorCornerScale,
    anchorCornerOpacity: LEGACY_CANVAS_VISUAL_TOKENS.subgraph.anchorCornerOpacity
  },
  overlay: {
    selection: {
      fillColor: BASE_COLORS.primary,
      fillOpacity: 0.08,
      strokeColor: BASE_COLORS.primary,
      strokeWidth: LEGACY_CANVAS_VISUAL_TOKENS.overlay.strokeWidth,
      strokeStyle: "dashed",
      customDash: LEGACY_CANVAS_VISUAL_TOKENS.overlay.selectionDash
    },
    connectionDraft: {
      validColor: BASE_COLORS.primary,
      invalidColor: "#9f9286",
      invalidOpacity: 0.48,
      strokeWidth: LEGACY_CANVAS_VISUAL_TOKENS.edge.strokeWidth,
      strokeStyle: "dashed",
      customDash: LEGACY_CANVAS_VISUAL_TOKENS.overlay.connectionDash
    },
    guide: {
      centerColor: BASE_COLORS.primary,
      edgeColor: BASE_COLORS.accentForeground,
      strokeWidth: LEGACY_CANVAS_VISUAL_TOKENS.overlay.strokeWidth,
      centerStyle: "dashed",
      customDash: LEGACY_CANVAS_VISUAL_TOKENS.overlay.centerGuideDash
    },
    anchor: {
      fillColor: BASE_COLORS.primary,
      targetColor: BASE_COLORS.primary,
      hoverColor: BASE_COLORS.accentForeground,
      strokeColor: "#fbf6ef",
      strokeWidth: LEGACY_CANVAS_VISUAL_TOKENS.anchor.strokeWidth,
      radius: LEGACY_CANVAS_VISUAL_TOKENS.anchor.radius,
      endpointRadius: LEGACY_CANVAS_VISUAL_TOKENS.anchor.endpointRadius,
      activeRadiusBoost: 1
    }
  },
  actionBadge: {
    background: "#fbf6ef",
    foreground: BASE_COLORS.primary,
    borderColor: BASE_COLORS.primary,
    borderWidth: 1.5,
    borderStyle: "solid",
    customDash: [],
    radius: 9,
    size: 18,
    opacity: 0.96,
    insetX: 10,
    insetY: 10
  },
  mermaidSvg: {
    primaryColor: "#fbf6ef",
    primaryTextColor: BASE_COLORS.foreground,
    primaryBorderColor: "#2a251f",
    secondaryColor: BASE_COLORS.accent,
    secondaryTextColor: BASE_COLORS.foreground,
    tertiaryColor: BASE_COLORS.secondary,
    tertiaryTextColor: BASE_COLORS.foreground,
    lineColor: "#2a251f",
    textColor: BASE_COLORS.foreground,
    edgeLabelBackground: "#fbf6ef",
    clusterBackground: BASE_COLORS.secondary,
    clusterBorderColor: BASE_COLORS.border
  }
};

const BASE_TYPOGRAPHY = createDefaultEditorTypography();
const BASE_MARKDOWN = createDefaultMarkdownTheme({ interface: BASE_INTERFACE, typography: BASE_TYPOGRAPHY });
const BASE_SPECIAL_NODE = createDefaultSpecialNodeTheme({ interface: BASE_INTERFACE, canvas: BASE_CANVAS });
const BASE_AGENT = createDefaultAgentTheme({ interface: BASE_INTERFACE, typography: BASE_TYPOGRAPHY });

export const EDITOR_THEME_BASE: Omit<EditorTheme, "id" | "name" | "description" | "baseThemeId"> = {
  version: 15,
  interface: BASE_INTERFACE,
  agent: BASE_AGENT,
  canvas: BASE_CANVAS,
  specialNode: BASE_SPECIAL_NODE,
  source: { line: "#d7ccc0" },
  markdown: BASE_MARKDOWN,
  ansi: {
    black: "#2a251f", red: "#b91f31", green: "#36724f", yellow: "#a66a00",
    blue: "#2f5f9f", magenta: "#8b4a82", cyan: "#2f7380", white: "#e7ded3",
    brightBlack: "#76695e", brightRed: "#ff4050", brightGreen: "#4c9567", brightYellow: "#d8901e",
    brightBlue: "#4f7fc5", brightMagenta: "#b869a9", brightCyan: "#4896a6", brightWhite: "#fffaf4"
  },
  terminal: {
    background: "#fcf8f2",
    foreground: "#18130f",
    cursor: "#ff4050",
    cursorAccent: "#f8f3ec",
    selectionBackground: "#ffe7ea",
    selectionForeground: "#18130f"
  },
  typography: BASE_TYPOGRAPHY,
  motion: DEFAULT_EDITOR_MOTION,
  diagnostics: { minTextContrast: 4.5, minFocusContrast: 3, minSelectionContrast: 3 }
};

export function createEditorTheme(overrides: EditorThemeOverrides): EditorTheme {
  const raw = overrides as Record<string, unknown>;
  const interfaceTokens = migrateInterfaceThemeV11(raw, BASE_INTERFACE);
  const canvas = migrateCanvasThemeV11(raw, BASE_CANVAS);
  const typography = mergeEditorTypography(BASE_TYPOGRAPHY, raw.typography);
  const markdown = mergeMarkdownTheme(
    createDefaultMarkdownTheme({ interface: interfaceTokens, typography }),
    raw.markdown as DeepPartial<EditorTheme["markdown"]> | undefined
  );
  const specialNode = normalizeSpecialNodeTheme(raw.specialNode, createDefaultSpecialNodeTheme({ interface: interfaceTokens, canvas }));
  const agent = normalizeAgentTheme(raw.agent, createDefaultAgentTheme({ interface: interfaceTokens, typography }));

  return {
    ...EDITOR_THEME_BASE,
    version: 15,
    id: overrides.id,
    name: overrides.name,
    description: overrides.description,
    ...(typeof raw.baseThemeId === "string" ? { baseThemeId: raw.baseThemeId } : {}),
    interface: interfaceTokens,
    agent,
    canvas,
    specialNode,
    source: { ...EDITOR_THEME_BASE.source, ...objectValue(raw.source) },
    markdown,
    ansi: { ...EDITOR_THEME_BASE.ansi, ...objectValue(raw.ansi) },
    terminal: { ...EDITOR_THEME_BASE.terminal, ...objectValue(raw.terminal) },
    typography,
    motion: mergeMotionTokens(EDITOR_THEME_BASE.motion, raw.motion as DeepPartial<EditorMotionTokens> | undefined),
    diagnostics: { ...EDITOR_THEME_BASE.diagnostics, ...objectValue(raw.diagnostics) }
  } as EditorTheme;
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

export const LEGACY_THEME_FONT_FAMILIES = { sans: MERMAID_FONT_FAMILY, mono: MONO_FONT_FAMILY } as const;
