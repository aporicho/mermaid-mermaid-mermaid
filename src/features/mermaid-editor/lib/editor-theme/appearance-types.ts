export type CssBorderStyle = "none" | "solid" | "dashed" | "dotted" | "double";
export type CanvasStrokeStyle = "none" | "solid" | "dashed" | "dotted" | "dash-dot" | "custom";

export type ShadowTokens = {
  color: string;
  blur: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
};

export type CssBorderTokens = {
  color: string;
  width: number;
  style: CssBorderStyle;
};

export type CanvasBorderTokens = {
  color: string;
  width: number;
  style: CanvasStrokeStyle;
  customDash: readonly number[];
};

export type InterfaceThemeTokens = {
  colors: {
    background: string;
    foreground: string;
    icon: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    focusRing: string;
  };
  surface: {
    borderWidth: number;
    borderStyle: CssBorderStyle;
    dividerWidth: number;
    focusRingWidth: number;
    opacity: number;
    backdropBlur: number;
  };
  state: {
    hoverOpacity: number;
    pressedOpacity: number;
    selectedOpacity: number;
    disabledOpacity: number;
  };
  radius: {
    app: number;
    controlSm: number;
    controlMd: number;
    controlLg: number;
  };
  shadow: {
    popover: ShadowTokens;
    panel: ShadowTokens;
    dialog: ShadowTokens;
    toolbar: ShadowTokens;
  };
  spacing: {
    panelPadding: number;
    panelHeaderHeight: number;
    panelFooterHeight: number;
    controlGap: number;
    controlPaddingX: number;
    controlPaddingY: number;
    iconButtonSize: number;
  };
  icon: {
    family: "iconoir";
    sizeSm: number;
    sizeButton: number;
    strokeWidth: number;
    buttonHeightSm: number;
    buttonHeightMd: number;
  };
  scrollbar: {
    size: number;
    minThumbLength: number;
    radius: number;
    inset: number;
    opacity: number;
    hoverOpacity: number;
    activeOpacity: number;
  };
};

export type CanvasThemeTokens = {
  surface: {
    background: string;
    renderBackground: string;
  };
  grid: {
    color: string;
    minorStep: number;
    majorEvery: number;
    minorAlpha: number;
    majorAlpha: number;
    superAlpha: number;
    minorRadiusPx: number;
    majorRadiusPx: number;
    superRadiusPx: number;
    minorVisibleScale: number;
    majorVisibleScale: number;
    maxDots: number;
  };
  ordinaryNode: {
    textColor: string;
    borderColor: string;
    hoverBorderColor: string;
    selectedBorderColor: string;
    invalidBorderColor: string;
    borderWidth: number;
    emphasizedBorderWidth: number;
    highlightBorderBoost: number;
    borderStyle: CanvasStrokeStyle;
    customDash: readonly number[];
    fillSaturation: number;
    fillLuminanceSteps: number;
    radius: number;
    roundedRadius: number;
    polygonRadius: number;
    forkRadius: number;
    shadow: ShadowTokens;
    dragShadow: ShadowTokens;
    paddingX: number;
    paddingY: number;
    minChars: number;
    maxChars: number;
    maxLines: number;
  };
  edge: {
    color: string;
    textColor: string;
    hoverColor: string;
    selectedColor: string;
    invalidColor: string;
    width: number;
    thickWidth: number;
    dottedWidth: number;
    emphasizedWidth: number;
    highlightBorderBoost: number;
    style: CanvasStrokeStyle;
    customDash: readonly number[];
    dottedDash: readonly number[];
    invisibleOpacity: number;
    invalidPreviewOpacity: number;
    pointerLength: number;
    pointerWidth: number;
    endpointMarkerRadius: number;
    hitStrokeWidth: number;
    parallelSpacing: number;
    curveSegments: number;
  };
  edgeLabel: {
    background: string;
    textColor: string;
    borderColor: string;
    hoverBorderColor: string;
    selectedBorderColor: string;
    borderWidth: number;
    borderStyle: CanvasStrokeStyle;
    customDash: readonly number[];
    radius: number;
    minChars: number;
    maxChars: number;
    paddingX: number;
    height: number;
  };
  group: {
    background: string;
    backgroundOpacity: number;
    borderColor: string;
    hoverBorderColor: string;
    selectedBorderColor: string;
    invalidBorderColor: string;
    borderWidth: number;
    emphasizedBorderWidth: number;
    borderStyle: CanvasStrokeStyle;
    customDash: readonly number[];
    radius: number;
    shadow: ShadowTokens;
    paddingX: number;
    paddingTop: number;
    paddingBottom: number;
    minWidth: number;
    minHeight: number;
    fallbackGap: number;
    title: {
      background: string;
      textColor: string;
      borderColor: string;
      borderWidth: number;
      borderStyle: CanvasStrokeStyle;
      customDash: readonly number[];
      radius: number;
      shadow: ShadowTokens;
      height: number;
      insetX: number;
      insetTop: number;
      paddingX: number;
    };
    anchorCornerScale: number;
    anchorCornerOpacity: number;
  };
  overlay: {
    selection: {
      fillColor: string;
      fillOpacity: number;
      strokeColor: string;
      strokeWidth: number;
      strokeStyle: CanvasStrokeStyle;
      customDash: readonly number[];
    };
    connectionDraft: {
      validColor: string;
      invalidColor: string;
      invalidOpacity: number;
      strokeWidth: number;
      strokeStyle: CanvasStrokeStyle;
      customDash: readonly number[];
    };
    guide: {
      centerColor: string;
      edgeColor: string;
      strokeWidth: number;
      centerStyle: CanvasStrokeStyle;
      customDash: readonly number[];
    };
    anchor: {
      fillColor: string;
      targetColor: string;
      hoverColor: string;
      strokeColor: string;
      strokeWidth: number;
      radius: number;
      endpointRadius: number;
      activeRadiusBoost: number;
    };
  };
  actionBadge: {
    background: string;
    foreground: string;
    borderColor: string;
    borderWidth: number;
    borderStyle: CanvasStrokeStyle;
    customDash: readonly number[];
    radius: number;
    size: number;
    opacity: number;
    insetX: number;
    insetY: number;
  };
  mermaidSvg: {
    primaryColor: string;
    primaryTextColor: string;
    primaryBorderColor: string;
    secondaryColor: string;
    secondaryTextColor: string;
    tertiaryColor: string;
    tertiaryTextColor: string;
    lineColor: string;
    textColor: string;
    edgeLabelBackground: string;
    clusterBackground: string;
    clusterBorderColor: string;
  };
};
