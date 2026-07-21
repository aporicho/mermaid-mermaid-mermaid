import { DEFAULT_CANVAS_GRID } from "@/features/mermaid-editor/lib/canvas-grid";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { ShadowTokens } from "./appearance-types";
import { ansiToCssVariables, contrastRatio, hexToHslTriplet, hexToRgba } from "./color";
import { markdownToCssVariables } from "./markdown-css-variables";
import { typographyToCssVariables } from "./typography";
import type {
  CompiledEditorTheme,
  EditorMotionTokens,
  EditorTheme,
  EditorThemeGeometryTokens,
  MermaidThemeVariables,
  ThemeDiagnostic,
  XtermThemeTokens
} from "./types";

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
  const ui = theme.interface;
  const colors = ui.colors;
  const canvas = theme.canvas;
  return {
    ...typographyToCssVariables(theme.typography),
    "--background": hexToHslTriplet(colors.background),
    "--foreground": hexToHslTriplet(colors.foreground),
    "--icon": hexToHslTriplet(colors.icon),
    "--card": hexToHslTriplet(colors.card),
    "--card-foreground": hexToHslTriplet(colors.cardForeground),
    "--popover": hexToHslTriplet(colors.popover),
    "--popover-foreground": hexToHslTriplet(colors.popoverForeground),
    "--primary": hexToHslTriplet(colors.primary),
    "--primary-foreground": hexToHslTriplet(colors.primaryForeground),
    "--secondary": hexToHslTriplet(colors.secondary),
    "--secondary-foreground": hexToHslTriplet(colors.secondaryForeground),
    "--muted": hexToHslTriplet(colors.muted),
    "--muted-foreground": hexToHslTriplet(colors.mutedForeground),
    "--accent": hexToHslTriplet(colors.accent),
    "--accent-foreground": hexToHslTriplet(colors.accentForeground),
    "--destructive": hexToHslTriplet(colors.destructive),
    "--destructive-foreground": hexToHslTriplet(colors.destructiveForeground),
    "--border": hexToHslTriplet(colors.border),
    "--input": hexToHslTriplet(colors.input),
    "--ring": hexToHslTriplet(colors.focusRing),
    "--source-line": hexToHslTriplet(theme.source.line),
    "--render-background": hexToHslTriplet(canvas.surface.renderBackground),
    "--render-grid-dot": hexToHslTriplet(canvas.grid.color),
    "--terminal-background": hexToHslTriplet(theme.terminal.background),
    "--terminal-foreground": hexToHslTriplet(theme.terminal.foreground),
    "--terminal-cursor": hexToHslTriplet(theme.terminal.cursor),
    "--terminal-cursor-accent": hexToHslTriplet(theme.terminal.cursorAccent),
    "--terminal-selection-background": hexToHslTriplet(theme.terminal.selectionBackground),
    "--terminal-selection-foreground": hexToHslTriplet(theme.terminal.selectionForeground),
    ...ansiToCssVariables(theme.ansi),
    "--radius": `${ui.radius.app}px`,
    "--theme-radius-app": `${ui.radius.app}px`,
    "--theme-radius-control-sm": `${ui.radius.controlSm}px`,
    "--theme-radius-control-md": `${ui.radius.controlMd}px`,
    "--theme-radius-control-lg": `${ui.radius.controlLg}px`,
    "--theme-radius-canvas-node": `${canvas.ordinaryNode.roundedRadius}px`,
    "--theme-radius-edge-label": `${canvas.edgeLabel.radius}px`,
    "--theme-radius-polygon-corner": `${canvas.ordinaryNode.polygonRadius}px`,
    "--theme-radius-subgraph-title": `${canvas.group.title.radius}px`,
    "--theme-canvas-node-fill-saturation": `${canvas.ordinaryNode.fillSaturation}`,
    "--theme-canvas-node-fill-luminance-steps": `${canvas.ordinaryNode.fillLuminanceSteps}`,
    "--theme-canvas-preview-shadow-opacity": `${canvas.ordinaryNode.dragShadow.opacity}`,
    "--ui-border-width": `${ui.surface.borderWidth}px`,
    "--ui-border-style": ui.surface.borderStyle,
    "--ui-divider-width": `${ui.surface.dividerWidth}px`,
    "--ui-focus-ring-width": `${ui.surface.focusRingWidth}px`,
    "--ui-surface-opacity": `${ui.surface.opacity}`,
    "--ui-backdrop-blur": `${ui.surface.backdropBlur}px`,
    "--ui-hover-opacity": `${ui.state.hoverOpacity}`,
    "--ui-pressed-opacity": `${ui.state.pressedOpacity}`,
    "--ui-selected-opacity": `${ui.state.selectedOpacity}`,
    "--ui-disabled-opacity": `${ui.state.disabledOpacity}`,
    "--ui-shadow-popover": shadowCss(ui.shadow.popover),
    "--ui-shadow-panel": shadowCss(ui.shadow.panel),
    "--ui-shadow-dialog": shadowCss(ui.shadow.dialog),
    "--ui-shadow-toolbar": shadowCss(ui.shadow.toolbar),
    "--ui-shadow-opacity": `${ui.shadow.panel.opacity}`,
    "--theme-panel-padding": `${ui.spacing.panelPadding}px`,
    "--theme-panel-header-height": `${ui.spacing.panelHeaderHeight}px`,
    "--theme-panel-footer-height": `${ui.spacing.panelFooterHeight}px`,
    "--ui-control-gap": `${ui.spacing.controlGap}px`,
    "--ui-control-padding-x": `${ui.spacing.controlPaddingX}px`,
    "--ui-control-padding-y": `${ui.spacing.controlPaddingY}px`,
    "--ui-control-height-sm": `${ui.icon.buttonHeightSm}px`,
    "--ui-control-height-md": `${ui.icon.buttonHeightMd}px`,
    "--ui-icon-button-size": `${ui.spacing.iconButtonSize}px`,
    "--ui-icon-size-sm": `${ui.icon.sizeSm}px`,
    "--ui-icon-size-button": `${ui.icon.sizeButton}px`,
    "--ui-icon-stroke-width": `${ui.icon.strokeWidth}`,
    "--ui-scrollbar-size": `${ui.scrollbar.size}px`,
    "--ui-scrollbar-min-thumb-length": `${ui.scrollbar.minThumbLength}px`,
    "--ui-scrollbar-radius": `${ui.scrollbar.radius}px`,
    "--ui-scrollbar-inset": `${ui.scrollbar.inset}px`,
    "--ui-scrollbar-opacity": `${ui.scrollbar.opacity}`,
    "--ui-scrollbar-hover-opacity": `${ui.scrollbar.hoverOpacity}`,
    "--ui-scrollbar-active-opacity": `${ui.scrollbar.activeOpacity}`,
    "--theme-source-line-height": `${theme.typography.source.editor.lineHeight}px`,
    "--theme-terminal-font-size": `${theme.typography.terminal.content.fontSize}px`,
    "--theme-terminal-line-height": `${theme.typography.terminal.content.lineHeight}px`,
    ...markdownToCssVariables(theme),
    ...motionToCssVariables(theme.motion)
  };
}

