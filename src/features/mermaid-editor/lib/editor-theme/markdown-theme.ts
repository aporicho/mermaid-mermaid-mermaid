import { isHexColor } from "./color";
import {
  createDefaultMarkdownTokens,
  MARKDOWN_ELEMENT_DEFINITIONS,
  MARKDOWN_TOKEN_DEFINITIONS,
  type MarkdownElementDefinition,
  type MarkdownTokenDefinition
} from "./markdown-token-definitions";
import type { EditorTheme, MarkdownTextTokens, MarkdownThemeTokens } from "./types";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

type MarkdownThemeSource = Pick<EditorTheme, "interface" | "typography">;
type LegacyTypographyRole = {
  family?: unknown;
  fontSize?: unknown;
  fontWeight?: unknown;
  lineHeight?: unknown;
  letterSpacing?: unknown;
};

export function createDefaultMarkdownTheme({ interface: interfaceTokens, typography }: MarkdownThemeSource): MarkdownThemeTokens {
  return createDefaultMarkdownTokens({ interface: interfaceTokens, typography });
}

export function mergeMarkdownTheme(fallback: MarkdownThemeTokens, overrides: DeepPartial<MarkdownThemeTokens> | undefined): MarkdownThemeTokens {
  return normalizeCanonicalMarkdown(overrides, fallback);
}

export function normalizeMarkdownTheme(
  raw: unknown,
  fallback: MarkdownThemeTokens,
  options: { legacyTypography?: unknown; sourceVersion?: unknown } = {}
): MarkdownThemeTokens {
  const source = objectValue(raw);
  const migrated = migrateLegacyMarkdown(source, options.legacyTypography, fallback);
  return typeof options.sourceVersion === "number" && options.sourceVersion >= 8
    ? normalizeCanonicalMarkdown(source, migrated)
    : normalizeMarkedV8Elements(source, migrated);
}

export function cloneMarkdownTheme(value: MarkdownThemeTokens): MarkdownThemeTokens {
  return normalizeCanonicalMarkdown(value, value);
}

function normalizeCanonicalMarkdown(raw: unknown, fallback: MarkdownThemeTokens): MarkdownThemeTokens {
  const source = objectValue(raw);
  const result = structuredCloneValue(fallback);
  for (const definition of MARKDOWN_TOKEN_DEFINITIONS) {
    const fallbackValue = valueAtPath(fallback, definition.path);
    const rawValue = valueAtPath(source, definition.path);
    setAtPath(result, definition.path, normalizeTokenValue(rawValue, fallbackValue, definition));
  }
  return result;
}

