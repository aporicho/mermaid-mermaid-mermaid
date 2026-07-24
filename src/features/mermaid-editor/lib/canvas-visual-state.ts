import type { AlignmentGuide } from "@/features/mermaid-editor/lib/alignment-guides";
import type { InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasEdge, EditorMode, Selection } from "@/features/mermaid-editor/lib/editor-types";
import type { CanvasStrokeStyle, CanvasThemeTokens, ShadowTokens } from "@/features/mermaid-editor/lib/editor-theme/appearance-types";

export type InlineEditTarget = { type: "node" | "subgraph" | "edge" | "tableCell" | "tableHeader"; id: string } | null | undefined;

export type NodeVisualKind = "normal" | "hovered" | "selected" | "dragging" | "editing" | "connectionTarget" | "connectionInvalid";
export type EdgeVisualKind = "normal" | "hovered" | "selected" | "editing";
export type AnchorVisualKind = "hidden" | "available" | "active" | "target";
export type EdgeEndpointVisualKind = "normal" | "hovered" | "active";

export type NodeVisualState = {
  kind: NodeVisualKind;
  stroke: string;
  strokeWidth: number;
  strokeEnabled: boolean;
  dash?: number[];
  textFill: string;
  shadow: ShadowTokens;
};

export type EdgeVisualState = {
  kind: EdgeVisualKind;
  stroke: string;
  fill: string;
  strokeWidth: number;
  strokeEnabled: boolean;
  dash?: number[];
  opacity?: number;
  labelFill: string;
  labelStroke: string;
  labelTextFill: string;
};