export function applyEditorThemeToDocument(theme: EditorTheme, target: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(themeToCssVariables(theme))) target.style.setProperty(name, value);
}

export function themeToCanvasVisualTokens(theme: EditorTheme): CanvasVisualTokens {
  const { mermaidSvg, ...visualTokens } = theme.canvas;
  void mermaidSvg;
  return structuredClone(visualTokens);
}

export function themeToGeometryTokens(theme: EditorTheme): EditorThemeGeometryTokens {
  const node = theme.canvas.ordinaryNode;
  const edgeLabel = theme.canvas.edgeLabel;
  const group = theme.canvas.group;
  const grid = theme.canvas.grid;
  const nodeTypography = theme.typography.canvas.node;
  const edgeTypography = theme.typography.canvas.edgeLabel;
  return {
    node: {
      minChars: node.minChars,
      maxChars: node.maxChars,
      paddingX: node.paddingX,
      paddingY: node.paddingY,
      fontSize: nodeTypography.fontSize,
      lineHeight: nodeTypography.lineHeight,
      maxLines: node.maxLines,
      fontFamily: nodeTypography.family,
      fontWeight: nodeTypography.fontWeight,
      letterSpacing: nodeTypography.letterSpacing
    },
    edgeLabel: {
      minChars: edgeLabel.minChars,
      maxChars: edgeLabel.maxChars,
      paddingX: edgeLabel.paddingX,
      height: edgeLabel.height,
      fontSize: edgeTypography.fontSize,
      lineHeight: edgeTypography.lineHeight,
      fontFamily: edgeTypography.family,
      fontWeight: edgeTypography.fontWeight,
      letterSpacing: edgeTypography.letterSpacing
    },
    subgraph: {
      paddingX: group.paddingX,
      paddingTop: group.paddingTop,
      paddingBottom: group.paddingBottom,
      titleHeight: group.title.height,
      titleInsetX: group.title.insetX,
      titleInsetTop: group.title.insetTop,
      titlePaddingX: group.title.paddingX,
      minWidth: group.minWidth,
      minHeight: group.minHeight,
      fallbackGap: group.fallbackGap
    },
    grid: {
      origin: DEFAULT_CANVAS_GRID.origin,
      minorStep: grid.minorStep,
      majorEvery: grid.majorEvery,
      minorAlpha: grid.minorAlpha,
      majorAlpha: grid.majorAlpha,
      superAlpha: grid.superAlpha,
      minorRadiusPx: grid.minorRadiusPx,
      majorRadiusPx: grid.majorRadiusPx,
      superRadiusPx: grid.superRadiusPx,
      maxDots: grid.maxDots,
      minorVisibleScale: grid.minorVisibleScale,
      majorVisibleScale: grid.majorVisibleScale
    }
  };
}

