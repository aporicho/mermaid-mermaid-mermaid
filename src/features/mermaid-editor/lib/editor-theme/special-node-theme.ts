import { isHexColor } from "./color";
import type { CanvasBorderTokens, CanvasStrokeStyle, CanvasThemeTokens, InterfaceThemeTokens, ShadowTokens } from "./appearance-types";
import type {
  SpecialNodeStateTokens,
  SpecialNodeSurfaceTokens,
  SpecialNodeThemeTokens,
  SpecialNodeVisualState
} from "./special-node-types";

type SpecialNodeThemeSource = {
  interface: InterfaceThemeTokens;
  canvas: CanvasThemeTokens;
};

const CANVAS_STROKE_STYLES = new Set<CanvasStrokeStyle>(["none", "solid", "dashed", "dotted", "dash-dot", "custom"]);

export function createDefaultSpecialNodeTheme(source: SpecialNodeThemeSource): SpecialNodeThemeTokens {
  const interfaceColors = source.interface.colors;
  const ordinaryNode = source.canvas.ordinaryNode;
  const ordinaryBorder = border(
    ordinaryNode.borderColor,
    ordinaryNode.borderWidth,
    ordinaryNode.borderStyle,
    ordinaryNode.customDash
  );
  const interaction = stateTokens(source.canvas);

  return {
    shared: {
      textColor: ordinaryNode.textColor,
      mutedTextColor: interfaceColors.mutedForeground,
      accentColor: interfaceColors.primary,
      errorColor: interfaceColors.destructive
    },
    linkCard: {
      surface: surface(interfaceColors.card, ordinaryBorder, ordinaryNode.roundedRadius, ordinaryNode.shadow),
      state: cloneState(interaction),
      width: 220,
      inset: 8,
      coverBackground: interfaceColors.accent,
      coverBorder: border(interfaceColors.border, ordinaryNode.borderWidth, ordinaryNode.borderStyle, ordinaryNode.customDash),
      coverRadius: source.interface.radius.controlSm,
      coverFallbackHeight: 188,
      coverMinHeight: 128,
      coverMaxHeight: 380,
      contentPaddingX: 12,
      providerColor: interfaceColors.primary,
      brandColor: interfaceColors.primary,
      providerGap: 10,
      titleGap: 4,
      titleHeight: 44
    },
    markdownDocument: {
      surface: surface(interfaceColors.card, ordinaryBorder, ordinaryNode.roundedRadius, ordinaryNode.shadow),
      state: cloneState(interaction),
      width: 280,
      height: 180,
      contentPadding: 12,
      badgeSize: 38,
      badgeBackground: interfaceColors.primary,
      badgeErrorBackground: interfaceColors.destructive,
      badgeColor: interfaceColors.primary,
      badgeErrorColor: interfaceColors.destructive,
      badgeOpacity: 0.12,
      badgeErrorOpacity: 0.2,
      badgeRadius: source.interface.radius.controlSm,
      titleGap: 10,
      pathGap: 1,
      separatorColor: ordinaryNode.borderColor,
      separatorWidth: 1,
      separatorOpacity: 0.18,
      excerptGap: 10,
      pathOpacity: 0.62,
      excerptOpacity: 0.74,
      placeholderOpacity: 0.56
    },
    htmlDocument: {
      surface: surface(interfaceColors.card, ordinaryBorder, ordinaryNode.roundedRadius, ordinaryNode.shadow),
      state: cloneState(interaction),
      width: 280,
      height: 180,
      contentPadding: 12,
      badgeSize: 38,
      badgeBackground: interfaceColors.primary,
      badgeColor: interfaceColors.primary,
      badgeOpacity: 0.12,
      badgeRadius: source.interface.radius.controlSm,
      titleGap: 10,
      pathGap: 1,
      separatorColor: ordinaryNode.borderColor,
      separatorWidth: 1,
      separatorOpacity: 0.18,
      excerptGap: 10,
      pathOpacity: 0.62,
      excerptOpacity: 0.74
    },
    image: {
      surface: surface(
        interfaceColors.muted,
        border(ordinaryNode.borderColor, 0, ordinaryNode.borderStyle, ordinaryNode.customDash),
        0,
        ordinaryNode.shadow
      ),
      state: cloneState(interaction)
    },
    table: {
      surface: surface(
        interfaceColors.card,
        border(interfaceColors.border, 1, "solid", []),
        0,
        { color: ordinaryNode.shadow.color, blur: 0, opacity: 0, offsetX: 0, offsetY: 0 }
      ),
      state: cloneState(interaction),
      headerBackground: interfaceColors.secondary,
      headerTextColor: interfaceColors.foreground,
      bodyTextColor: interfaceColors.foreground,
      hoverCellBackground: interfaceColors.accent,
      selectedCellBackground: interfaceColors.accent,
      selectedCellBorder: border(interfaceColors.primary, 1, "solid", []),
      grid: border(interfaceColors.border, 1, "solid", []),
      cellPaddingX: 10,
      cellPaddingY: 8,
      placeholderGap: 4,
      minColumnWidth: 64,
      minRowHeight: 32,
      resizeHandleWidth: 8
    }
  };
}