export type AnchorVisualState = {
  kind: AnchorVisualKind;
  visible: boolean;
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type EdgeEndpointVisualState = {
  kind: EdgeEndpointVisualKind;
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type GroupVisualKind = "normal" | "hovered" | "selected" | "connectionTarget" | "connectionInvalid";

export type GroupVisualState = {
  kind: GroupVisualKind;
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeEnabled: boolean;
  dash?: number[];
  shadow: ShadowTokens;
};

export type CanvasVisualTokens = Omit<CanvasThemeTokens, "mermaidSvg">;

export const CANVAS_VISUAL_TOKENS: CanvasVisualTokens = {
  surface: {
    background: "#fbf6ef",
    renderBackground: "#f8f3ec"
  },
  grid: {
    color: "#18130f",
    minorStep: 24,
    majorEvery: 5,
    minorAlpha: 0.18,
    majorAlpha: 0.3,
    superAlpha: 0.28,
    minorRadiusPx: 0.85,
    majorRadiusPx: 1.25,
    superRadiusPx: 1.3,
    minorVisibleScale: 0.72,
    majorVisibleScale: 0.24,
    maxDots: 5_200
  },
  ordinaryNode: {
    textColor: "#18130f",
    borderColor: "#2a251f",
    hoverBorderColor: "#b91f31",
    selectedBorderColor: "#ff4050",
    invalidBorderColor: "#9b5a50",
    borderWidth: 1,
    emphasizedBorderWidth: 1.5,
    highlightBorderBoost: 1,
    borderStyle: "solid",
    customDash: [],
    fillSaturation: 1,
    fillLuminanceSteps: 256,
    radius: 4,
    roundedRadius: 14,
    polygonRadius: 6,
    forkRadius: 2,
    shadow: { color: "#2a251f", blur: 0, opacity: 0, offsetX: 0, offsetY: 0 },
    dragShadow: { color: "#2a251f", blur: 12, opacity: 0.22, offsetX: 0, offsetY: 4 },
    paddingX: 14,
    paddingY: 14,
    minChars: 6,
    maxChars: 24,
    maxLines: 12
  },
  edge: {
    color: "#2a251f",
    textColor: "#1c1712",
    hoverColor: "#b91f31",
    selectedColor: "#ff4050",
    invalidColor: "#9f9286",
    width: 2,
    thickWidth: 4,
    dottedWidth: 2,
    emphasizedWidth: 3,
    highlightBorderBoost: 0,
    style: "solid",
    customDash: [],
    dottedDash: [1, 8],
    invisibleOpacity: 0.32,
    invalidPreviewOpacity: 0.48,
    pointerLength: 10,
    pointerWidth: 10,
    endpointMarkerRadius: 4.5,
    hitStrokeWidth: 18,
    parallelSpacing: 18,
    curveSegments: 120
  },
  edgeLabel: {
    background: "#fbf6ef",
    textColor: "#1c1712",
    borderColor: "#b8ada0",
    hoverBorderColor: "#b91f31",
    selectedBorderColor: "#ff4050",
    borderWidth: 1,
    borderStyle: "solid",
    customDash: [],
    radius: 8,
    minChars: 4,
    maxChars: 20,
    paddingX: 10,
    height: 28
  },
  group: {
    background: "#fbf6ef",
    backgroundOpacity: 0.34,
    borderColor: "#b8ada0",
    hoverBorderColor: "#b91f31",
    selectedBorderColor: "#ff4050",
    invalidBorderColor: "#9b5a50",
    borderWidth: 1,
    emphasizedBorderWidth: 1.5,
    borderStyle: "dashed",
    customDash: [8, 6],
    radius: 14,
    shadow: { color: "#18130f", blur: 0, opacity: 0, offsetX: 0, offsetY: 0 },
    paddingX: 36,
    paddingTop: 54,
    paddingBottom: 32,
    minWidth: 220,
    minHeight: 128,
    fallbackGap: 48,
    title: {
      backgroundEnabled: false,
      background: "#fbf6ef",
      textColor: "#18130f",
      borderColor: "#b8ada0",
      borderWidth: 1,
      borderStyle: "solid",
      customDash: [],
      radius: 8,
      shadow: { color: "#18130f", blur: 0, opacity: 0, offsetX: 0, offsetY: 0 },
      height: 28,
      insetX: 14,
      insetTop: 10,
      paddingX: 10
    },
    anchorCornerScale: 0.72,
    anchorCornerOpacity: 0.65
  },
  overlay: {
    selection: {
      fillColor: "#ff4050",
      fillOpacity: 0.08,
      strokeColor: "#ff4050",
      strokeWidth: 1,
      strokeStyle: "dashed",
      customDash: [6, 5]
    },
    connectionDraft: {
      validColor: "#ff4050",
      invalidColor: "#9f9286",
      invalidOpacity: 0.48,
      strokeWidth: 2,
      strokeStyle: "dashed",
      customDash: [8, 6]
    },
    guide: {
      centerColor: "#ff4050",
      edgeColor: "#b91f31",
      strokeWidth: 1,
      centerStyle: "dashed",
      customDash: [6, 5]
    },
    anchor: {
      fillColor: "#ff4050",
      targetColor: "#ff4050",
      hoverColor: "#b91f31",
      strokeColor: "#fbf6ef",
      strokeWidth: 2,
      radius: 6,
      endpointRadius: 7,
      activeRadiusBoost: 1
    }
  },
  actionBadge: {
    background: "#fbf6ef",
    foreground: "#ff4050",
    borderColor: "#ff4050",
    borderWidth: 1.5,
    borderStyle: "solid",
    customDash: [],
    radius: 9,
    size: 18,
    opacity: 0.96,
    insetX: 10,
    insetY: 10
  }
};

export function resolveCanvasNodeFill(fill: string, visualTokens: CanvasVisualTokens = CANVAS_VISUAL_TOKENS) {
  const saturation = Math.min(1, Math.max(0, visualTokens.ordinaryNode.fillSaturation));
  const luminanceSteps = Math.round(Math.min(256, Math.max(2, visualTokens.ordinaryNode.fillLuminanceSteps)));
  if (saturation === 1 && luminanceSteps === 256) return fill;

  const rgb = parseHexColor(fill);
  if (!rgb) return fill;
  const gray = Math.round(rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722);
  const luminanceStep = 255 / (luminanceSteps - 1);
  const quantizedGray = Math.round(gray / luminanceStep) * luminanceStep;
  return rgbToHex({
    r: quantizedGray + (rgb.r - gray) * saturation,
    g: quantizedGray + (rgb.g - gray) * saturation,
    b: quantizedGray + (rgb.b - gray) * saturation
  });
}

export function resolveCanvasNodeTextFill(fill: string, preferredTextFill: string, visualTokens: CanvasVisualTokens = CANVAS_VISUAL_TOKENS) {
  if (visualTokens.ordinaryNode.fillLuminanceSteps >= 256) return preferredTextFill;

  const resolvedFill = parseHexColor(resolveCanvasNodeFill(fill, visualTokens));
  const preferred = parseHexColor(preferredTextFill);
  const alternate = parseHexColor(visualTokens.surface.background);
  if (!resolvedFill || !preferred || !alternate) return preferredTextFill;

  return colorContrast(resolvedFill, alternate) > colorContrast(resolvedFill, preferred) ? visualTokens.surface.background : preferredTextFill;
}

function parseHexColor(value: string) {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) {
    return {
      r: Number.parseInt(short[1] + short[1], 16),
      g: Number.parseInt(short[2] + short[2], 16),
      b: Number.parseInt(short[3] + short[3], 16)
    };
  }

  const full = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (!full) return null;
  return {
    r: Number.parseInt(full[1], 16),
    g: Number.parseInt(full[2], 16),
    b: Number.parseInt(full[3], 16)
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }) {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function colorContrast(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(rgb: { r: number; g: number; b: number }) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function getNodeVisualState(input: {
  nodeId: string;
  selection: Selection;
  hoveredNodeId: string | null;
  interactionState: InteractionState;
  connectionTargetNodeId?: string | null;
  connectionInvalidNodeId?: string | null;
  inlineEdit?: InlineEditTarget;
  visualTokens?: CanvasVisualTokens;
}): NodeVisualState {
  const visualTokens = input.visualTokens ?? CANVAS_VISUAL_TOKENS;
  const kind = getNodeVisualKind(input);
  const node = visualTokens.ordinaryNode;
  const base = {
    strokeEnabled: canvasStrokeEnabled(node.borderStyle),
    dash: canvasStrokeDash(node.borderStyle, node.customDash),
    textFill: node.textColor,
    shadow: kind === "dragging" ? node.dragShadow : node.shadow
  };

  if (kind === "editing" || kind === "dragging" || kind === "selected") {
    return { ...base, kind, stroke: node.selectedBorderColor, strokeWidth: node.emphasizedBorderWidth };
  }

  if (kind === "connectionTarget") {
    return { ...base, kind, stroke: node.selectedBorderColor, strokeWidth: node.emphasizedBorderWidth };
  }

  if (kind === "connectionInvalid") {
    return { ...base, kind, stroke: node.invalidBorderColor, strokeWidth: node.emphasizedBorderWidth };
  }

  if (kind === "hovered") {
    return {
      ...base,
      kind,
      stroke: node.hoverBorderColor,
      strokeWidth: node.borderWidth
    };
  }

  return {
    ...base,
    kind,
    stroke: node.borderColor,
    strokeWidth: node.borderWidth
  };
}

export function getAnchorVisualState(input: {
  nodeId: string;
  mode: EditorMode;
  selection: Selection;
  hoveredNodeId: string | null;
  interactionState: InteractionState;
  inlineEdit?: InlineEditTarget;
  visualTokens?: CanvasVisualTokens;
}): AnchorVisualState {
  const visualTokens = input.visualTokens ?? CANVAS_VISUAL_TOKENS;
  const kind = getAnchorVisualKind(input);
  const anchor = visualTokens.overlay.anchor;
  const base = {
    kind,
    visible: kind !== "hidden",
    radius: anchor.radius,
    stroke: anchor.strokeColor,
    strokeWidth: anchor.strokeWidth
  };

  if (kind === "active" || kind === "target") {
    return {
      ...base,
      fill: anchor.targetColor
    };
  }

  return {
    ...base,
    fill: anchor.fillColor
  };
}

export function getEdgeVisualState(input: {
  edge: CanvasEdge;
  selection: Selection;
  hoveredEdgeId: string | null;
  interactionState: InteractionState;
  inlineEdit?: InlineEditTarget;
  visualTokens?: CanvasVisualTokens;
}): EdgeVisualState {
  const visualTokens = input.visualTokens ?? CANVAS_VISUAL_TOKENS;
  const kind = getEdgeVisualKind(input);
  const semantic = edgeSemanticStyle(input.edge, visualTokens);
  const emphasized = kind === "selected" || kind === "editing";
  const hovered = kind === "hovered";
  const stroke = emphasized
    ? visualTokens.edge.selectedColor
    : hovered
      ? visualTokens.edge.hoverColor
      : visualTokens.edge.color;
  const labelStroke = emphasized
    ? visualTokens.edgeLabel.selectedBorderColor
    : hovered
      ? visualTokens.edgeLabel.hoverBorderColor
      : visualTokens.edgeLabel.borderColor;

  return {
    kind,
    stroke,
    fill: stroke,
    strokeWidth: emphasized ? visualTokens.edge.emphasizedWidth : semantic.strokeWidth,
    strokeEnabled: semantic.strokeEnabled,
    dash: semantic.dash,
    opacity: semantic.opacity,
    labelFill: visualTokens.edgeLabel.background,
    labelStroke,
    labelTextFill: emphasized || hovered ? visualTokens.edgeLabel.textColor : visualTokens.edge.textColor
  };
}

export function getConnectionDraftVisualState(input: { valid?: boolean; edge?: CanvasEdge; visualTokens?: CanvasVisualTokens } = {}) {
  const visualTokens = input.visualTokens ?? CANVAS_VISUAL_TOKENS;
  const draft = visualTokens.overlay.connectionDraft;
  const semantic = input.edge
    ? edgeSemanticStyle(input.edge, visualTokens)
    : {
        strokeWidth: draft.strokeWidth,
        strokeEnabled: canvasStrokeEnabled(draft.strokeStyle),
        dash: canvasStrokeDash(draft.strokeStyle, draft.customDash)
      };
  const valid = input.valid ?? false;
  const stroke = valid ? draft.validColor : input.edge ? visualTokens.edge.invalidColor : draft.invalidColor;
  const arrowType = input.edge?.style === "invisible" ? "none" : input.edge?.markerEnd || input.edge?.arrowType || "arrow";

  return {
    stroke,
    fill: stroke,
    fillEnabled: semantic.strokeEnabled,
    strokeWidth: semantic.strokeWidth,
    strokeEnabled: semantic.strokeEnabled,
    dash: semantic.dash ? [...semantic.dash] : undefined,
    opacity: valid ? 1 : input.edge ? visualTokens.edge.invalidPreviewOpacity : draft.invalidOpacity,
    pointerLength: arrowType === "arrow" ? visualTokens.edge.pointerLength : 0,
    pointerWidth: arrowType === "arrow" ? visualTokens.edge.pointerWidth : 0
  };
}

export function getSelectionBoxVisualState(visualTokens: CanvasVisualTokens = CANVAS_VISUAL_TOKENS) {
  const selection = visualTokens.overlay.selection;
  return {
    fill: colorWithOpacity(selection.fillColor, selection.fillOpacity),
    fillEnabled: selection.fillOpacity > 0,
    stroke: selection.strokeColor,
    strokeWidth: selection.strokeWidth,
    strokeEnabled: canvasStrokeEnabled(selection.strokeStyle),
    dash: canvasStrokeDash(selection.strokeStyle, selection.customDash)
  };
}

export function getGroupVisualState(input: {
  hovered?: boolean;
  selected?: boolean;
  connectionTarget?: boolean;
  connectionInvalid?: boolean;
  visualTokens?: CanvasVisualTokens;
} = {}): GroupVisualState {
  const visualTokens = input.visualTokens ?? CANVAS_VISUAL_TOKENS;
  const group = visualTokens.group;
  const kind: GroupVisualKind = input.connectionInvalid
    ? "connectionInvalid"
    : input.connectionTarget
      ? "connectionTarget"
      : input.selected
        ? "selected"
        : input.hovered
          ? "hovered"
          : "normal";
  const emphasized = kind === "selected" || kind === "connectionTarget" || kind === "connectionInvalid";
  const stroke = kind === "connectionInvalid"
    ? group.invalidBorderColor
    : kind === "selected" || kind === "connectionTarget"
      ? group.selectedBorderColor
      : kind === "hovered"
        ? group.hoverBorderColor
        : group.borderColor;

  return {
    kind,
    fill: group.background,
    fillOpacity: group.backgroundOpacity,
    stroke,
    strokeWidth: emphasized ? group.emphasizedBorderWidth : group.borderWidth,
    strokeEnabled: canvasStrokeEnabled(group.borderStyle),
    dash: canvasStrokeDash(group.borderStyle, group.customDash),
    shadow: group.shadow
  };
}

export function getAlignmentGuideVisualState(kind: AlignmentGuide["kind"], visualTokens: CanvasVisualTokens = CANVAS_VISUAL_TOKENS) {
  const guide = visualTokens.overlay.guide;
  return {
    stroke: kind === "center" ? guide.centerColor : guide.edgeColor,
    strokeWidth: guide.strokeWidth,
    strokeEnabled: kind !== "center" || canvasStrokeEnabled(guide.centerStyle),
    dash: kind === "center" ? canvasStrokeDash(guide.centerStyle, guide.customDash) : undefined
  };
}

export function getEdgeEndpointVisualState(input: { hovered?: boolean; active?: boolean; visualTokens?: CanvasVisualTokens } = {}): EdgeEndpointVisualState {
  const visualTokens = input.visualTokens ?? CANVAS_VISUAL_TOKENS;
  const kind: EdgeEndpointVisualKind = input.active ? "active" : input.hovered ? "hovered" : "normal";
  const anchor = visualTokens.overlay.anchor;

  return {
    kind,
    radius: anchor.endpointRadius + (kind === "active" ? anchor.activeRadiusBoost : 0),
    fill: kind === "active" ? anchor.targetColor : kind === "hovered" ? anchor.hoverColor : anchor.fillColor,
    stroke: anchor.strokeColor,
    strokeWidth: anchor.strokeWidth
  };
}

function getNodeVisualKind(input: {
  nodeId: string;
  selection: Selection;
  hoveredNodeId: string | null;
  interactionState: InteractionState;
  connectionTargetNodeId?: string | null;
  connectionInvalidNodeId?: string | null;
  inlineEdit?: InlineEditTarget;
}): NodeVisualKind {
  if (isEditingNode(input.nodeId, input.interactionState, input.inlineEdit)) return "editing";
  if (isDraggingNode(input.nodeId, input.interactionState, input.selection)) return "dragging";
  if (input.connectionInvalidNodeId === input.nodeId) return "connectionInvalid";
  if (input.connectionTargetNodeId === input.nodeId) return "connectionTarget";
  if (isConnectionTarget(input.nodeId, input.hoveredNodeId, input.interactionState)) return "connectionTarget";
  if (input.selection.nodeIds.includes(input.nodeId)) return "selected";
  if (input.hoveredNodeId === input.nodeId) return "hovered";
  return "normal";
}

function getAnchorVisualKind(input: {
  nodeId: string;
  mode: EditorMode;
  selection: Selection;
  hoveredNodeId: string | null;
  interactionState: InteractionState;
  inlineEdit?: InlineEditTarget;
}): AnchorVisualKind {
  if (input.mode === "connect") return "hidden";
  if (isEditingNode(input.nodeId, input.interactionState, input.inlineEdit)) return "hidden";
  if (input.interactionState.kind === "connectingEdge") return "hidden";

  if (input.hoveredNodeId === input.nodeId || input.selection.nodeIds.includes(input.nodeId)) return "available";
  return "hidden";
}

function getEdgeVisualKind(input: {
  edge: CanvasEdge;
  selection: Selection;
  hoveredEdgeId: string | null;
  interactionState: InteractionState;
  inlineEdit?: InlineEditTarget;
}): EdgeVisualKind {
  if (isEditingEdge(input.edge.id, input.interactionState, input.inlineEdit)) return "editing";
  if (input.selection.edgeIds.includes(input.edge.id)) return "selected";
  if (input.hoveredEdgeId === input.edge.id) return "hovered";
  return "normal";
}

function isEditingNode(nodeId: string, interactionState: InteractionState, inlineEdit?: InlineEditTarget) {
  return ((inlineEdit?.type === "node" || inlineEdit?.type === "tableCell" || inlineEdit?.type === "tableHeader") && inlineEdit.id === nodeId) || (interactionState.kind === "editingNodeText" && interactionState.nodeId === nodeId);
}

function isEditingEdge(edgeId: string, interactionState: InteractionState, inlineEdit?: InlineEditTarget) {
  return (inlineEdit?.type === "edge" && inlineEdit.id === edgeId) || (interactionState.kind === "editingEdgeLabel" && interactionState.edgeId === edgeId);
}

function isDraggingNode(nodeId: string, interactionState: InteractionState, selection: Selection) {
  return interactionState.kind === "draggingNodes" && (interactionState.nodeId === nodeId || selection.nodeIds.includes(nodeId));
}

function isConnectionTarget(nodeId: string, hoveredNodeId: string | null, interactionState: InteractionState) {
  return interactionState.kind === "connectingEdge" && interactionState.fromId !== nodeId && hoveredNodeId === nodeId;
}

function edgeSemanticStyle(edge: CanvasEdge, visualTokens: CanvasVisualTokens = CANVAS_VISUAL_TOKENS) {
  const strokeEnabled = canvasStrokeEnabled(visualTokens.edge.style);
  const themedDash = canvasStrokeDash(visualTokens.edge.style, visualTokens.edge.customDash);
  if (edge.style === "thick") return { strokeWidth: visualTokens.edge.thickWidth, strokeEnabled, dash: themedDash };
  if (edge.style === "dotted") return { strokeWidth: visualTokens.edge.dottedWidth, strokeEnabled, dash: [...visualTokens.edge.dottedDash] };
  if (edge.style === "invisible") return { strokeWidth: visualTokens.edge.width, strokeEnabled, dash: themedDash, opacity: visualTokens.edge.invisibleOpacity };
  if (edge.animation && edge.animation !== "none") return { strokeWidth: visualTokens.edge.width, strokeEnabled, dash: [...visualTokens.edge.dottedDash] };
  return { strokeWidth: visualTokens.edge.width, strokeEnabled, dash: themedDash };
}

export function canvasStrokeEnabled(style: CanvasStrokeStyle) {
  return style !== "none";
}

export function canvasStrokeDash(style: CanvasStrokeStyle, customDash: readonly number[]): number[] | undefined {
  if (style === "dashed") return [8, 6];
  if (style === "dotted") return [1, 6];
  if (style === "dash-dot") return [8, 5, 1, 5];
  if (style === "custom") return [...customDash];
  return undefined;
}

function colorWithOpacity(color: string, opacity: number) {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(1, Math.max(0, opacity))})`;
}
