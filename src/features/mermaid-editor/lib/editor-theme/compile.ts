import { DEFAULT_CANVAS_GRID } from "@/features/mermaid-editor/lib/canvas-grid";
import { CANVAS_VISUAL_TOKENS, type CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type {
  CompiledEditorTheme,
  EditorMotionTokens,
  EditorTheme,
  EditorThemeGeometryTokens,
  MermaidThemeVariables,
  ThemeDiagnostic,
  XtermThemeTokens
} from "./types";
import { ansiToCssVariables, contrastRatio, hexToHslTriplet, hexToRgbCsv, hexToRgba } from "./color";
import { markdownToCssVariables } from "./markdown-css-variables";
import { typographyToCssVariables } from "./typography";

export function compileEditorTheme(theme: EditorTheme): CompiledEditorTheme {
  return {
    theme,
    cssVariables: themeToCssVariables(theme),
    canvasVisualTokens: themeToCanvasVisualTokens(theme),
    mermaidThemeVariables: themeToMermaidThemeVariables(theme),
    terminalTheme: themeToTerminalTheme(theme),
    typography: theme.typography,
    specialNode: theme.specialNode,
    motion: theme.motion,
    geometry: themeToGeometryTokens(theme),
    diagnostics: themeDiagnostics(theme)
  };
}

export function themeToCssVariables(theme: EditorTheme): Record<string, string> {
  return {
    ...typographyToCssVariables(theme.typography),
    "--background": hexToHslTriplet(theme.ui.background),
    "--foreground": hexToHslTriplet(theme.ui.foreground),
    "--icon": hexToHslTriplet(theme.ui.icon),
    "--card": hexToHslTriplet(theme.ui.card),
    "--card-foreground": hexToHslTriplet(theme.ui.foreground),
    "--popover": hexToHslTriplet(theme.ui.popover),
    "--popover-foreground": hexToHslTriplet(theme.ui.foreground),
    "--primary": hexToHslTriplet(theme.ui.primary),
    "--primary-foreground": hexToHslTriplet(theme.ui.background),
    "--secondary": hexToHslTriplet(theme.ui.secondary),
    "--secondary-foreground": hexToHslTriplet(theme.ui.foreground),
    "--muted": hexToHslTriplet(theme.ui.muted),
    "--muted-foreground": hexToHslTriplet(theme.ui.mutedForeground),
    "--accent": hexToHslTriplet(theme.ui.accent),
    "--accent-foreground": hexToHslTriplet(theme.ui.accentForeground),
    "--destructive": hexToHslTriplet(theme.ui.destructive),
    "--destructive-foreground": hexToHslTriplet(theme.ui.background),
    "--border": hexToHslTriplet(theme.ui.border),
    "--input": hexToHslTriplet(theme.ui.border),
    "--ring": hexToHslTriplet(theme.ui.primary),
    "--source-line": hexToHslTriplet(theme.source.line),
    "--render-background": hexToHslTriplet(theme.render.background),
    "--render-grid-dot": hexToHslTriplet(theme.render.gridDot),
    "--terminal-background": hexToHslTriplet(theme.terminal.background),
    "--terminal-foreground": hexToHslTriplet(theme.terminal.foreground),
    "--terminal-cursor": hexToHslTriplet(theme.terminal.cursor),
    "--terminal-cursor-accent": hexToHslTriplet(theme.terminal.cursorAccent),
    "--terminal-selection-background": hexToHslTriplet(theme.terminal.selectionBackground),
    "--terminal-selection-foreground": hexToHslTriplet(theme.terminal.selectionForeground),
    ...ansiToCssVariables(theme.ansi),
    "--radius": `${theme.radius.app}px`,
    "--theme-radius-app": `${theme.radius.app}px`,
    "--theme-radius-control-sm": `${theme.radius.controlSm}px`,
    "--theme-radius-control-md": `${theme.radius.controlMd}px`,
    "--theme-radius-control-lg": `${theme.radius.controlLg}px`,
    "--theme-radius-canvas-node": `${theme.radius.canvasNode}px`,
    "--theme-radius-edge-label": `${theme.radius.edgeLabel}px`,
    "--theme-radius-polygon-corner": `${theme.radius.polygonCorner}px`,
    "--theme-radius-subgraph-title": `${theme.radius.subgraphTitle}px`,
    "--theme-canvas-node-fill-saturation": `${theme.canvasAppearance.nodeFillSaturation}`,
    "--theme-canvas-node-fill-luminance-steps": `${theme.canvasAppearance.nodeFillLuminanceSteps}`,
    "--theme-canvas-preview-shadow-opacity": `${theme.canvasAppearance.previewShadowOpacity}`,
    "--ui-border-width": `${theme.chrome.borderWidth}px`,
    "--ui-divider-width": `${theme.chrome.dividerWidth}px`,
    "--ui-focus-ring-width": `${theme.chrome.focusRingWidth}px`,
    "--ui-surface-opacity": `${theme.chrome.surfaceOpacity}`,
    "--ui-backdrop-blur": `${theme.chrome.backdropBlur}px`,
    "--ui-shadow-opacity": `${theme.chrome.shadowOpacity}`,
    "--theme-panel-padding": `${theme.space.panelPadding}px`,
    "--theme-panel-header-height": `${theme.space.panelHeaderHeight}px`,
    "--theme-panel-footer-height": `${theme.space.panelFooterHeight}px`,
    "--ui-control-gap": `${theme.space.controlGap}px`,
    "--ui-control-padding-x": `${theme.space.controlPaddingX}px`,
    "--ui-control-padding-y": `${theme.space.controlPaddingY}px`,
    "--ui-control-height-sm": `${theme.icon.buttonHeightSm}px`,
    "--ui-control-height-md": `${theme.icon.buttonHeightMd}px`,
    "--ui-icon-button-size": `${theme.space.iconButtonSize}px`,
    "--ui-icon-size-sm": `${theme.icon.sizeSm}px`,
    "--ui-icon-size-button": `${theme.icon.sizeButton}px`,
    "--ui-icon-stroke-width": `${theme.icon.strokeWidth}`,
    "--theme-source-line-height": `${theme.typography.source.editor.lineHeight}px`,
    "--theme-terminal-font-size": `${theme.typography.terminal.content.fontSize}px`,
    "--theme-terminal-line-height": `${theme.typography.terminal.content.lineHeight}px`,
    ...markdownToCssVariables(theme),
    ...motionToCssVariables(theme.motion)
  };
}

export function applyEditorThemeToDocument(theme: EditorTheme, target: HTMLElement = document.documentElement) {
  const variables = themeToCssVariables(theme);
  for (const [name, value] of Object.entries(variables)) target.style.setProperty(name, value);
}

export function themeToCanvasVisualTokens(theme: EditorTheme): CanvasVisualTokens {
  return {
    ...CANVAS_VISUAL_TOKENS,
    colors: {
      accent: theme.ui.primary,
      accentHover: theme.ui.accentForeground,
      connection: theme.ui.primary,
      connectionInvalid: theme.canvas.connectionInvalid,
      edge: theme.canvas.edge,
      edgeText: theme.canvas.edgeText,
      labelStroke: theme.canvas.labelStroke,
      nodeStroke: theme.canvas.nodeStroke,
      nodeText: theme.canvas.nodeText,
      surface: theme.canvas.surface,
      selectionFill: hexToRgba(theme.ui.primary, 0.08),
      anchorStroke: theme.canvas.surface,
      gridDotRgb: hexToRgbCsv(theme.canvas.edge),
      previewInvalid: theme.canvas.previewInvalid
    },
    node: {
      cornerRadius: theme.radius.canvasNode,
      strokeWidth: theme.stroke.node,
      emphasizedStrokeWidth: theme.stroke.nodeEmphasized,
      fillSaturation: theme.canvasAppearance.nodeFillSaturation,
      fillLuminanceSteps: theme.canvasAppearance.nodeFillLuminanceSteps,
      previewShadowOpacity: theme.canvasAppearance.previewShadowOpacity
    },
    anchor: {
      radius: theme.canvasInteraction.anchorRadius,
      endpointRadius: theme.canvasInteraction.endpointRadius,
      strokeWidth: theme.stroke.anchor
    },
    edge: {
      hitStrokeWidth: theme.canvasInteraction.edgeHitStrokeWidth,
      strokeWidth: theme.stroke.edge,
      thickStrokeWidth: theme.stroke.edgeThick,
      dottedStrokeWidth: theme.stroke.edge,
      dottedDash: [...theme.stroke.edgeDotted],
      pointerLength: theme.canvasInteraction.pointerLength,
      pointerWidth: theme.canvasInteraction.pointerWidth,
      parallelSpacing: theme.canvasInteraction.parallelEdgeSpacing,
      curveSegments: theme.canvasInteraction.edgeCurveSegments,
      labelCornerRadius: theme.radius.edgeLabel,
      endpointMarkerRadius: theme.canvasInteraction.endpointMarkerRadius
    },
    overlay: {
      strokeWidth: theme.stroke.overlay,
      selectionDash: [...theme.stroke.selectionDash],
      connectionDash: [...theme.stroke.connectionDraftDash],
      centerGuideDash: [...theme.stroke.centerGuideDash],
      subgraphDash: [...theme.stroke.subgraphDash]
    },
    shape: {
      polygonCornerRadius: theme.radius.polygonCorner,
      fallbackCornerRadius: Math.max(0, theme.radius.controlSm),
      forkCornerRadius: Math.max(0, Math.min(4, theme.radius.controlSm))
    },
    subgraph: {
      fillOpacity: theme.subgraph.fillOpacity,
      titleCornerRadius: theme.radius.subgraphTitle,
      titleInsetX: theme.subgraph.titlePaddingX,
      titleFontSize: theme.typography.canvas.subgraphTitle.fontSize,
      titleFontWeight: String(theme.typography.canvas.subgraphTitle.fontWeight),
      titleStrokeWidth: theme.stroke.node,
      anchorCornerScale: CANVAS_VISUAL_TOKENS.subgraph.anchorCornerScale,
      anchorCornerOpacity: CANVAS_VISUAL_TOKENS.subgraph.anchorCornerOpacity
    }
  };
}

export function themeToGeometryTokens(theme: EditorTheme): EditorThemeGeometryTokens {
  const nodeTypography = theme.typography.canvas.node;
  const edgeTypography = theme.typography.canvas.edgeLabel;
  return {
    node: {
      minChars: theme.space.nodeMinChars,
      maxChars: theme.space.nodeMaxChars,
      paddingX: theme.space.nodePaddingX,
      paddingY: theme.space.nodePaddingY,
      fontSize: nodeTypography.fontSize,
      lineHeight: nodeTypography.lineHeight,
      maxLines: theme.space.nodeMaxLines,
      fontFamily: nodeTypography.family,
      fontWeight: nodeTypography.fontWeight,
      letterSpacing: nodeTypography.letterSpacing
    },
    edgeLabel: {
      minChars: theme.edgeLabel.minChars,
      maxChars: theme.edgeLabel.maxChars,
      paddingX: theme.edgeLabel.paddingX,
      height: theme.edgeLabel.height,
      fontSize: edgeTypography.fontSize,
      lineHeight: edgeTypography.lineHeight,
      fontFamily: edgeTypography.family,
      fontWeight: edgeTypography.fontWeight,
      letterSpacing: edgeTypography.letterSpacing
    },
    subgraph: {
      paddingX: theme.subgraph.paddingX,
      paddingTop: theme.subgraph.paddingTop,
      paddingBottom: theme.subgraph.paddingBottom,
      titleHeight: theme.subgraph.titleHeight,
      titleInsetX: theme.subgraph.titleInsetX,
      titleInsetTop: theme.subgraph.titleInsetTop,
      titlePaddingX: theme.subgraph.titlePaddingX,
      minWidth: theme.subgraph.minWidth,
      minHeight: theme.subgraph.minHeight,
      fallbackGap: theme.subgraph.fallbackGap
    },
    grid: {
      origin: DEFAULT_CANVAS_GRID.origin,
      minorStep: theme.space.gridMinorStep,
      majorEvery: theme.space.gridMajorEvery,
      minorAlpha: theme.canvasInteraction.gridMinorAlpha,
      majorAlpha: theme.canvasInteraction.gridMajorAlpha,
      superAlpha: theme.canvasInteraction.gridSuperAlpha,
      minorRadiusPx: theme.canvasInteraction.gridMinorRadiusPx,
      majorRadiusPx: theme.canvasInteraction.gridMajorRadiusPx,
      superRadiusPx: theme.canvasInteraction.gridSuperRadiusPx,
      maxDots: theme.canvasInteraction.gridMaxDots,
      minorVisibleScale: theme.canvasInteraction.gridMinorVisibleScale,
      majorVisibleScale: theme.canvasInteraction.gridMajorVisibleScale
    }
  };
}

export function themeToMermaidThemeVariables(theme: EditorTheme): MermaidThemeVariables {
  return {
    background: theme.render.background,
    mainBkg: theme.canvas.surface,
    primaryColor: theme.canvas.surface,
    primaryTextColor: theme.canvas.nodeText,
    primaryBorderColor: theme.canvas.nodeStroke,
    secondaryColor: theme.ui.accent,
    secondaryTextColor: theme.ui.foreground,
    tertiaryColor: theme.ui.secondary,
    tertiaryTextColor: theme.ui.foreground,
    lineColor: theme.canvas.edge,
    textColor: theme.ui.foreground,
    edgeLabelBackground: theme.canvas.surface,
    clusterBkg: theme.ui.secondary,
    clusterBorder: theme.ui.border,
    nodeBorder: theme.canvas.nodeStroke,
    fontFamily: theme.typography.mermaid.general.family
  };
}

export function themeToTerminalTheme(theme: EditorTheme): XtermThemeTokens {
  return {
    background: theme.terminal.background,
    foreground: theme.terminal.foreground,
    cursor: theme.terminal.cursor,
    cursorAccent: theme.terminal.cursorAccent,
    selectionBackground: hexToRgba(theme.terminal.selectionBackground, 0.72),
    selectionForeground: theme.terminal.selectionForeground,
    selectionInactiveBackground: hexToRgba(theme.terminal.selectionBackground, 0.42),
    scrollbarSliderBackground: hexToRgba(theme.terminal.foreground, 0.18),
    scrollbarSliderHoverBackground: hexToRgba(theme.terminal.foreground, 0.32),
    scrollbarSliderActiveBackground: hexToRgba(theme.terminal.foreground, 0.44),
    overviewRulerBorder: theme.ui.border,
    ...theme.ansi
  };
}

function themeDiagnostics(theme: EditorTheme): ThemeDiagnostic[] {
  const diagnostics: ThemeDiagnostic[] = [];
  addContrastDiagnostic(diagnostics, "APP_TEXT_CONTRAST", "应用文字与背景对比度不足。", theme.ui.foreground, theme.ui.background, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(diagnostics, "MARKDOWN_TEXT_CONTRAST", "Markdown 正文与背景对比度不足。", theme.markdown.body.color, theme.ui.background, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(
    diagnostics,
    "MARKDOWN_CODE_CONTRAST",
    "Markdown 代码块文字与背景对比度不足。",
    theme.markdown.codeBlock.color,
    theme.markdown.codeBlock.background,
    theme.diagnostics.minTextContrast
  );
  addContrastDiagnostic(diagnostics, "CANVAS_NODE_TEXT_CONTRAST", "节点文字与节点表面对比度不足。", theme.canvas.nodeText, theme.canvas.surface, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(diagnostics, "TERMINAL_TEXT_CONTRAST", "终端文字与终端背景对比度不足。", theme.terminal.foreground, theme.terminal.background, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(diagnostics, "TERMINAL_CURSOR_CONTRAST", "终端光标与终端背景对比度偏低。", theme.terminal.cursor, theme.terminal.background, theme.diagnostics.minFocusContrast);
  addContrastDiagnostic(diagnostics, "FOCUS_CONTRAST", "主强调色与应用背景对比度偏低，焦点和选中状态可能不清晰。", theme.ui.primary, theme.ui.background, theme.diagnostics.minFocusContrast);
  addContrastDiagnostic(diagnostics, "SELECTION_CONTRAST", "主强调色与画布表面对比度偏低，画布选中状态可能不清晰。", theme.ui.primary, theme.canvas.surface, theme.diagnostics.minSelectionContrast);
  for (const [key, value] of Object.entries(theme.ansi)) {
    addContrastDiagnostic(
      diagnostics,
      `ANSI_${key.toUpperCase()}_CONTRAST`,
      `ANSI ${key} 与终端背景对比度偏低。`,
      value,
      theme.terminal.background,
      2
    );
  }
  return diagnostics;
}

function addContrastDiagnostic(diagnostics: ThemeDiagnostic[], code: string, message: string, foreground: string, background: string, minimum: number) {
  if (contrastRatio(foreground, background) >= minimum) return;
  diagnostics.push({ severity: "warning", code, message });
}

function motionToCssVariables(motion: EditorMotionTokens): Record<string, string> {
  return {
    "--motion-duration-fast": `${motion.duration.fast * 1000}ms`,
    "--motion-duration-base": `${motion.duration.base * 1000}ms`,
    "--motion-duration-slow": `${motion.duration.slow * 1000}ms`,
    "--motion-duration-layout": `${motion.duration.layout * 1000}ms`,
    "--motion-distance-chrome": `${motion.distance.chrome}px`,
    "--motion-distance-panel": `${motion.distance.panel}px`,
    "--motion-distance-viewport": `${motion.distance.viewport}px`,
    "--motion-stagger-button": `${motion.stagger.button * 1000}ms`,
    "--motion-stagger-list": `${motion.stagger.list * 1000}ms`,
    "--motion-canvas-proximity-radius": `${motion.canvas.proximityRadiusPx}px`,
    "--motion-canvas-proximity-scale": `${motion.canvas.proximityMaxScale}`,
    "--motion-canvas-proximity-duration": `${motion.canvas.proximityDuration * 1000}ms`
  };
}
