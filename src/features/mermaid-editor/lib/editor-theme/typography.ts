import type { EditorTypographyTokens, TypographyRoleTokens } from "./types";
import { MERMAID_FONT_FAMILY, MONO_FONT_FAMILY } from "./types";

type LegacyTypographySource = {
  font?: Record<string, unknown>;
  subgraph?: Record<string, unknown>;
  edgeLabel?: Record<string, unknown>;
};

const sans = (fontSize: number, fontWeight = 400, lineHeight = Math.round(fontSize * 1.45), letterSpacing = 0): TypographyRoleTokens => ({
  family: MERMAID_FONT_FAMILY,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing
});

const mono = (fontSize: number, fontWeight = 400, lineHeight = Math.round(fontSize * 1.5), letterSpacing = 0): TypographyRoleTokens => ({
  family: MONO_FONT_FAMILY,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing
});

export function createDefaultEditorTypography(): EditorTypographyTokens {
  return {
    interface: {
      body: sans(14, 400, 20),
      heading: sans(14, 500, 20),
      control: sans(13, 500, 18),
      navigation: sans(12, 500, 18),
      menu: sans(12, 400, 18),
      tooltip: sans(12, 400, 18),
      metadata: sans(12, 400, 18),
      status: sans(12, 400, 18),
      technical: mono(12, 400, 18)
    },
    canvas: {
      node: sans(14, 700, 18),
      nodeEditor: sans(14, 700, 18),
      edgeLabel: sans(13, 400, 18),
      edgeEditor: sans(13, 400, 18),
      subgraphTitle: sans(13, 700, 18),
      actionBadge: sans(10, 700, 14)
    },
    linkCard: {
      brand: sans(22, 800, 28),
      provider: sans(11, 700, 16),
      title: sans(13, 700, 16.25),
      titleEditor: sans(13, 700, 16.25)
    },
    markdownCard: {
      badge: sans(12, 700, 16),
      title: sans(16, 700, 22),
      path: sans(10, 400, 14),
      excerpt: sans(12, 400, 17.4),
      titleEditor: sans(16, 700, 22)
    },
    tableNode: {
      cell: sans(13, 400, 18),
      cellEditor: sans(13, 400, 18)
    },
    mermaid: {
      general: sans(16, 400, 22),
      diagramTitle: sans(18, 600, 24),
      primaryLabel: sans(16, 400, 22),
      relationLabel: sans(14, 400, 20),
      groupTitle: sans(14, 600, 20),
      note: sans(14, 400, 20)
    },
    canvasDocument: {
      shape: sans(14, 400, 18),
      shapeEditor: sans(14, 400, 18),
      card: sans(16, 400, 21),
      cardEditor: sans(16, 400, 21),
      freeText: sans(18, 400, 23),
      freeTextEditor: sans(18, 400, 23),
      connector: sans(12, 400, 15),
      connectorEditor: sans(12, 400, 15)
    },
    source: {
      editor: mono(13, 400, 30),
      diagnosticSummary: mono(12, 400, 20),
      diagnosticRaw: mono(12, 400, 20)
    },
    terminal: {
      content: mono(13, 400, 20),
      heading: sans(12, 500, 16),
      path: mono(11, 400, 16)
    }
  };
}

export function normalizeEditorTypography(raw: unknown, fallback: EditorTypographyTokens, legacy: LegacyTypographySource = {}): EditorTypographyTokens {
  const migrated = migrateLegacyTypography(fallback, legacy);
  if (!raw || typeof raw !== "object") return migrated;
  return mapTypographyRoles(migrated, (role, path) => normalizeRole(valueAtPath(raw, path), role));
}

export function cloneEditorTypography(value: EditorTypographyTokens): EditorTypographyTokens {
  return mapTypographyRoles(value, (role) => ({ ...role }));
}

export function mergeEditorTypography(base: EditorTypographyTokens, overrides: unknown): EditorTypographyTokens {
  if (!overrides || typeof overrides !== "object") return cloneEditorTypography(base);
  return mapTypographyRoles(base, (role, path) => normalizeRole(valueAtPath(overrides, path), role));
}

export function typographyToCssVariables(typography: EditorTypographyTokens): Record<string, string> {
  const variables: Record<string, string> = {
    "--font-sans": typography.interface.body.family,
    "--font-mono": typography.interface.technical.family
  };
  forEachTypographyRole(typography, (role, path) => {
    const prefix = `--type-${path.map(kebabCase).join("-")}`;
    variables[`${prefix}-family`] = role.family;
    variables[`${prefix}-size`] = `${role.fontSize}px`;
    variables[`${prefix}-weight`] = `${role.fontWeight}`;
    variables[`${prefix}-line-height`] = `${role.lineHeight}px`;
    variables[`${prefix}-letter-spacing`] = `${role.letterSpacing}px`;
  });
  return variables;
}

