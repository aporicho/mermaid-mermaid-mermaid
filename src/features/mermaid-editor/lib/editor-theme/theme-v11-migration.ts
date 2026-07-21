import type { CanvasThemeTokens, InterfaceThemeTokens } from "./appearance-types";

export function migrateInterfaceThemeV11(raw: Record<string, unknown>, fallback: InterfaceThemeTokens): InterfaceThemeTokens {
  if (isObjectValue(raw.interface)) return deepMerge(fallback, objectValue(raw.interface));

  const ui = objectValue(raw.ui);
  const chrome = objectValue(raw.chrome);
  const radius = objectValue(raw.radius);
  const space = objectValue(raw.space);
  const icon = objectValue(raw.icon);
  const foreground = stringValue(ui.foreground, fallback.colors.foreground);
  const background = stringValue(ui.background, fallback.colors.background);
  const card = stringValue(ui.card, fallback.colors.card);
  const popover = stringValue(ui.popover, card);
  const primary = stringValue(ui.primary, fallback.colors.primary);
  const secondary = stringValue(ui.secondary, fallback.colors.secondary);
  const destructive = stringValue(ui.destructive, fallback.colors.destructive);
  const border = stringValue(ui.border, fallback.colors.border);
  const shadowOpacity = numberValue(chrome.shadowOpacity, fallback.shadow.panel.opacity);

  return {
    colors: {
      background,
      foreground,
      icon: stringValue(ui.icon, fallback.colors.icon),
      card,
      cardForeground: foreground,
      popover,
      popoverForeground: foreground,
      primary,
      primaryForeground: background,
      secondary,
      secondaryForeground: foreground,
      muted: stringValue(ui.muted, fallback.colors.muted),
      mutedForeground: stringValue(ui.mutedForeground, fallback.colors.mutedForeground),
      accent: stringValue(ui.accent, fallback.colors.accent),
      accentForeground: stringValue(ui.accentForeground, fallback.colors.accentForeground),
      destructive,
      destructiveForeground: background,
      border,
      input: border,
      focusRing: primary
    },
    surface: {
      borderWidth: numberValue(chrome.borderWidth, fallback.surface.borderWidth),
      borderStyle: fallback.surface.borderStyle,
      dividerWidth: numberValue(chrome.dividerWidth, fallback.surface.dividerWidth),
      focusRingWidth: numberValue(chrome.focusRingWidth, fallback.surface.focusRingWidth),
      opacity: numberValue(chrome.surfaceOpacity, fallback.surface.opacity),
      backdropBlur: numberValue(chrome.backdropBlur, fallback.surface.backdropBlur)
    },
    state: { ...fallback.state },
    radius: {
      app: numberValue(radius.app, fallback.radius.app),
      controlSm: numberValue(radius.controlSm, fallback.radius.controlSm),
      controlMd: numberValue(radius.controlMd, fallback.radius.controlMd),
      controlLg: numberValue(radius.controlLg, fallback.radius.controlLg)
    },
    shadow: Object.fromEntries(Object.entries(fallback.shadow).map(([key, shadow]) => [
      key,
      { ...shadow, color: foreground, opacity: shadowOpacity }
    ])) as InterfaceThemeTokens["shadow"],
    spacing: {
      panelPadding: numberValue(space.panelPadding, fallback.spacing.panelPadding),
      panelHeaderHeight: numberValue(space.panelHeaderHeight, fallback.spacing.panelHeaderHeight),
      panelFooterHeight: numberValue(space.panelFooterHeight, fallback.spacing.panelFooterHeight),
      controlGap: numberValue(space.controlGap, fallback.spacing.controlGap),
      controlPaddingX: numberValue(space.controlPaddingX, fallback.spacing.controlPaddingX),
      controlPaddingY: numberValue(space.controlPaddingY, fallback.spacing.controlPaddingY),
      iconButtonSize: numberValue(space.iconButtonSize, fallback.spacing.iconButtonSize)
    },
    icon: {
      ...fallback.icon,
      sizeSm: numberValue(icon.sizeSm, fallback.icon.sizeSm),
      sizeButton: numberValue(icon.sizeButton, fallback.icon.sizeButton),
      strokeWidth: numberValue(icon.strokeWidth, fallback.icon.strokeWidth),
      buttonHeightSm: numberValue(icon.buttonHeightSm, fallback.icon.buttonHeightSm),
      buttonHeightMd: numberValue(icon.buttonHeightMd, fallback.icon.buttonHeightMd)
    },
    scrollbar: { ...fallback.scrollbar }
  };
}