export function normalizeSpecialNodeTheme(raw: unknown, fallback: SpecialNodeThemeTokens): SpecialNodeThemeTokens {
  return normalizeValue(migrateLegacySpecialNodeTheme(raw, fallback), fallback, "") as SpecialNodeThemeTokens;
}

export function cloneSpecialNodeTheme(value: SpecialNodeThemeTokens): SpecialNodeThemeTokens {
  return cloneValue(value) as SpecialNodeThemeTokens;
}

export function specialNodeBorderDash(borderValue: CanvasBorderTokens): number[] | undefined {
  if (borderValue.style === "dashed") return [8, 6];
  if (borderValue.style === "dotted") return [2, 4];
  if (borderValue.style === "dash-dot") return [8, 4, 2, 4];
  if (borderValue.style === "custom") return [...borderValue.customDash];
  return undefined;
}

export function resolveSpecialNodeBorder(
  surfaceValue: SpecialNodeSurfaceTokens,
  stateValue: SpecialNodeStateTokens,
  visualState: SpecialNodeVisualState = "normal"
): CanvasBorderTokens {
  if (visualState === "normal") return surfaceValue.border;
  const color = visualState === "hovered"
    ? stateValue.hoverBorderColor
    : visualState === "connectionInvalid" || visualState === "error"
      ? stateValue.errorBorderColor
      : visualState === "editing"
        ? stateValue.editingBorderColor
        : stateValue.selectedBorderColor;
  return { ...surfaceValue.border, color, width: stateValue.emphasizedBorderWidth };
}

function stateTokens(canvas: CanvasThemeTokens): SpecialNodeStateTokens {
  return {
    hoverBorderColor: canvas.ordinaryNode.hoverBorderColor,
    selectedBorderColor: canvas.ordinaryNode.selectedBorderColor,
    errorBorderColor: canvas.ordinaryNode.invalidBorderColor,
    editingBorderColor: canvas.ordinaryNode.selectedBorderColor,
    emphasizedBorderWidth: canvas.ordinaryNode.emphasizedBorderWidth
  };
}

function cloneState(value: SpecialNodeStateTokens): SpecialNodeStateTokens {
  return { ...value };
}

function border(color: string, width: number, style: CanvasStrokeStyle, customDash: readonly number[]): CanvasBorderTokens {
  return { color, width, style, customDash: [...customDash] };
}

function surface(background: string, borderValue: CanvasBorderTokens, radius: number, shadowValue: ShadowTokens): SpecialNodeSurfaceTokens {
  return {
    background,
    border: { ...borderValue, customDash: [...borderValue.customDash] },
    radius,
    shadow: { ...shadowValue }
  };
}