function migrateLegacyMarkdown(source: Record<string, unknown>, legacyTypography: unknown, fallback: MarkdownThemeTokens): MarkdownThemeTokens {
  const embeddedTypography = objectValue(source.typography);
  const globalTypography = objectValue(legacyTypography);
  const legacyFont = objectValue(source.font);
  const bodySource = objectValue(source.body);
  const body = legacyText(
    { ...fallback.body, fontFamily: fontFamilyValue(legacyFont.familyBody, fallback.body.fontFamily), ...bodySource },
    globalTypography.body,
    embeddedTypography.body
  );
  const headings = objectValue(source.heading);
  const heading = Object.fromEntries((["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((level) => {
    const legacyHeading = objectValue(headings[level]);
    return [level, legacyText({
      ...fallback.heading[level],
      fontFamily: fontFamilyValue(legacyFont.familyHeading, fallback.heading[level].fontFamily),
      ...legacyHeading
    }, globalTypography[level], embeddedTypography[level])];
  })) as MarkdownThemeTokens["heading"];
  const linkSource = objectValue(source.link);
  const emphasisSource = objectValue(source.emphasis);
  const listSource = objectValue(source.list);
  const quoteSource = objectValue(source.quote);
  const inlineCodeSource = objectValue(source.inlineCode);
  const codeBlockSource = objectValue(source.codeBlock);
  const tableSource = objectValue(source.table);
  const legacyList = legacyText({ ...fallback.list.unordered, ...body, ...listSource }, globalTypography.list, embeddedTypography.list);

  const migrated: MarkdownThemeTokens = {
    layout: {
      ...fallback.layout,
      ...objectValue(source.layout)
    },
    body: { ...fallback.body, ...body, paragraphSpacing: numberOr(bodySource.paragraphSpacing, fallback.body.paragraphSpacing) },
    heading,
    link: {
      ...fallback.link,
      ...legacyText({ ...fallback.link, ...body }, globalTypography.link, embeddedTypography.link),
      color: colorOr(linkSource.color, fallback.link.color),
      hoverColor: colorOr(linkSource.hoverColor, fallback.link.hoverColor),
      underlineThickness: numberOr(linkSource.underlineThickness, fallback.link.underlineThickness),
      underlineOffset: numberOr(linkSource.underlineOffset, fallback.link.underlineOffset)
    },
    emphasis: {
      ...legacyText({ ...fallback.emphasis, ...body }, globalTypography.emphasis, embeddedTypography.emphasis),
      color: colorOr(emphasisSource.color, fallback.emphasis.color)
    },
    strong: {
      ...legacyText({
        ...fallback.strong,
        ...body,
        color: colorOr(emphasisSource.color, fallback.strong.color),
        fontWeight: numberOr(emphasisSource.strongWeight, fallback.strong.fontWeight)
      }, globalTypography.strong, embeddedTypography.strong)
    },
    strikethrough: { ...fallback.strikethrough, ...body },
    list: {
      unordered: { ...fallback.list.unordered, ...legacyList },
      ordered: { ...fallback.list.ordered, ...legacyList },
      task: { ...fallback.list.task, ...legacyList }
    },
    blockquote: {
      ...fallback.blockquote,
      ...legacyText({ ...fallback.blockquote, ...body }, globalTypography.quote, embeddedTypography.quote),
      color: colorOr(quoteSource.textColor, fallback.blockquote.color),
      background: colorOr(quoteSource.background, fallback.blockquote.background),
      borderColor: colorOr(quoteSource.borderColor, fallback.blockquote.borderColor),
      borderWidth: numberOr(quoteSource.borderWidth, fallback.blockquote.borderWidth),
      paddingX: numberOr(quoteSource.paddingX, fallback.blockquote.paddingX),
      paddingY: numberOr(quoteSource.paddingY, fallback.blockquote.paddingY),
      marginY: numberOr(quoteSource.marginY, fallback.blockquote.marginY),
      radius: numberOr(quoteSource.radius, fallback.blockquote.radius)
    },
    inlineCode: {
      ...fallback.inlineCode,
      ...legacyText({
        ...fallback.inlineCode,
        fontFamily: fontFamilyValue(legacyFont.familyCode, fallback.inlineCode.fontFamily),
        ...inlineCodeSource,
        color: colorOr(inlineCodeSource.textColor, fallback.inlineCode.color)
      }, globalTypography.inlineCode, embeddedTypography.inlineCode),
      background: colorOr(inlineCodeSource.background, fallback.inlineCode.background)
    },
    codeBlock: {
      ...fallback.codeBlock,
      ...legacyText({
        ...fallback.codeBlock,
        fontFamily: fontFamilyValue(legacyFont.familyCode, fallback.codeBlock.fontFamily),
        ...codeBlockSource,
        color: colorOr(codeBlockSource.textColor, fallback.codeBlock.color)
      }, globalTypography.codeBlock, embeddedTypography.codeBlock),
      background: colorOr(codeBlockSource.background, fallback.codeBlock.background)
    },
    table: {
      ...fallback.table,
      ...legacyText({ ...fallback.table, ...body, ...tableSource }, globalTypography.table, embeddedTypography.table),
      color: colorOr(tableSource.textColor, fallback.table.color),
      borderColor: colorOr(tableSource.borderColor, fallback.table.borderColor),
      headerBackground: colorOr(tableSource.headerBackground, fallback.table.headerBackground),
      bodyBackground: colorOr(tableSource.bodyBackground, colorOr(tableSource.alternateBackground, fallback.table.bodyBackground))
    },
    divider: { ...fallback.divider, ...objectValue(source.divider) },
    image: { ...fallback.image, ...objectValue(source.image) }
  };

  return normalizeCanonicalMarkdown(migrated, fallback);
}