export function migrateCanvasThemeV11(raw: Record<string, unknown>, fallback: CanvasThemeTokens): CanvasThemeTokens {
  const rawCanvas = objectValue(raw.canvas);
  if (isObjectValue(rawCanvas.surface)) return deepMerge(fallback, rawCanvas);

  const appearance = objectValue(raw.canvasAppearance);
  const radius = objectValue(raw.radius);
  const stroke = objectValue(raw.stroke);
  const interaction = objectValue(raw.canvasInteraction);
  const space = objectValue(raw.space);
  const group = objectValue(raw.subgraph);
  const edgeLabel = objectValue(raw.edgeLabel);
  const render = objectValue(raw.render);
  const ui = objectValue(raw.ui);
  const primary = stringValue(ui.primary, fallback.ordinaryNode.selectedBorderColor);
  const accentHover = stringValue(ui.accentForeground, fallback.ordinaryNode.hoverBorderColor);
  const surface = stringValue(rawCanvas.surface, fallback.surface.background);
  const nodeStroke = stringValue(rawCanvas.nodeStroke, fallback.ordinaryNode.borderColor);
  const nodeText = stringValue(rawCanvas.nodeText, fallback.ordinaryNode.textColor);
  const edge = stringValue(rawCanvas.edge, fallback.edge.color);
  const labelStroke = stringValue(rawCanvas.labelStroke, fallback.edgeLabel.borderColor);
  const invalid = stringValue(rawCanvas.connectionInvalid, fallback.ordinaryNode.invalidBorderColor);
  const previewInvalid = stringValue(rawCanvas.previewInvalid, fallback.overlay.connectionDraft.invalidColor);
  const controlSm = numberValue(radius.controlSm, fallback.ordinaryNode.radius);
  const canvasNodeRadius = numberValue(radius.canvasNode, fallback.ordinaryNode.roundedRadius);
  const nodeWidth = numberValue(stroke.node, fallback.ordinaryNode.borderWidth);
  const emphasizedWidth = numberValue(stroke.nodeEmphasized, fallback.ordinaryNode.emphasizedBorderWidth);
  const overlayWidth = numberValue(stroke.overlay, fallback.overlay.selection.strokeWidth);

  return {
    surface: {
      background: surface,
      renderBackground: stringValue(render.background, fallback.surface.renderBackground)
    },
    grid: {
      color: stringValue(render.gridDot, fallback.grid.color),
      minorStep: numberValue(space.gridMinorStep, fallback.grid.minorStep),
      majorEvery: numberValue(space.gridMajorEvery, fallback.grid.majorEvery),
      minorAlpha: numberValue(interaction.gridMinorAlpha, fallback.grid.minorAlpha),
      majorAlpha: numberValue(interaction.gridMajorAlpha, fallback.grid.majorAlpha),
      superAlpha: numberValue(interaction.gridSuperAlpha, fallback.grid.superAlpha),
      minorRadiusPx: numberValue(interaction.gridMinorRadiusPx, fallback.grid.minorRadiusPx),
      majorRadiusPx: numberValue(interaction.gridMajorRadiusPx, fallback.grid.majorRadiusPx),
      superRadiusPx: numberValue(interaction.gridSuperRadiusPx, fallback.grid.superRadiusPx),
      minorVisibleScale: numberValue(interaction.gridMinorVisibleScale, fallback.grid.minorVisibleScale),
      majorVisibleScale: numberValue(interaction.gridMajorVisibleScale, fallback.grid.majorVisibleScale),
      maxDots: numberValue(interaction.gridMaxDots, fallback.grid.maxDots)
    },
    ordinaryNode: {
      ...fallback.ordinaryNode,
      textColor: nodeText,
      borderColor: nodeStroke,
      hoverBorderColor: accentHover,
      selectedBorderColor: primary,
      invalidBorderColor: invalid,
      borderWidth: nodeWidth,
      emphasizedBorderWidth: emphasizedWidth,
      fillSaturation: numberValue(appearance.nodeFillSaturation, fallback.ordinaryNode.fillSaturation),
      fillLuminanceSteps: numberValue(appearance.nodeFillLuminanceSteps, fallback.ordinaryNode.fillLuminanceSteps),
      radius: controlSm,
      roundedRadius: canvasNodeRadius,
      polygonRadius: numberValue(radius.polygonCorner, fallback.ordinaryNode.polygonRadius),
      forkRadius: Math.max(0, Math.min(4, controlSm)),
      dragShadow: {
        ...fallback.ordinaryNode.dragShadow,
        color: nodeStroke,
        opacity: numberValue(appearance.previewShadowOpacity, fallback.ordinaryNode.dragShadow.opacity)
      },
      shadow: { ...fallback.ordinaryNode.shadow, color: nodeStroke },
      paddingX: numberValue(space.nodePaddingX, fallback.ordinaryNode.paddingX),
      paddingY: numberValue(space.nodePaddingY, fallback.ordinaryNode.paddingY),
      minChars: numberValue(space.nodeMinChars, fallback.ordinaryNode.minChars),
      maxChars: numberValue(space.nodeMaxChars, fallback.ordinaryNode.maxChars),
      maxLines: numberValue(space.nodeMaxLines, fallback.ordinaryNode.maxLines)
    },
    edge: {
      ...fallback.edge,
      color: edge,
      textColor: stringValue(rawCanvas.edgeText, fallback.edge.textColor),
      hoverColor: accentHover,
      selectedColor: primary,
      invalidColor: invalid,
      width: numberValue(stroke.edge, fallback.edge.width),
      thickWidth: numberValue(stroke.edgeThick, fallback.edge.thickWidth),
      dottedWidth: numberValue(stroke.edge, fallback.edge.dottedWidth),
      emphasizedWidth: numberValue(stroke.edge, fallback.edge.width) + 1,
      dottedDash: dashValue(stroke.edgeDotted, fallback.edge.dottedDash),
      pointerLength: numberValue(interaction.pointerLength, fallback.edge.pointerLength),
      pointerWidth: numberValue(interaction.pointerWidth, fallback.edge.pointerWidth),
      endpointMarkerRadius: numberValue(interaction.endpointMarkerRadius, fallback.edge.endpointMarkerRadius),
      hitStrokeWidth: numberValue(interaction.edgeHitStrokeWidth, fallback.edge.hitStrokeWidth),
      parallelSpacing: numberValue(interaction.parallelEdgeSpacing, fallback.edge.parallelSpacing),
      curveSegments: numberValue(interaction.edgeCurveSegments, fallback.edge.curveSegments)
    },
    edgeLabel: {
      ...fallback.edgeLabel,
      background: surface,
      textColor: stringValue(rawCanvas.edgeText, fallback.edgeLabel.textColor),
      borderColor: labelStroke,
      hoverBorderColor: accentHover,
      selectedBorderColor: primary,
      radius: numberValue(radius.edgeLabel, fallback.edgeLabel.radius),
      minChars: numberValue(edgeLabel.minChars, fallback.edgeLabel.minChars),
      maxChars: numberValue(edgeLabel.maxChars, fallback.edgeLabel.maxChars),
      paddingX: numberValue(edgeLabel.paddingX, fallback.edgeLabel.paddingX),
      height: numberValue(edgeLabel.height, fallback.edgeLabel.height)
    },
    group: {
      ...fallback.group,
      background: surface,
      backgroundOpacity: numberValue(group.fillOpacity, fallback.group.backgroundOpacity),
      borderColor: labelStroke,
      hoverBorderColor: accentHover,
      selectedBorderColor: primary,
      invalidBorderColor: invalid,
      borderWidth: overlayWidth,
      emphasizedBorderWidth: emphasizedWidth,
      customDash: dashValue(stroke.subgraphDash, fallback.group.customDash),
      borderStyle: dashStyle(stroke.subgraphDash, fallback.group.borderStyle),
      radius: canvasNodeRadius,
      shadow: { ...fallback.group.shadow, color: nodeStroke },
      paddingX: numberValue(group.paddingX, fallback.group.paddingX),
      paddingTop: numberValue(group.paddingTop, fallback.group.paddingTop),
      paddingBottom: numberValue(group.paddingBottom, fallback.group.paddingBottom),
      minWidth: numberValue(group.minWidth, fallback.group.minWidth),
      minHeight: numberValue(group.minHeight, fallback.group.minHeight),
      fallbackGap: numberValue(group.fallbackGap, fallback.group.fallbackGap),
      title: {
        ...fallback.group.title,
        background: surface,
        textColor: nodeText,
        borderColor: labelStroke,
        borderWidth: nodeWidth,
        radius: numberValue(radius.subgraphTitle, fallback.group.title.radius),
        shadow: { ...fallback.group.title.shadow, color: nodeStroke },
        height: numberValue(group.titleHeight, fallback.group.title.height),
        insetX: numberValue(group.titleInsetX, fallback.group.title.insetX),
        insetTop: numberValue(group.titleInsetTop, fallback.group.title.insetTop),
        paddingX: numberValue(group.titlePaddingX, fallback.group.title.paddingX)
      }
    },
    overlay: {
      selection: {
        ...fallback.overlay.selection,
        fillColor: primary,
        strokeColor: primary,
        strokeWidth: overlayWidth,
        customDash: dashValue(stroke.selectionDash, fallback.overlay.selection.customDash),
        strokeStyle: dashStyle(stroke.selectionDash, fallback.overlay.selection.strokeStyle)
      },
      connectionDraft: {
        ...fallback.overlay.connectionDraft,
        validColor: primary,
        invalidColor: previewInvalid,
        strokeWidth: numberValue(stroke.edge, fallback.overlay.connectionDraft.strokeWidth),
        customDash: dashValue(stroke.connectionDraftDash, fallback.overlay.connectionDraft.customDash),
        strokeStyle: dashStyle(stroke.connectionDraftDash, fallback.overlay.connectionDraft.strokeStyle)
      },
      guide: {
        ...fallback.overlay.guide,
        centerColor: primary,
        edgeColor: accentHover,
        strokeWidth: overlayWidth,
        customDash: dashValue(stroke.centerGuideDash, fallback.overlay.guide.customDash),
        centerStyle: dashStyle(stroke.centerGuideDash, fallback.overlay.guide.centerStyle)
      },
      anchor: {
        ...fallback.overlay.anchor,
        fillColor: primary,
        targetColor: primary,
        hoverColor: accentHover,
        strokeColor: surface,
        strokeWidth: numberValue(stroke.anchor, fallback.overlay.anchor.strokeWidth),
        radius: numberValue(interaction.anchorRadius, fallback.overlay.anchor.radius),
        endpointRadius: numberValue(interaction.endpointRadius, fallback.overlay.anchor.endpointRadius)
      }
    },
    actionBadge: { ...fallback.actionBadge, background: surface, foreground: primary, borderColor: primary },
    mermaidSvg: {
      ...fallback.mermaidSvg,
      primaryColor: surface,
      primaryTextColor: nodeText,
      primaryBorderColor: nodeStroke,
      secondaryColor: stringValue(ui.accent, fallback.mermaidSvg.secondaryColor),
      secondaryTextColor: stringValue(ui.foreground, fallback.mermaidSvg.secondaryTextColor),
      tertiaryColor: stringValue(ui.secondary, fallback.mermaidSvg.tertiaryColor),
      tertiaryTextColor: stringValue(ui.foreground, fallback.mermaidSvg.tertiaryTextColor),
      lineColor: edge,
      textColor: stringValue(ui.foreground, fallback.mermaidSvg.textColor),
      edgeLabelBackground: surface,
      clusterBackground: stringValue(ui.secondary, fallback.mermaidSvg.clusterBackground),
      clusterBorderColor: stringValue(ui.border, fallback.mermaidSvg.clusterBorderColor)
    }
  };
}

export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isObjectValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function deepMerge<T>(fallback: T, raw: Record<string, unknown>): T {
  if (!fallback || typeof fallback !== "object" || Array.isArray(fallback)) return (raw as T) ?? fallback;
  return Object.fromEntries(Object.entries(fallback as Record<string, unknown>).map(([key, fallbackValue]) => {
    const value = raw[key];
    if (Array.isArray(fallbackValue)) return [key, Array.isArray(value) ? [...value] : [...fallbackValue]];
    if (fallbackValue && typeof fallbackValue === "object") return [key, deepMerge(fallbackValue, objectValue(value))];
    return [key, value ?? fallbackValue];
  })) as T;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function dashValue(value: unknown, fallback: readonly number[]) {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item)) ? value : [...fallback];
}

function dashStyle(value: unknown, fallback: CanvasThemeTokens["group"]["borderStyle"]): CanvasThemeTokens["group"]["borderStyle"] {
  if (!Array.isArray(value)) return fallback;
  if (!value.length) return "solid";
  if (value.length === 2 && value[0] <= 2) return "dotted";
  if (value.length === 2) return "dashed";
  return "custom";
}