function migrateLegacySpecialNodeTheme(raw: unknown, fallback: SpecialNodeThemeTokens): Record<string, unknown> {
  const source = objectValue(raw);
  const common = objectValue(source.common);
  const shared = objectValue(source.shared);
  const linkCard = objectValue(source.linkCard);
  const markdownDocument = objectValue(source.markdownDocument);
  const htmlDocument = objectValue(source.htmlDocument);
  const image = objectValue(source.image);
  const table = objectValue(source.table);

  const commonSurface = legacySurface(common, fallback.linkCard.surface);
  const commonState = legacyState(common, fallback.linkCard.state);
  const imageSurface = legacySurface(image, {
    ...fallback.image.surface,
    shadow: legacyShadow(common, fallback.image.surface.shadow) as unknown as ShadowTokens
  });

  return {
    ...source,
    shared: {
      textColor: common.textColor,
      mutedTextColor: common.mutedTextColor,
      accentColor: common.accentColor,
      ...shared
    },
    linkCard: {
      ...linkCard,
      surface: mergeObjects(commonSurface, objectValue(linkCard.surface)),
      state: mergeObjects(commonState, objectValue(linkCard.state)),
      coverBorder: mergeObjects({
        color: linkCard.coverBorderColor,
        width: linkCard.coverBorderWidth
      }, objectValue(linkCard.coverBorder))
    },
    markdownDocument: {
      ...markdownDocument,
      surface: mergeObjects(commonSurface, objectValue(markdownDocument.surface)),
      state: mergeObjects(commonState, objectValue(markdownDocument.state))
    },
    htmlDocument: {
      ...htmlDocument,
      surface: mergeObjects(commonSurface, objectValue(htmlDocument.surface)),
      state: mergeObjects(commonState, objectValue(htmlDocument.state))
    },
    image: {
      ...image,
      surface: mergeObjects(imageSurface, objectValue(image.surface)),
      state: mergeObjects({
        ...legacyState(common, fallback.image.state),
        ...(image.interactionBorderColor === undefined ? {} : {
          hoverBorderColor: image.interactionBorderColor,
          selectedBorderColor: image.interactionBorderColor,
          editingBorderColor: image.interactionBorderColor
        }),
        ...(image.interactionBorderWidth === undefined ? {} : { emphasizedBorderWidth: image.interactionBorderWidth })
      }, objectValue(image.state))
    },
    table: {
      ...table,
      surface: mergeObjects(legacySurface(table, fallback.table.surface, false), objectValue(table.surface)),
      state: mergeObjects(legacyState(common, fallback.table.state), objectValue(table.state)),
      headerTextColor: table.headerTextColor ?? common.textColor,
      bodyTextColor: table.bodyTextColor ?? common.textColor,
      selectedCellBackground: table.selectedCellBackground ?? table.selectedCellFill,
      selectedCellBorder: mergeObjects({
        color: table.selectedCellStroke,
        width: table.selectedCellStrokeWidth
      }, objectValue(table.selectedCellBorder)),
      grid: mergeObjects({ color: table.dividerColor, width: table.dividerWidth }, objectValue(table.grid))
    }
  };
}

function legacySurface(raw: Record<string, unknown>, fallback: SpecialNodeSurfaceTokens, includeShadow = true): Record<string, unknown> {
  return {
    background: raw.background ?? fallback.background,
    border: {
      ...fallback.border,
      color: raw.borderColor ?? fallback.border.color,
      width: raw.borderWidth ?? fallback.border.width,
      style: raw.borderStyle ?? fallback.border.style,
      customDash: raw.customDash ?? fallback.border.customDash
    },
    radius: raw.radius ?? fallback.radius,
    shadow: includeShadow ? legacyShadow(raw, fallback.shadow) : fallback.shadow
  };
}

