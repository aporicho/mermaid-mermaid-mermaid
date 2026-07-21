import { DEFAULT_EDITOR_THEME, getBuiltInEditorTheme, isBuiltInThemeId } from "./presets";
import type { EditorMotionTokens, EditorTheme } from "./types";
import { isHexColor } from "./color";
import { createDefaultMarkdownTheme, normalizeMarkdownTheme } from "./markdown-theme";
import { normalizeEditorTypography } from "./typography";
import { createDefaultSpecialNodeTheme, normalizeSpecialNodeTheme } from "./special-node-theme";

export function resolveEditorTheme(themeId: string | undefined, customTheme: unknown): EditorTheme {
  if (themeId === "custom") return normalizeEditorTheme(customTheme, { ...DEFAULT_EDITOR_THEME, id: "custom", name: "自定义主题" });
  return getBuiltInEditorTheme(themeId) ?? DEFAULT_EDITOR_THEME;
}

export function normalizeEditorTheme(value: unknown, fallback: EditorTheme = DEFAULT_EDITOR_THEME): EditorTheme {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<EditorTheme> & Record<string, unknown>;
  const ui = normalizeColorGroup(raw.ui, fallback.ui);
  const canvas = normalizeColorGroup(raw.canvas, fallback.canvas);
  const canvasAppearance = normalizeNumberGroup(raw.canvasAppearance, fallback.canvasAppearance, numberRanges.canvasAppearance);
  const chrome = normalizeNumberGroup(raw.chrome, fallback.chrome, numberRanges.chrome);
  const font = normalizeFontGroup(raw.font, fallback.font);
  const radius = normalizeNumberGroup(raw.radius, fallback.radius, numberRanges.radius);
  const stroke = normalizeStrokeGroup(raw.stroke, fallback.stroke);
  const markdownFallback = createDefaultMarkdownTheme({ ui, font });
  const legacyTypography = raw.typography && typeof raw.typography === "object"
    ? (raw.typography as Record<string, unknown>).markdown
    : undefined;
  const markdown = normalizeMarkdownTheme(raw.markdown, markdownFallback, {
    legacyTypography,
    sourceVersion: raw.version
  });
  const typography = normalizeEditorTypography(raw.typography, fallback.typography, {
    font: raw.font,
    subgraph: raw.subgraph,
    edgeLabel: raw.edgeLabel
  });
  const specialNodeFallback = createDefaultSpecialNodeTheme({ ui, canvas, chrome, radius, stroke });
  const specialNode = normalizeSpecialNodeTheme(raw.specialNode, specialNodeFallback);

  return {
    version: 9,
    id: "custom",
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : fallback.name,
    description: typeof raw.description === "string" ? raw.description : fallback.description,
    baseThemeId: normalizeBaseThemeId(raw.baseThemeId, fallback.baseThemeId),
    ui,
    canvas,
    canvasAppearance,
    specialNode,
    chrome,
    source: normalizeColorGroup(raw.source, fallback.source),
    render: normalizeColorGroup(raw.render, fallback.render),
    markdown,
    ansi: normalizeColorGroup(raw.ansi, fallback.ansi),
    terminal: normalizeColorGroup(raw.terminal, fallback.terminal),
    typography,
    font,
    space: normalizeNumberGroup(raw.space, fallback.space, numberRanges.space),
    radius,
    stroke,
    icon: normalizeIconGroup(raw.icon, fallback.icon),
    canvasInteraction: normalizeNumberGroup(raw.canvasInteraction, fallback.canvasInteraction, numberRanges.canvasInteraction),
    subgraph: normalizeNumberGroup(raw.subgraph, fallback.subgraph, numberRanges.subgraph),
    edgeLabel: normalizeNumberGroup(raw.edgeLabel, fallback.edgeLabel, numberRanges.edgeLabel),
    motion: normalizeMotionGroup(raw.motion, fallback.motion),
    diagnostics: normalizeNumberGroup(raw.diagnostics, fallback.diagnostics, numberRanges.diagnostics)
  };
}