export function themeToMermaidThemeVariables(theme: EditorTheme): MermaidThemeVariables {
  const svg = theme.canvas.mermaidSvg;
  return {
    background: theme.canvas.surface.renderBackground,
    mainBkg: svg.primaryColor,
    primaryColor: svg.primaryColor,
    primaryTextColor: svg.primaryTextColor,
    primaryBorderColor: svg.primaryBorderColor,
    secondaryColor: svg.secondaryColor,
    secondaryTextColor: svg.secondaryTextColor,
    tertiaryColor: svg.tertiaryColor,
    tertiaryTextColor: svg.tertiaryTextColor,
    lineColor: svg.lineColor,
    textColor: svg.textColor,
    edgeLabelBackground: svg.edgeLabelBackground,
    clusterBkg: svg.clusterBackground,
    clusterBorder: svg.clusterBorderColor,
    nodeBorder: svg.primaryBorderColor,
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
    scrollbarSliderBackground: hexToRgba(theme.terminal.foreground, theme.interface.scrollbar.opacity),
    scrollbarSliderHoverBackground: hexToRgba(theme.terminal.foreground, theme.interface.scrollbar.hoverOpacity),
    scrollbarSliderActiveBackground: hexToRgba(theme.terminal.foreground, theme.interface.scrollbar.activeOpacity),
    overviewRulerBorder: theme.interface.colors.border,
    ...theme.ansi
  };
}

function themeDiagnostics(theme: EditorTheme): ThemeDiagnostic[] {
  const diagnostics: ThemeDiagnostic[] = [];
  const colors = theme.interface.colors;
  addContrastDiagnostic(diagnostics, "APP_TEXT_CONTRAST", "应用文字与背景对比度不足。", colors.foreground, colors.background, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(diagnostics, "MARKDOWN_TEXT_CONTRAST", "Markdown 正文与背景对比度不足。", theme.markdown.body.color, colors.background, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(diagnostics, "MARKDOWN_CODE_CONTRAST", "Markdown 代码块文字与背景对比度不足。", theme.markdown.codeBlock.color, theme.markdown.codeBlock.background, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(diagnostics, "CANVAS_NODE_TEXT_CONTRAST", "节点文字与节点表面对比度不足。", theme.canvas.ordinaryNode.textColor, theme.canvas.surface.background, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(diagnostics, "TERMINAL_TEXT_CONTRAST", "终端文字与终端背景对比度不足。", theme.terminal.foreground, theme.terminal.background, theme.diagnostics.minTextContrast);
  addContrastDiagnostic(diagnostics, "TERMINAL_CURSOR_CONTRAST", "终端光标与终端背景对比度偏低。", theme.terminal.cursor, theme.terminal.background, theme.diagnostics.minFocusContrast);
  addContrastDiagnostic(diagnostics, "FOCUS_CONTRAST", "焦点色与应用背景对比度偏低。", colors.focusRing, colors.background, theme.diagnostics.minFocusContrast);
  addContrastDiagnostic(diagnostics, "SELECTION_CONTRAST", "节点选中色与画布表面对比度偏低。", theme.canvas.ordinaryNode.selectedBorderColor, theme.canvas.surface.background, theme.diagnostics.minSelectionContrast);
  for (const [key, value] of Object.entries(theme.ansi)) {
    addContrastDiagnostic(diagnostics, `ANSI_${key.toUpperCase()}_CONTRAST`, `ANSI ${key} 与终端背景对比度偏低。`, value, theme.terminal.background, 2);
  }
  return diagnostics;
}

function addContrastDiagnostic(diagnostics: ThemeDiagnostic[], code: string, message: string, foreground: string, background: string, minimum: number) {
  if (contrastRatio(foreground, background) < minimum) diagnostics.push({ severity: "warning", code, message });
}

function shadowCss(shadow: ShadowTokens) {
  return `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${hexToRgba(shadow.color, shadow.opacity)}`;
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