export function typographyFontRequests(typography: EditorTypographyTokens) {
  const requests = new Map<string, { family: string; fontWeight: number }>();
  forEachTypographyRole(typography, (role) => {
    const key = `${role.fontWeight}:${role.family}`;
    requests.set(key, { family: role.family, fontWeight: role.fontWeight });
  });
  return [...requests.values()];
}

function migrateLegacyTypography(fallback: EditorTypographyTokens, legacy: LegacyTypographySource): EditorTypographyTokens {
  const next = cloneEditorTypography(fallback);
  const font = legacy.font;
  if (font) {
    const sansFamily = stringValue(font.familySans, next.interface.body.family);
    const monoFamily = stringValue(font.familyMono, next.interface.technical.family);
    forEachTypographyRole(next, (role, path) => {
      if (path[0] === "source" || path[0] === "terminal" || path.join(".") === "interface.technical") role.family = monoFamily;
      else role.family = sansFamily;
    });
    patchRole(next.interface.body, { fontSize: optionalNumber(font.sizeUiSm), letterSpacing: optionalNumber(font.letterSpacing) });
    patchRole(next.canvas.node, { family: sansFamily, fontSize: optionalNumber(font.sizeNode), fontWeight: optionalNumber(font.weightBold), lineHeight: optionalNumber(font.lineHeightNode), letterSpacing: optionalNumber(font.letterSpacing) });
    patchRole(next.canvas.nodeEditor, next.canvas.node);
    patchRole(next.canvas.edgeLabel, { family: sansFamily, fontSize: optionalNumber(font.sizeEdgeLabel), fontWeight: optionalNumber(font.weightRegular), lineHeight: optionalNumber(font.lineHeightEdgeLabel), letterSpacing: optionalNumber(font.letterSpacing) });
    patchRole(next.canvas.edgeEditor, next.canvas.edgeLabel);
    patchRole(next.source.editor, { family: monoFamily, fontSize: optionalNumber(font.sizeSource), fontWeight: optionalNumber(font.weightRegular), lineHeight: optionalNumber(font.lineHeightSource), letterSpacing: optionalNumber(font.letterSpacing) });
    patchRole(next.terminal.content, { family: monoFamily, fontSize: optionalNumber(font.sizeTerminal), fontWeight: optionalNumber(font.weightRegular), lineHeight: optionalNumber(font.lineHeightTerminal), letterSpacing: optionalNumber(font.letterSpacing) });
  }
  if (legacy.subgraph) {
    patchRole(next.canvas.subgraphTitle, { fontSize: optionalNumber(legacy.subgraph.titleFontSize), fontWeight: optionalNumber(legacy.subgraph.titleFontWeight) });
  }
  if (legacy.edgeLabel) patchRole(next.canvas.edgeLabel, { fontSize: optionalNumber(legacy.edgeLabel.fontSize), lineHeight: optionalNumber(legacy.edgeLabel.lineHeight) });
  return next;
}

function normalizeRole(raw: unknown, fallback: TypographyRoleTokens): TypographyRoleTokens {
  const source = raw && typeof raw === "object" ? raw as Partial<TypographyRoleTokens> : {};
  return {
    family: stringValue(source.family, fallback.family),
    fontSize: numberValue(source.fontSize, fallback.fontSize, 8, 96),
    fontWeight: numberValue(source.fontWeight, fallback.fontWeight, 100, 900),
    lineHeight: numberValue(source.lineHeight, fallback.lineHeight, 8, 128),
    letterSpacing: numberValue(source.letterSpacing, fallback.letterSpacing, -4, 12)
  };
}

function mapTypographyRoles(value: EditorTypographyTokens, map: (role: TypographyRoleTokens, path: string[]) => TypographyRoleTokens): EditorTypographyTokens {
  return Object.fromEntries(Object.entries(value).map(([groupKey, group]) => [
    groupKey,
    Object.fromEntries(Object.entries(group).map(([roleKey, role]) => [roleKey, map(role, [groupKey, roleKey])]))
  ])) as EditorTypographyTokens;
}

export function forEachTypographyRole(value: EditorTypographyTokens, visit: (role: TypographyRoleTokens, path: string[]) => void) {
  for (const [groupKey, group] of Object.entries(value)) {
    for (const [roleKey, role] of Object.entries(group)) visit(role, [groupKey, roleKey]);
  }
}

function valueAtPath(value: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, value);
}

function patchRole(target: TypographyRoleTokens, patch: Partial<TypographyRoleTokens>) {
  Object.assign(target, Object.fromEntries(Object.entries(patch).filter(([, value]) => typeof value === "string" || Number.isFinite(value))));
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function kebabCase(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
