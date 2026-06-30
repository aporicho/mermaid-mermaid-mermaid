import type { AlignmentGuide } from "@/features/mermaid-editor/lib/alignment-guides";
import type { InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasEdge, EditorMode, Selection } from "@/features/mermaid-editor/lib/editor-types";

export type InlineEditTarget = { type: "node" | "subgraph" | "edge"; id: string } | null | undefined;

export type NodeVisualKind = "normal" | "hovered" | "selected" | "dragging" | "editing" | "connectionTarget" | "connectionInvalid";
export type EdgeVisualKind = "normal" | "hovered" | "selected" | "editing";
export type AnchorVisualKind = "hidden" | "available" | "active" | "target";
export type EdgeEndpointVisualKind = "normal" | "hovered" | "active";

export type NodeVisualState = {
  kind: NodeVisualKind;
  stroke: string;
  strokeWidth: number;
  textFill: string;
};

export type EdgeVisualState = {
  kind: EdgeVisualKind;
  stroke: string;
  fill: string;
  strokeWidth: number;
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

export type CanvasVisualTokens = {
  colors: {
    accent: string;
    accentHover: string;
    connection: string;
    connectionInvalid: string;
    edge: string;
    edgeText: string;
    labelStroke: string;
    nodeStroke: string;
    nodeText: string;
    surface: string;
    selectionFill: string;
    anchorStroke: string;
    gridDotRgb: string;
    previewInvalid: string;
  };
  node: {
    cornerRadius: number;
    strokeWidth: number;
    emphasizedStrokeWidth: number;
  };
  anchor: {
    radius: number;
    endpointRadius: number;
    strokeWidth: number;
  };
  edge: {
    hitStrokeWidth: number;
    strokeWidth: number;
    thickStrokeWidth: number;
    dottedStrokeWidth: number;
    dottedDash: readonly number[];
    pointerLength: number;
    pointerWidth: number;
    parallelSpacing: number;
    labelCornerRadius: number;
    endpointMarkerRadius: number;
  };
  overlay: {
    strokeWidth: number;
    selectionDash: readonly number[];
    connectionDash: readonly number[];
    centerGuideDash: readonly number[];
    subgraphDash: readonly number[];
  };
  shape: {
    polygonCornerRadius: number;
    fallbackCornerRadius: number;
    forkCornerRadius: number;
  };
  subgraph: {
    fillOpacity: number;
    titleCornerRadius: number;
    titleInsetX: number;
    titleFontSize: number;
    titleFontWeight: string;
    titleStrokeWidth: number;
    anchorCornerScale: number;
    anchorCornerOpacity: number;
  };
};

export const CANVAS_VISUAL_TOKENS: CanvasVisualTokens = {
  colors: {
    accent: "#ff4050",
    accentHover: "#d92f41",
    connection: "#ff4050",
    connectionInvalid: "#9b5a50",
    edge: "#2a251f",
    edgeText: "#1c1712",
    labelStroke: "#b8ada0",
    nodeStroke: "#2a251f",
    nodeText: "#18130f",
    surface: "#fbf6ef",
    selectionFill: "rgba(255,64,80,0.08)",
    anchorStroke: "#fbf6ef",
    gridDotRgb: "34, 29, 24",
    previewInvalid: "#9f9286"
  },
  node: {
    cornerRadius: 14,
    strokeWidth: 1,
    emphasizedStrokeWidth: 1.5
  },
  anchor: {
    radius: 6,
    endpointRadius: 7,
    strokeWidth: 2
  },
  edge: {
    hitStrokeWidth: 18,
    strokeWidth: 2,
    thickStrokeWidth: 4,
    dottedStrokeWidth: 2,
    dottedDash: [1, 8],
    pointerLength: 10,
    pointerWidth: 10,
    parallelSpacing: 18,
    labelCornerRadius: 8,
    endpointMarkerRadius: 4.5
  },
  overlay: {
    strokeWidth: 1,
    selectionDash: [6, 5],
    connectionDash: [8, 6],
    centerGuideDash: [6, 5],
    subgraphDash: [8, 6]
  },
  shape: {
    polygonCornerRadius: 6,
    fallbackCornerRadius: 4,
    forkCornerRadius: 2
  },
  subgraph: {
    fillOpacity: 0.34,
    titleCornerRadius: 8,
    titleInsetX: 10,
    titleFontSize: 12,
    titleFontWeight: "bold",
    titleStrokeWidth: 1,
    anchorCornerScale: 0.72,
    anchorCornerOpacity: 0.65
  }
};

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

  if (kind === "editing" || kind === "dragging" || kind === "selected") {
    return emphasizedNode(kind, visualTokens.colors.accent, visualTokens);
  }

  if (kind === "connectionTarget") {
    return emphasizedNode(kind, visualTokens.colors.connection, visualTokens);
  }

  if (kind === "connectionInvalid") {
    return emphasizedNode(kind, visualTokens.colors.connectionInvalid, visualTokens);
  }

  if (kind === "hovered") {
    return {
      kind,
      stroke: visualTokens.colors.accentHover,
      strokeWidth: visualTokens.node.strokeWidth,
      textFill: visualTokens.colors.nodeText
    };
  }

  return {
    kind,
    stroke: visualTokens.colors.nodeStroke,
    strokeWidth: visualTokens.node.strokeWidth,
    textFill: visualTokens.colors.nodeText
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
  const base = {
    kind,
    visible: kind !== "hidden",
    radius: visualTokens.anchor.radius,
    stroke: visualTokens.colors.anchorStroke,
    strokeWidth: visualTokens.anchor.strokeWidth
  };

  if (kind === "active" || kind === "target") {
    return {
      ...base,
      fill: visualTokens.colors.connection
    };
  }

  return {
    ...base,
    fill: visualTokens.colors.accent
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
    ? visualTokens.colors.accent
    : hovered
      ? visualTokens.colors.accentHover
      : visualTokens.colors.edge;

  return {
    kind,
    stroke,
    fill: stroke,
    strokeWidth: semantic.strokeWidth + (emphasized ? 1 : 0),
    dash: semantic.dash,
    opacity: semantic.opacity,
    labelFill: visualTokens.colors.surface,
    labelStroke: emphasized || hovered ? stroke : visualTokens.colors.labelStroke,
    labelTextFill: emphasized || hovered ? visualTokens.colors.accent : visualTokens.colors.edgeText
  };
}

export function getConnectionDraftVisualState(input: { valid?: boolean; edge?: CanvasEdge; visualTokens?: CanvasVisualTokens } = {}) {
  const visualTokens = input.visualTokens ?? CANVAS_VISUAL_TOKENS;
  const semantic = input.edge ? edgeSemanticStyle(input.edge, visualTokens) : { strokeWidth: visualTokens.edge.strokeWidth, dash: visualTokens.overlay.connectionDash };
  const valid = input.valid ?? false;
  const stroke = valid ? visualTokens.colors.connection : visualTokens.colors.previewInvalid;
  const arrowType = input.edge?.style === "invisible" ? "none" : input.edge?.markerEnd || input.edge?.arrowType || "arrow";

  return {
    stroke,
    fill: stroke,
    strokeWidth: semantic.strokeWidth,
    dash: semantic.dash ? [...semantic.dash] : undefined,
    opacity: valid ? 1 : 0.48,
    pointerLength: arrowType === "arrow" ? visualTokens.edge.pointerLength : 0,
    pointerWidth: arrowType === "arrow" ? visualTokens.edge.pointerWidth : 0
  };
}

export function getSelectionBoxVisualState(visualTokens: CanvasVisualTokens = CANVAS_VISUAL_TOKENS) {
  return {
    fill: visualTokens.colors.selectionFill,
    stroke: visualTokens.colors.accent,
    strokeWidth: visualTokens.overlay.strokeWidth,
    dash: [...visualTokens.overlay.selectionDash]
  };
}

export function getAlignmentGuideVisualState(kind: AlignmentGuide["kind"], visualTokens: CanvasVisualTokens = CANVAS_VISUAL_TOKENS) {
  return {
    stroke: kind === "center" ? visualTokens.colors.accent : visualTokens.colors.accentHover,
    strokeWidth: visualTokens.overlay.strokeWidth,
    dash: kind === "center" ? [...visualTokens.overlay.centerGuideDash] : undefined
  };
}

export function getEdgeEndpointVisualState(input: { hovered?: boolean; active?: boolean; visualTokens?: CanvasVisualTokens } = {}): EdgeEndpointVisualState {
  const visualTokens = input.visualTokens ?? CANVAS_VISUAL_TOKENS;
  const kind: EdgeEndpointVisualKind = input.active ? "active" : input.hovered ? "hovered" : "normal";

  return {
    kind,
    radius: visualTokens.anchor.endpointRadius + (kind === "active" ? 1 : 0),
    fill: kind === "active" ? visualTokens.colors.connection : kind === "hovered" ? visualTokens.colors.accentHover : visualTokens.colors.accent,
    stroke: visualTokens.colors.anchorStroke,
    strokeWidth: visualTokens.anchor.strokeWidth
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
  return (inlineEdit?.type === "node" && inlineEdit.id === nodeId) || (interactionState.kind === "editingNodeText" && interactionState.nodeId === nodeId);
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

function emphasizedNode(kind: NodeVisualKind, stroke: string, visualTokens: CanvasVisualTokens): NodeVisualState {
  return {
    kind,
    stroke,
    strokeWidth: visualTokens.node.emphasizedStrokeWidth,
    textFill: visualTokens.colors.nodeText
  };
}

function edgeSemanticStyle(edge: CanvasEdge, visualTokens: CanvasVisualTokens = CANVAS_VISUAL_TOKENS) {
  if (edge.style === "thick") return { strokeWidth: visualTokens.edge.thickStrokeWidth, dash: undefined };
  if (edge.style === "dotted") return { strokeWidth: visualTokens.edge.dottedStrokeWidth, dash: [...visualTokens.edge.dottedDash] };
  if (edge.style === "invisible") return { strokeWidth: visualTokens.edge.strokeWidth, dash: [...visualTokens.overlay.connectionDash], opacity: 0.32 };
  if (edge.animation && edge.animation !== "none") return { strokeWidth: visualTokens.edge.strokeWidth, dash: [...visualTokens.edge.dottedDash] };
  return { strokeWidth: visualTokens.edge.strokeWidth, dash: undefined };
}
