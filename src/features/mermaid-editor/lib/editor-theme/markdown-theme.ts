import { isHexColor } from "./color";
import type { EditorTheme, MarkdownHeadingTokens, MarkdownThemeTokens } from "./types";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

type MarkdownThemeSource = Pick<EditorTheme, "ui" | "font">;

export function createDefaultMarkdownTheme(source: MarkdownThemeSource): MarkdownThemeTokens {
  const { ui, font } = source;
  const heading = (fontSize: number, lineHeight: number, fontWeight: number, marginTop: number, marginBottom: number): MarkdownHeadingTokens => ({
    color: ui.foreground,
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing: 0,
    marginTop,
    marginBottom
  });

  return {
    font: {
      familyBody: font.familySans,
      familyHeading: font.familySans,
      familyCode: font.familyMono
    },
    body: {
      color: ui.foreground,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: font.weightRegular,
      letterSpacing: font.letterSpacing,
      paragraphSpacing: 8
    },
    heading: {
      h1: heading(42, 50, font.weightRegular, 32, 8),
      h2: heading(36, 44, font.weightRegular, 28, 8),
      h3: heading(32, 40, font.weightRegular, 24, 6),
      h4: heading(28, 36, font.weightMedium, 20, 6),
      h5: heading(24, 32, font.weightMedium, 16, 4),
      h6: heading(18, 28, font.weightBold, 16, 4)
    },
    link: {
      color: ui.primary,
      hoverColor: ui.accentForeground,
      underlineThickness: 1,
      underlineOffset: 2
    },
    emphasis: {
      color: ui.foreground,
      strongWeight: font.weightBold
    },
    list: {
      markerColor: ui.mutedForeground,
      indent: 32,
      itemSpacing: 4,
      blockSpacing: 8
    },
    quote: {
      textColor: ui.mutedForeground,
      borderColor: ui.primary,
      background: ui.card,
      paddingX: 20,
      paddingY: 8,
      marginY: 8,
      borderWidth: 4,
      radius: 4
    },
    inlineCode: {
      textColor: ui.destructive,
      background: ui.muted,
      fontSize: 14,
      lineHeight: 20,
      paddingX: 3,
      paddingY: 1,
      radius: 4
    },
    codeBlock: {
      textColor: ui.foreground,
      background: ui.card,
      fontSize: 14,
      lineHeight: 21,
      paddingX: 20,
      paddingY: 16,
      marginY: 8,
      radius: 6
    },
    table: {
      textColor: ui.foreground,
      borderColor: ui.border,
      headerBackground: ui.muted,
      alternateBackground: ui.card,
      cellPaddingX: 16,
      cellPaddingY: 8,
      borderWidth: 1,
      radius: 6,
      marginY: 8
    },
    divider: {
      color: ui.border,
      thickness: 1,
      marginY: 16
    },
    image: {
      borderColor: ui.border,
      borderWidth: 0,
      radius: 8,
      marginY: 12
    }
  };
}

export function mergeMarkdownTheme(
  fallback: MarkdownThemeTokens,
  overrides: DeepPartial<MarkdownThemeTokens> | undefined
): MarkdownThemeTokens {
  return {
    font: { ...fallback.font, ...overrides?.font },
    body: { ...fallback.body, ...overrides?.body },
    heading: {
      h1: { ...fallback.heading.h1, ...overrides?.heading?.h1 },
      h2: { ...fallback.heading.h2, ...overrides?.heading?.h2 },
      h3: { ...fallback.heading.h3, ...overrides?.heading?.h3 },
      h4: { ...fallback.heading.h4, ...overrides?.heading?.h4 },
      h5: { ...fallback.heading.h5, ...overrides?.heading?.h5 },
      h6: { ...fallback.heading.h6, ...overrides?.heading?.h6 }
    },
    link: { ...fallback.link, ...overrides?.link },
    emphasis: { ...fallback.emphasis, ...overrides?.emphasis },
    list: { ...fallback.list, ...overrides?.list },
    quote: { ...fallback.quote, ...overrides?.quote },
    inlineCode: { ...fallback.inlineCode, ...overrides?.inlineCode },
    codeBlock: { ...fallback.codeBlock, ...overrides?.codeBlock },
    table: { ...fallback.table, ...overrides?.table },
    divider: { ...fallback.divider, ...overrides?.divider },
    image: { ...fallback.image, ...overrides?.image }
  };
}