function legacyShadow(raw: Record<string, unknown>, fallback: ShadowTokens): Record<string, unknown> {
  return {
    ...fallback,
    color: raw.shadowColor ?? fallback.color,
    blur: raw.shadowBlur ?? fallback.blur,
    opacity: raw.shadowOpacity ?? fallback.opacity,
    offsetX: raw.shadowOffsetX ?? fallback.offsetX,
    offsetY: raw.shadowOffsetY ?? fallback.offsetY,
    ...objectValue(raw.shadow)
  };
}

function legacyState(raw: Record<string, unknown>, fallback: SpecialNodeStateTokens): Record<string, unknown> {
  return {
    ...fallback,
    selectedBorderColor: raw.accentColor,
    editingBorderColor: raw.accentColor
  };
}

function normalizeValue(raw: unknown, fallback: unknown, path: string): unknown {
  if (typeof fallback === "number") {
    const range = SPECIAL_NODE_NUMBER_RANGES[path] ?? numberRangeForPath(path);
    return numberValue(raw, fallback, range[0], range[1]);
  }
  if (typeof fallback === "string") {
    if (path.endsWith(".style")) return typeof raw === "string" && CANVAS_STROKE_STYLES.has(raw as CanvasStrokeStyle) ? raw : fallback;
    return typeof raw === "string" && isHexColor(raw) ? raw : fallback;
  }
  if (Array.isArray(fallback)) return dashValue(raw, fallback);
  if (fallback && typeof fallback === "object") {
    const source = objectValue(raw);
    return Object.fromEntries(Object.entries(fallback).map(([key, fallbackValue]) => [
      key,
      normalizeValue(source[key], fallbackValue, path ? `${path}.${key}` : key)
    ]));
  }
  return fallback;
}

function dashValue(raw: unknown, fallback: readonly unknown[]) {
  if (!Array.isArray(raw) || raw.length > 16 || raw.some((entry) => typeof entry !== "number" || !Number.isFinite(entry) || entry < 0 || entry > 128)) {
    return [...fallback];
  }
  return [...raw];
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  return value;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mergeObjects(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Array.from(new Set([...Object.keys(base), ...Object.keys(override)])).map((key) => {
    const baseValue = base[key];
    const overrideValue = override[key];
    if (baseValue && typeof baseValue === "object" && !Array.isArray(baseValue) && overrideValue && typeof overrideValue === "object" && !Array.isArray(overrideValue)) {
      return [key, mergeObjects(objectValue(baseValue), objectValue(overrideValue))];
    }
    return [key, overrideValue === undefined ? baseValue : overrideValue];
  }));
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function numberRangeForPath(path: string): readonly [number, number] {
  if (path.endsWith(".opacity")) return [0, 1];
  if (path.endsWith(".offsetX") || path.endsWith(".offsetY")) return [-32, 32];
  if (path.endsWith(".width") || path.endsWith("Width")) return [0, 12];
  if (path.endsWith(".radius") || path.endsWith("Radius")) return [0, 64];
  if (path.endsWith(".blur")) return [0, 64];
  return [0, 512];
}

const SPECIAL_NODE_NUMBER_RANGES: Record<string, readonly [number, number]> = {
  "linkCard.width": [120, 640],
  "linkCard.coverFallbackHeight": [64, 640],
  "linkCard.coverMinHeight": [64, 640],
  "linkCard.coverMaxHeight": [64, 960],
  "linkCard.titleHeight": [12, 160],
  "markdownDocument.width": [160, 960],
  "markdownDocument.height": [96, 720],
  "markdownDocument.badgeSize": [16, 128],
  "htmlDocument.width": [160, 960],
  "htmlDocument.height": [96, 720],
  "htmlDocument.badgeSize": [16, 128],
  "table.minColumnWidth": [24, 480],
  "table.minRowHeight": [16, 240],
  "table.resizeHandleWidth": [2, 32]
};