function normalizeBaseThemeId(value: unknown, fallback: EditorTheme["baseThemeId"]) {
  return isBuiltInThemeId(value) ? value : fallback;
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
    sizeTerminal: numberValue(source.sizeTerminal, fallback.sizeTerminal, 10, 22),
    weightRegular: numberValue(source.weightRegular, fallback.weightRegular, 300, 700),
    weightMedium: numberValue(source.weightMedium, fallback.weightMedium, 400, 800),
    weightBold: numberValue(source.weightBold, fallback.weightBold, 500, 900),
    lineHeightNode: numberValue(source.lineHeightNode, fallback.lineHeightNode, 12, 42),
    lineHeightEdgeLabel: numberValue(source.lineHeightEdgeLabel, fallback.lineHeightEdgeLabel, 12, 36),
    lineHeightSource: numberValue(source.lineHeightSource, fallback.lineHeightSource, 20, 44),
    lineHeightTerminal: numberValue(source.lineHeightTerminal, fallback.lineHeightTerminal, 14, 32),
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
    node: numberValue(source.node, fallback.node, 0, 8),
    nodeEmphasized: numberValue(source.nodeEmphasized, fallback.nodeEmphasized, 0, 10),
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

function normalizeMotionGroup(raw: unknown, fallback: EditorMotionTokens): EditorMotionTokens {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return mergeMotionTokens(fallback, {
    duration: normalizeNumberGroup(source.duration, fallback.duration, numberRanges.motion.duration),
    ease: normalizeEaseGroup(source.ease, fallback.ease),
    distance: normalizeNumberGroup(source.distance, fallback.distance, numberRanges.motion.distance),
    stagger: normalizeNumberGroup(source.stagger, fallback.stagger, numberRanges.motion.stagger),
    canvas: normalizeNumberGroup(source.canvas, fallback.canvas, numberRanges.motion.canvas)
  });
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

function normalizeEaseGroup(raw: unknown, fallback: EditorMotionTokens["ease"]): EditorMotionTokens["ease"] {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    standard: easeValue(source.standard, fallback.standard),
    emphasized: easeValue(source.emphasized, fallback.emphasized),
    exit: easeValue(source.exit, fallback.exit),
    linear: easeValue(source.linear, fallback.linear)
  };
}

function easeValue(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return /^[a-z0-9.(),_-]+$/i.test(value) ? value : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function dashValue(value: unknown, fallback: readonly number[]) {
  if (!Array.isArray(value) || value.length > 6) return [...fallback];
  if (value.length === 0) return [];
  if (value.length < 2) return [...fallback];
  const numbers = value.map((item) => (typeof item === "number" && Number.isFinite(item) ? item : NaN));
  return numbers.every((item) => item >= 0 && item <= 48) ? numbers : [...fallback];
}

const numberRanges = {
  chrome: {
    borderWidth: [0, 3],
    dividerWidth: [0, 3],
    focusRingWidth: [0, 4],
    surfaceOpacity: [0.6, 1],
    backdropBlur: [0, 32],
    shadowOpacity: [0, 0.5]
  },
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
    parallelEdgeSpacing: [0, 48],
    edgeCurveSegments: [12, 240],
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
  canvasAppearance: {
    nodeFillSaturation: [0, 1],
    nodeFillLuminanceSteps: [2, 256],
    previewShadowOpacity: [0, 1]
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
  motion: {
    duration: {
      fast: [0, 0.4],
      base: [0, 0.8],
      slow: [0, 1.2],
      layout: [0, 1.6]
    },
    distance: {
      chrome: [0, 32],
      panel: [0, 96],
      viewport: [0, 320]
    },
    stagger: {
      button: [0, 0.16],
      list: [0, 0.16]
    },
    canvas: {
      createScale: [0.7, 1],
      selectedScale: [1, 1.08],
      highlightDuration: [0, 1.8],
      maxAnimatedItems: [0, 400],
      proximityRadiusPx: [0, 600],
      proximityMaxScale: [1, 3],
      proximityDuration: [0, 0.8]
    }
  },
  diagnostics: {
    minTextContrast: [1, 7],
    minFocusContrast: [1, 7],
    minSelectionContrast: [1, 7]
  }
} as const satisfies {
  chrome: Record<keyof EditorTheme["chrome"], [number, number]>;
  space: Record<keyof EditorTheme["space"], [number, number]>;
  radius: Record<keyof EditorTheme["radius"], [number, number]>;
  canvasAppearance: Record<keyof EditorTheme["canvasAppearance"], [number, number]>;
  canvasInteraction: Record<keyof EditorTheme["canvasInteraction"], [number, number]>;
  subgraph: Record<keyof EditorTheme["subgraph"], [number, number]>;
  edgeLabel: Record<keyof EditorTheme["edgeLabel"], [number, number]>;
  motion: {
    duration: Record<keyof EditorMotionTokens["duration"], [number, number]>;
    distance: Record<keyof EditorMotionTokens["distance"], [number, number]>;
    stagger: Record<keyof EditorMotionTokens["stagger"], [number, number]>;
    canvas: Record<keyof EditorMotionTokens["canvas"], [number, number]>;
  };
  diagnostics: Record<keyof EditorTheme["diagnostics"], [number, number]>;
};