export function normalizeMarkdownTheme(raw: unknown, fallback: MarkdownThemeTokens): MarkdownThemeTokens {
  const source = objectValue(raw);
  const headings = objectValue(source.heading);

  return {
    font: normalizeFontGroup(source.font, fallback.font),
    body: normalizeBodyGroup(source.body, fallback.body),
    heading: {
      h1: normalizeHeadingGroup(headings.h1, fallback.heading.h1),
      h2: normalizeHeadingGroup(headings.h2, fallback.heading.h2),
      h3: normalizeHeadingGroup(headings.h3, fallback.heading.h3),
      h4: normalizeHeadingGroup(headings.h4, fallback.heading.h4),
      h5: normalizeHeadingGroup(headings.h5, fallback.heading.h5),
      h6: normalizeHeadingGroup(headings.h6, fallback.heading.h6)
    },
    link: normalizeLinkGroup(source.link, fallback.link),
    emphasis: normalizeEmphasisGroup(source.emphasis, fallback.emphasis),
    list: normalizeListGroup(source.list, fallback.list),
    quote: normalizeQuoteGroup(source.quote, fallback.quote),
    inlineCode: normalizeInlineCodeGroup(source.inlineCode, fallback.inlineCode),
    codeBlock: normalizeCodeBlockGroup(source.codeBlock, fallback.codeBlock),
    table: normalizeTableGroup(source.table, fallback.table),
    divider: normalizeDividerGroup(source.divider, fallback.divider),
    image: normalizeImageGroup(source.image, fallback.image)
  };
}

function normalizeFontGroup(raw: unknown, fallback: MarkdownThemeTokens["font"]): MarkdownThemeTokens["font"] {
  const source = objectValue(raw);
  return {
    familyBody: fontFamilyValue(source.familyBody, fallback.familyBody),
    familyHeading: fontFamilyValue(source.familyHeading, fallback.familyHeading),
    familyCode: fontFamilyValue(source.familyCode, fallback.familyCode)
  };
}

function normalizeBodyGroup(raw: unknown, fallback: MarkdownThemeTokens["body"]): MarkdownThemeTokens["body"] {
  const source = objectValue(raw);
  return {
    color: colorValue(source.color, fallback.color),
    fontSize: numberValue(source.fontSize, fallback.fontSize, 10, 32),
    lineHeight: numberValue(source.lineHeight, fallback.lineHeight, 12, 52),
    fontWeight: numberValue(source.fontWeight, fallback.fontWeight, 300, 900),
    letterSpacing: numberValue(source.letterSpacing, fallback.letterSpacing, -2, 4),
    paragraphSpacing: numberValue(source.paragraphSpacing, fallback.paragraphSpacing, 0, 48)
  };
}

function normalizeHeadingGroup(raw: unknown, fallback: MarkdownHeadingTokens): MarkdownHeadingTokens {
  const source = objectValue(raw);
  return {
    color: colorValue(source.color, fallback.color),
    fontSize: numberValue(source.fontSize, fallback.fontSize, 10, 72),
    lineHeight: numberValue(source.lineHeight, fallback.lineHeight, 12, 88),
    fontWeight: numberValue(source.fontWeight, fallback.fontWeight, 300, 900),
    letterSpacing: numberValue(source.letterSpacing, fallback.letterSpacing, -3, 6),
    marginTop: numberValue(source.marginTop, fallback.marginTop, 0, 96),
    marginBottom: numberValue(source.marginBottom, fallback.marginBottom, 0, 64)
  };
}

function normalizeLinkGroup(raw: unknown, fallback: MarkdownThemeTokens["link"]): MarkdownThemeTokens["link"] {
  const source = objectValue(raw);
  return {
    color: colorValue(source.color, fallback.color),
    hoverColor: colorValue(source.hoverColor, fallback.hoverColor),
    underlineThickness: numberValue(source.underlineThickness, fallback.underlineThickness, 0, 6),
    underlineOffset: numberValue(source.underlineOffset, fallback.underlineOffset, 0, 12)
  };
}

function normalizeEmphasisGroup(raw: unknown, fallback: MarkdownThemeTokens["emphasis"]): MarkdownThemeTokens["emphasis"] {
  const source = objectValue(raw);
  return {
    color: colorValue(source.color, fallback.color),
    strongWeight: numberValue(source.strongWeight, fallback.strongWeight, 300, 900)
  };
}

function normalizeListGroup(raw: unknown, fallback: MarkdownThemeTokens["list"]): MarkdownThemeTokens["list"] {
  const source = objectValue(raw);
  return {
    markerColor: colorValue(source.markerColor, fallback.markerColor),
    indent: numberValue(source.indent, fallback.indent, 12, 80),
    itemSpacing: numberValue(source.itemSpacing, fallback.itemSpacing, 0, 32),
    blockSpacing: numberValue(source.blockSpacing, fallback.blockSpacing, 0, 48)
  };
}

