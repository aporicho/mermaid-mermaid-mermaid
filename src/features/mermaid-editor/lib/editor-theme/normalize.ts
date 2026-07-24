import { DEFAULT_EDITOR_THEME, getBuiltInEditorTheme, isBuiltInThemeId } from "./presets";
import { createDefaultMarkdownTheme, normalizeMarkdownTheme } from "./markdown-theme";
import { createDefaultSpecialNodeTheme, normalizeSpecialNodeTheme } from "./special-node-theme";
import { migrateLegacyReadingFontProfile } from "./reading-font-migration";
import { migrateCanvasThemeV11, migrateInterfaceThemeV11, objectValue } from "./theme-v11-migration";
import { normalizeEditorTypography } from "./typography";
import { createDefaultAgentTheme, normalizeAgentTheme } from "./agent-theme";
import { isHexColor } from "./color";
import type { CanvasStrokeStyle, CssBorderStyle, EditorMotionTokens, EditorTheme, TreeConnectorStyle } from "./types";

export function resolveEditorTheme(themeId: string | undefined, customTheme: unknown): EditorTheme {
  if (themeId === "custom") return normalizeEditorTheme(customTheme, { ...DEFAULT_EDITOR_THEME, id: "custom", name: "自定义主题" });
  return getBuiltInEditorTheme(themeId) ?? DEFAULT_EDITOR_THEME;
}

export function normalizeEditorTheme(value: unknown, fallback: EditorTheme = DEFAULT_EDITOR_THEME): EditorTheme {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  const interfaceTokens = normalizeAppearanceTree(
    migrateInterfaceThemeV11(raw, fallback.interface),
    fallback.interface,
    ["interface"]
  );
  const canvas = normalizeAppearanceTree(
    migrateCanvasThemeV11(raw, fallback.canvas),
    fallback.canvas,
    ["canvas"]
  );
  canvas.edge.style = canvasStrokeStyle(canvas.edge.style, fallback.canvas.edge.style);
  canvas.ordinaryNode.borderStyle = canvasStrokeStyle(canvas.ordinaryNode.borderStyle, fallback.canvas.ordinaryNode.borderStyle);
  canvas.edgeLabel.borderStyle = canvasStrokeStyle(canvas.edgeLabel.borderStyle, fallback.canvas.edgeLabel.borderStyle);
  canvas.group.borderStyle = canvasStrokeStyle(canvas.group.borderStyle, fallback.canvas.group.borderStyle);
  canvas.group.title.borderStyle = canvasStrokeStyle(canvas.group.title.borderStyle, fallback.canvas.group.title.borderStyle);
  canvas.overlay.selection.strokeStyle = canvasStrokeStyle(canvas.overlay.selection.strokeStyle, fallback.canvas.overlay.selection.strokeStyle);
  canvas.overlay.connectionDraft.strokeStyle = canvasStrokeStyle(canvas.overlay.connectionDraft.strokeStyle, fallback.canvas.overlay.connectionDraft.strokeStyle);
  canvas.overlay.guide.centerStyle = canvasStrokeStyle(canvas.overlay.guide.centerStyle, fallback.canvas.overlay.guide.centerStyle);
  canvas.actionBadge.borderStyle = canvasStrokeStyle(canvas.actionBadge.borderStyle, fallback.canvas.actionBadge.borderStyle);
  interfaceTokens.surface.borderStyle = cssBorderStyle(interfaceTokens.surface.borderStyle, fallback.interface.surface.borderStyle);
  interfaceTokens.tree.connectorStyle = treeConnectorStyle(interfaceTokens.tree.connectorStyle, fallback.interface.tree.connectorStyle);
  interfaceTokens.icon.family = "iconoir";

  const typography = normalizeEditorTypography(raw.typography, fallback.typography, {
    font: raw.font && typeof raw.font === "object" ? objectValue(raw.font) : undefined,
    subgraph: raw.subgraph && typeof raw.subgraph === "object" ? objectValue(raw.subgraph) : undefined,
    edgeLabel: raw.edgeLabel && typeof raw.edgeLabel === "object" ? objectValue(raw.edgeLabel) : undefined
  });
  const markdownFallback = createDefaultMarkdownTheme({ interface: interfaceTokens, typography });
  const legacyTypography = objectValue(raw.typography).markdown;
  const markdown = normalizeMarkdownTheme(raw.markdown, markdownFallback, {
    legacyTypography,
    sourceVersion: raw.version
  });
  const baseThemeId = normalizeBaseThemeId(raw.baseThemeId, fallback.baseThemeId);
  migrateLegacyReadingFontProfile(markdown, typography, { version: raw.version, baseThemeId });
  const specialNode = normalizeSpecialNodeTheme(
    raw.specialNode,
    createDefaultSpecialNodeTheme({ interface: interfaceTokens, canvas, markdown })
  );
  migrateDocumentPresentationV15(raw.version, canvas, specialNode);
  const agent = normalizeAgentTheme(raw.agent, createDefaultAgentTheme({ interface: interfaceTokens, typography }));

  return {
    version: 15,
    id: "custom",
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : fallback.name,
    description: typeof raw.description === "string" ? raw.description : fallback.description,
    baseThemeId,
    interface: interfaceTokens,
    agent,
    canvas,
    specialNode,
    source: normalizeColorGroup(raw.source, fallback.source),
    markdown,
    ansi: normalizeColorGroup(raw.ansi, fallback.ansi),
    terminal: normalizeColorGroup(raw.terminal, fallback.terminal),
    typography,
    motion: normalizeMotionGroup(raw.motion, fallback.motion),
    diagnostics: normalizeAppearanceTree(raw.diagnostics, fallback.diagnostics, ["diagnostics"])
  };
}