function legacyText(base: MarkdownTextTokens, globalRole: unknown, embeddedRole: unknown): MarkdownTextTokens {
  return {
    ...base,
    ...legacyTypographyValues(globalRole),
    ...legacyTypographyValues(embeddedRole)
  };
}

function legacyTypographyValues(raw: unknown): Partial<MarkdownTextTokens> {
  const source = objectValue(raw) as LegacyTypographyRole;
  return {
    ...(typeof source.family === "string" && source.family.trim() ? { fontFamily: source.family.trim() } : {}),
    ...(typeof source.fontSize === "number" ? { fontSize: source.fontSize } : {}),
    ...(typeof source.fontWeight === "number" ? { fontWeight: source.fontWeight } : {}),
    ...(typeof source.lineHeight === "number" ? { lineHeight: source.lineHeight } : {}),
    ...(typeof source.letterSpacing === "number" ? { letterSpacing: source.letterSpacing } : {})
  };
}

function normalizeMarkedV8Elements(source: Record<string, unknown>, migrated: MarkdownThemeTokens): MarkdownThemeTokens {
  const result = structuredCloneValue(migrated);
  for (const elementDefinition of MARKDOWN_ELEMENT_DEFINITIONS) {
    if (!hasV8ElementMarker(source, elementDefinition)) continue;
    for (const definition of MARKDOWN_TOKEN_DEFINITIONS) {
      if (!startsWithPath(definition.path, elementDefinition.path)) continue;
      const rawValue = valueAtPath(source, definition.path);
      const fallbackValue = valueAtPath(migrated, definition.path);
      setAtPath(result, definition.path, normalizeTokenValue(rawValue, fallbackValue, definition));
    }
  }
  return result;
}

function hasV8ElementMarker(source: Record<string, unknown>, definition: MarkdownElementDefinition) {
  const elementSource = objectValue(valueAtPath(source, definition.path));
  const [root, child] = definition.path;
  if (root === "strong" || root === "strikethrough" || root === "blockquote") return Object.keys(elementSource).length > 0;
  if (root === "list" && (child === "unordered" || child === "ordered" || child === "task")) return Object.keys(elementSource).length > 0;
  return typeof elementSource.fontFamily === "string";
}

function startsWithPath(path: readonly string[], prefix: readonly string[]) {
  return prefix.every((part, index) => path[index] === part);
}

function normalizeTokenValue(raw: unknown, fallback: unknown, definition: MarkdownTokenDefinition): string | number {
  if (definition.kind === "color") return colorOr(raw, String(fallback));
  if (definition.kind === "font") return fontFamilyValue(raw, String(fallback));
  if (definition.kind === "css-border-style") return cssBorderStyleOr(raw, String(fallback));
  const number = numberOr(raw, Number(fallback));
  return Math.min(definition.max ?? number, Math.max(definition.min ?? number, number));
}

function cssBorderStyleOr(value: unknown, fallback: string) {
  return typeof value === "string" && ["none", "solid", "dashed", "dotted", "double"].includes(value) ? value : fallback;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function valueAtPath(value: unknown, path: readonly string[]) {
  return path.reduce<unknown>((current, key) => objectValue(current)[key], value);
}

function setAtPath(target: unknown, path: readonly string[], value: string | number) {
  const parent = path.slice(0, -1).reduce<Record<string, unknown>>((current, key) => objectValue(current[key]), target as Record<string, unknown>);
  parent[path.at(-1) || ""] = value;
}

function colorOr(value: unknown, fallback: string) {
  return typeof value === "string" && isHexColor(value) ? value.toLowerCase() : fallback;
}

function fontFamilyValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function structuredCloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
