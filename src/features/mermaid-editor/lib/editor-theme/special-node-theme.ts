import { isHexColor } from "./color";
import type { SpecialNodeThemeTokens } from "./special-node-types";

type SpecialNodeThemeSource = {
  ui: {
    card: string;
    foreground: string;
    mutedForeground: string;
    primary: string;
    border: string;
    muted: string;
    accent: string;
  };
  canvas: {
    nodeStroke: string;
    nodeText: string;
    labelStroke: string;
    connectionInvalid: string;
  };
  chrome: { shadowOpacity: number };
  radius: { canvasNode: number; controlSm: number };
  stroke: { node: number; overlay: number };
};

export function createDefaultSpecialNodeTheme(source: SpecialNodeThemeSource): SpecialNodeThemeTokens {
  return {
    common: {
      background: source.ui.card,
      textColor: source.canvas.nodeText,
      mutedTextColor: source.ui.mutedForeground,
      accentColor: source.ui.primary,
      borderColor: source.canvas.nodeStroke,
      borderWidth: source.stroke.node,
      radius: source.radius.canvasNode,
      shadowColor: source.canvas.nodeStroke,
      shadowBlur: 10,
      shadowOpacity: source.chrome.shadowOpacity,
      shadowOffsetY: 4
    },
    linkCard: {
      width: 220,
      inset: 8,
      coverBackground: source.ui.accent,
      coverBorderColor: source.canvas.labelStroke,
      coverBorderWidth: source.stroke.node,
      coverRadius: source.radius.controlSm,
      coverFallbackHeight: 188,
      coverMinHeight: 128,
      coverMaxHeight: 380,
      contentPaddingX: 12,
      providerColor: source.ui.primary,
      brandColor: source.ui.primary,
      providerGap: 10,
      titleGap: 4,
      titleHeight: 44
    },
    markdownDocument: {
      width: 280,
      height: 180,
      contentPadding: 12,
      badgeSize: 38,
      badgeBackground: source.ui.primary,
      badgeErrorBackground: source.canvas.connectionInvalid,
      badgeColor: source.ui.primary,
      badgeErrorColor: source.canvas.connectionInvalid,
      badgeOpacity: 0.12,
      badgeErrorOpacity: 0.2,
      badgeRadius: source.radius.controlSm,
      titleGap: 10,
      pathGap: 1,
      separatorColor: source.canvas.nodeStroke,
      separatorWidth: 1,
      separatorOpacity: 0.18,
      excerptGap: 10,
      pathOpacity: 0.62,
      excerptOpacity: 0.74,
      placeholderOpacity: 0.56
    },
    image: {
      background: source.ui.muted,
      borderColor: source.canvas.nodeStroke,
      borderWidth: 0,
      radius: 0,
      interactionBorderColor: source.ui.primary,
      interactionBorderWidth: source.stroke.overlay
    },
    table: {
      background: source.ui.card,
      borderColor: source.ui.border,
      borderWidth: 1,
      dividerColor: source.ui.border,
      dividerWidth: 1,
      selectedCellFill: source.ui.accent,
      selectedCellStroke: source.ui.primary,
      selectedCellStrokeWidth: 1,
      cellPaddingX: 10,
      cellPaddingY: 8,
      minColumnWidth: 64,
      minRowHeight: 32,
      resizeHandleWidth: 8
    }
  };
}

export function normalizeSpecialNodeTheme(raw: unknown, fallback: SpecialNodeThemeTokens): SpecialNodeThemeTokens {
  const source = objectValue(raw);
  return Object.fromEntries(Object.entries(fallback).map(([groupKey, group]) => {
    const rawGroup = objectValue(source[groupKey]);
    return [groupKey, Object.fromEntries(Object.entries(group).map(([key, fallbackValue]) => {
      const value = rawGroup[key];
      if (typeof fallbackValue === "string") {
        return [key, typeof value === "string" && isHexColor(value) ? value : fallbackValue];
      }
      const range = SPECIAL_NODE_NUMBER_RANGES[`${groupKey}.${key}`] ?? [0, 512];
      return [key, numberValue(value, fallbackValue, range[0], range[1])];
    }))];
  })) as SpecialNodeThemeTokens;
}

export function cloneSpecialNodeTheme(value: SpecialNodeThemeTokens): SpecialNodeThemeTokens {
  return Object.fromEntries(Object.entries(value).map(([key, group]) => [key, { ...group }])) as SpecialNodeThemeTokens;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

const SPECIAL_NODE_NUMBER_RANGES: Record<string, readonly [number, number]> = {
  "common.borderWidth": [0, 8],
  "common.radius": [0, 48],
  "common.shadowBlur": [0, 64],
  "common.shadowOpacity": [0, 1],
  "common.shadowOffsetY": [-32, 32],
  "linkCard.width": [120, 640],
  "linkCard.inset": [0, 48],
  "linkCard.coverBorderWidth": [0, 8],
  "linkCard.coverRadius": [0, 48],
  "linkCard.coverFallbackHeight": [64, 640],
  "linkCard.coverMinHeight": [64, 640],
  "linkCard.coverMaxHeight": [64, 960],
  "linkCard.contentPaddingX": [0, 64],
  "linkCard.providerGap": [0, 64],
  "linkCard.titleGap": [0, 64],
  "linkCard.titleHeight": [12, 160],
  "markdownDocument.width": [160, 960],
  "markdownDocument.height": [96, 720],
  "markdownDocument.contentPadding": [0, 64],
  "markdownDocument.badgeSize": [16, 128],
  "markdownDocument.badgeOpacity": [0, 1],
  "markdownDocument.badgeErrorOpacity": [0, 1],
  "markdownDocument.badgeRadius": [0, 48],
  "markdownDocument.titleGap": [0, 64],
  "markdownDocument.pathGap": [0, 64],
  "markdownDocument.separatorWidth": [0, 8],
  "markdownDocument.separatorOpacity": [0, 1],
  "markdownDocument.excerptGap": [0, 64],
  "markdownDocument.pathOpacity": [0, 1],
  "markdownDocument.excerptOpacity": [0, 1],
  "markdownDocument.placeholderOpacity": [0, 1],
  "image.borderWidth": [0, 8],
  "image.radius": [0, 64],
  "image.interactionBorderWidth": [0, 12],
  "table.borderWidth": [0, 8],
  "table.dividerWidth": [0, 8],
  "table.selectedCellStrokeWidth": [0, 8],
  "table.cellPaddingX": [0, 64],
  "table.cellPaddingY": [0, 64],
  "table.minColumnWidth": [24, 480],
  "table.minRowHeight": [16, 240],
  "table.resizeHandleWidth": [2, 32]
};