function migrateDocumentPresentationV15(sourceVersion: unknown, canvas: EditorTheme["canvas"], specialNode: EditorTheme["specialNode"]) {
  if (typeof sourceVersion === "number" && sourceVersion >= 15) return;
  if (canvas.group.title.borderWidth === 1) canvas.group.title.borderWidth = 0;
  if (specialNode.markdownDocument.width === 280 && specialNode.markdownDocument.height === 180) {
    specialNode.markdownDocument.height = 396;
  }
}

function normalizeBaseThemeId(value: unknown, fallback: EditorTheme["baseThemeId"]) {
  return isBuiltInThemeId(value) ? value : fallback;
}

function normalizeAppearanceTree<T>(raw: unknown, fallback: T, path: readonly string[]): T {
  if (Array.isArray(fallback)) return dashValue(raw, fallback) as T;
  if (typeof fallback === "boolean") return (typeof raw === "boolean" ? raw : fallback) as T;
  if (typeof fallback === "number") {
    const [min, max] = numberRange(path);
    return numberValue(raw, fallback, min, max) as T;
  }
  if (typeof fallback === "string") {
    if (isHexColor(fallback)) return (typeof raw === "string" && isHexColor(raw) ? raw : fallback) as T;
    return (typeof raw === "string" && raw.trim() ? raw : fallback) as T;
  }
  if (!fallback || typeof fallback !== "object") return fallback;
  const source = objectValue(raw);
  return Object.fromEntries(Object.entries(fallback as Record<string, unknown>).map(([key, entry]) => [
    key,
    normalizeAppearanceTree(source[key], entry, [...path, key])
  ])) as T;
}

function normalizeColorGroup<T extends object>(raw: unknown, fallback: T): T {
  const source = objectValue(raw);
  return Object.fromEntries(Object.entries(fallback).map(([key, fallbackValue]) => {
    const value = source[key];
    return [key, typeof value === "string" && isHexColor(value) ? value : fallbackValue];
  })) as T;
}

function normalizeMotionGroup(raw: unknown, fallback: EditorMotionTokens): EditorMotionTokens {
  const source = objectValue(raw);
  return {
    duration: normalizeAppearanceTree(source.duration, fallback.duration, ["motion", "duration"]),
    ease: normalizeEaseGroup(source.ease, fallback.ease),
    distance: normalizeAppearanceTree(source.distance, fallback.distance, ["motion", "distance"]),
    stagger: normalizeAppearanceTree(source.stagger, fallback.stagger, ["motion", "stagger"]),
    canvas: normalizeAppearanceTree(source.canvas, fallback.canvas, ["motion", "canvas"])
  };
}