function normalizeQuoteGroup(raw: unknown, fallback: MarkdownThemeTokens["quote"]): MarkdownThemeTokens["quote"] {
  const source = objectValue(raw);
  return {
    textColor: colorValue(source.textColor, fallback.textColor),
    borderColor: colorValue(source.borderColor, fallback.borderColor),
    background: colorValue(source.background, fallback.background),
    paddingX: numberValue(source.paddingX, fallback.paddingX, 0, 64),
    paddingY: numberValue(source.paddingY, fallback.paddingY, 0, 48),
    marginY: numberValue(source.marginY, fallback.marginY, 0, 48),
    borderWidth: numberValue(source.borderWidth, fallback.borderWidth, 0, 12),
    radius: numberValue(source.radius, fallback.radius, 0, 32)
  };
}

function normalizeInlineCodeGroup(raw: unknown, fallback: MarkdownThemeTokens["inlineCode"]): MarkdownThemeTokens["inlineCode"] {
  const source = objectValue(raw);
  return {
    textColor: colorValue(source.textColor, fallback.textColor),
    background: colorValue(source.background, fallback.background),
    fontSize: numberValue(source.fontSize, fallback.fontSize, 8, 28),
    lineHeight: numberValue(source.lineHeight, fallback.lineHeight, 10, 40),
    paddingX: numberValue(source.paddingX, fallback.paddingX, 0, 16),
    paddingY: numberValue(source.paddingY, fallback.paddingY, 0, 12),
    radius: numberValue(source.radius, fallback.radius, 0, 20)
  };
}

function normalizeCodeBlockGroup(raw: unknown, fallback: MarkdownThemeTokens["codeBlock"]): MarkdownThemeTokens["codeBlock"] {
  const source = objectValue(raw);
  return {
    textColor: colorValue(source.textColor, fallback.textColor),
    background: colorValue(source.background, fallback.background),
    fontSize: numberValue(source.fontSize, fallback.fontSize, 8, 28),
    lineHeight: numberValue(source.lineHeight, fallback.lineHeight, 10, 44),
    paddingX: numberValue(source.paddingX, fallback.paddingX, 0, 64),
    paddingY: numberValue(source.paddingY, fallback.paddingY, 0, 64),
    marginY: numberValue(source.marginY, fallback.marginY, 0, 48),
    radius: numberValue(source.radius, fallback.radius, 0, 32)
  };
}

function normalizeTableGroup(raw: unknown, fallback: MarkdownThemeTokens["table"]): MarkdownThemeTokens["table"] {
  const source = objectValue(raw);
  return {
    textColor: colorValue(source.textColor, fallback.textColor),
    borderColor: colorValue(source.borderColor, fallback.borderColor),
    headerBackground: colorValue(source.headerBackground, fallback.headerBackground),
    alternateBackground: colorValue(source.alternateBackground, fallback.alternateBackground),
    cellPaddingX: numberValue(source.cellPaddingX, fallback.cellPaddingX, 0, 48),
    cellPaddingY: numberValue(source.cellPaddingY, fallback.cellPaddingY, 0, 32),
    borderWidth: numberValue(source.borderWidth, fallback.borderWidth, 0, 6),
    radius: numberValue(source.radius, fallback.radius, 0, 32),
    marginY: numberValue(source.marginY, fallback.marginY, 0, 48)
  };
}

function normalizeDividerGroup(raw: unknown, fallback: MarkdownThemeTokens["divider"]): MarkdownThemeTokens["divider"] {
  const source = objectValue(raw);
  return {
    color: colorValue(source.color, fallback.color),
    thickness: numberValue(source.thickness, fallback.thickness, 0, 8),
    marginY: numberValue(source.marginY, fallback.marginY, 0, 64)
  };
}

function normalizeImageGroup(raw: unknown, fallback: MarkdownThemeTokens["image"]): MarkdownThemeTokens["image"] {
  const source = objectValue(raw);
  return {
    borderColor: colorValue(source.borderColor, fallback.borderColor),
    borderWidth: numberValue(source.borderWidth, fallback.borderWidth, 0, 12),
    radius: numberValue(source.radius, fallback.radius, 0, 48),
    marginY: numberValue(source.marginY, fallback.marginY, 0, 64)
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function colorValue(value: unknown, fallback: string) {
  return typeof value === "string" && isHexColor(value) ? value : fallback;
}

function fontFamilyValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