function normalizeEaseGroup(raw: unknown, fallback: EditorMotionTokens["ease"]): EditorMotionTokens["ease"] {
  const source = objectValue(raw);
  return {
    standard: easeValue(source.standard, fallback.standard),
    emphasized: easeValue(source.emphasized, fallback.emphasized),
    exit: easeValue(source.exit, fallback.exit),
    linear: easeValue(source.linear, fallback.linear)
  };
}

function numberRange(path: readonly string[]): readonly [number, number] {
  const key = path.at(-1) || "";
  const joined = path.join(".");
  if (joined.startsWith("motion.duration.")) return [0, key === "highlightDuration" ? 1.8 : 1.6];
  if (joined.startsWith("motion.stagger.")) return [0, 0.16];
  if (joined === "motion.distance.chrome") return [0, 32];
  if (joined === "motion.distance.panel") return [0, 96];
  if (joined === "motion.distance.viewport") return [0, 320];
  if (joined === "motion.canvas.createScale") return [0.7, 1];
  if (joined === "motion.canvas.selectedScale") return [1, 1.08];
  if (joined === "motion.canvas.proximityRadiusPx") return [0, 600];
  if (joined === "motion.canvas.proximityMaxScale") return [1, 3];
  if (joined === "motion.canvas.proximityDuration") return [0, 0.8];
  if (joined === "motion.canvas.highlightDuration") return [0, 1.8];
  if (joined === "motion.canvas.maxAnimatedItems") return [0, 400];
  if (joined === "canvas.grid.minorStep") return [8, 80];
  if (joined === "canvas.grid.majorEvery") return [2, 12];
  if (joined === "canvas.grid.minorVisibleScale") return [0.1, 2];
  if (joined === "canvas.grid.majorVisibleScale") return [0.05, 1];
  if (joined === "canvas.grid.minorRadiusPx") return [0.2, 3];
  if (joined === "canvas.grid.majorRadiusPx") return [0.2, 4];
  if (joined === "canvas.grid.superRadiusPx") return [0.2, 5];
  if (/opacity|alpha/i.test(key)) return [0, 1];
  if (/fontWeight/i.test(key)) return [100, 900];
  if (/luminanceSteps/i.test(key)) return [2, 256];
  if (/curveSegments/i.test(key)) return [12, 240];
  if (/maxDots/i.test(key)) return [800, 20000];
  if (/visibleScale/i.test(key)) return [0.01, 4];
  if (/radius/i.test(key)) return [0, 128];
  if (/offset/i.test(key)) return [-1024, 1024];
  if (/width|height|size|padding|inset|gap|blur|step|spacing|length|boost/i.test(key)) return [0, 1024];
  if (/Chars|Lines|Every|Items/i.test(key)) return [0, 50000];
  if (/contrast/i.test(key)) return [1, 21];
  if (/scale/i.test(key)) return [0, 8];
  return [-2048, 2048];
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function dashValue(value: unknown, fallback: readonly unknown[]) {
  if (!Array.isArray(value) || value.length > 8) return [...fallback];
  if (!value.length) return [];
  const numbers = value.map((item) => typeof item === "number" && Number.isFinite(item) ? item : NaN);
  return numbers.every((item) => item >= 0 && item <= 96) ? numbers : [...fallback];
}

function cssBorderStyle(value: unknown, fallback: CssBorderStyle): CssBorderStyle {
  return value === "none" || value === "solid" || value === "dashed" || value === "dotted" || value === "double" ? value : fallback;
}

function treeConnectorStyle(value: unknown, fallback: TreeConnectorStyle): TreeConnectorStyle {
  return value === "none" || value === "solid" || value === "dashed" || value === "dotted" ? value : fallback;
}

function canvasStrokeStyle(value: unknown, fallback: CanvasStrokeStyle): CanvasStrokeStyle {
  return value === "none" || value === "solid" || value === "dashed" || value === "dotted" || value === "dash-dot" || value === "custom" ? value : fallback;
}

function easeValue(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return /^[a-z0-9.(),_-]+$/i.test(value) ? value : fallback;
}
