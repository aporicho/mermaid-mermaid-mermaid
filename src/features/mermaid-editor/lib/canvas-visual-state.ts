import type { AlignmentGuide } from "@/features/mermaid-editor/lib/alignment-guides";
import type { InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasEdge, EditorMode, Selection } from "@/features/mermaid-editor/lib/editor-types";

export type InlineEditTarget = { type: "node" | "edge"; id: string } | null | undefined;

export type NodeVisualKind = "normal" | "hovered" | "selected" | "dragging" | "editing" | "connectionTarget";
export type EdgeVisualKind = "normal" | "hovered" | "selected" | "editing";
export type AnchorVisualKind = "hidden" | "available" | "active" | "target";

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

export const CANVAS_VISUAL_TOKENS = {
  colors: {
    accent: "#1f7a68",
    accentHover: "#2c9b82",
    connection: "#c9872d",
    edge: "#526766",
    edgeText: "#344441",
    labelStroke: "#c9d5d3",
    nodeStroke: "#b8c8c4",
    nodeText: "#172022",
    surface: "#ffffff",
    selectionFill: "rgba(31,122,104,0.08)",
    anchorStroke: "#ffffff",
    gridDotRgb: "31, 122, 104"
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
    pointerLength: 10,
    pointerWidth: 10,
    labelWidth: 92,
    labelHeight: 28,
    labelCornerRadius: 6
  },
  overlay: {
    strokeWidth: 1,
    selectionDash: [6, 5],
    connectionDash: [8, 6],
    centerGuideDash: [6, 5]
  }
} as const;

export function getNodeVisualState(input: {
  nodeId: string;
  selection: Selection;
  hoveredNodeId: string | null;
  interactionState: InteractionState;
  inlineEdit?: InlineEditTarget;
}): NodeVisualState {
  const kind = getNodeVisualKind(input);

  if (kind === "editing" || kind === "dragging" || kind === "selected") {
    return emphasizedNode(kind, CANVAS_VISUAL_TOKENS.colors.accent);
  }

  if (kind === "connectionTarget") {
    return emphasizedNode(kind, CANVAS_VISUAL_TOKENS.colors.connection);
  }

  if (kind === "hovered") {
    return {
      kind,
      stroke: CANVAS_VISUAL_TOKENS.colors.accentHover,
      strokeWidth: CANVAS_VISUAL_TOKENS.node.strokeWidth,
      textFill: CANVAS_VISUAL_TOKENS.colors.nodeText
    };
  }

  return {
    kind,
    stroke: CANVAS_VISUAL_TOKENS.colors.nodeStroke,
    strokeWidth: CANVAS_VISUAL_TOKENS.node.strokeWidth,
    textFill: CANVAS_VISUAL_TOKENS.colors.nodeText
  };
}

export function getAnchorVisualState(input: {
  nodeId: string;
  mode: EditorMode;
  selection: Selection;
  hoveredNodeId: string | null;
  interactionState: InteractionState;
  inlineEdit?: InlineEditTarget;
}): AnchorVisualState {
  const kind = getAnchorVisualKind(input);
  const base = {
    kind,
    visible: kind !== "hidden",
    radius: CANVAS_VISUAL_TOKENS.anchor.radius,
    stroke: CANVAS_VISUAL_TOKENS.colors.anchorStroke,
    strokeWidth: CANVAS_VISUAL_TOKENS.anchor.strokeWidth
  };

  if (kind === "active" || kind === "target") {
    return {
      ...base,
      fill: CANVAS_VISUAL_TOKENS.colors.connection
    };
  }

  if (kind === "available" && input.mode === "connect") {
    return {
      ...base,
      fill: CANVAS_VISUAL_TOKENS.colors.connection
    };
  }

  return {
    ...base,
    fill: CANVAS_VISUAL_TOKENS.colors.accent
  };
}

export function getEdgeVisualState(input: {
  edge: CanvasEdge;
  selection: Selection;
  hoveredEdgeId: string | null;
  interactionState: InteractionState;
  inlineEdit?: InlineEditTarget;
}): EdgeVisualState {
  const kind = getEdgeVisualKind(input);
  const semantic = edgeSemanticStyle(input.edge);
  const emphasized = kind === "selected" || kind === "editing";
  const hovered = kind === "hovered";
  const stroke = emphasized
    ? CANVAS_VISUAL_TOKENS.colors.accent
    : hovered
      ? CANVAS_VISUAL_TOKENS.colors.accentHover
      : CANVAS_VISUAL_TOKENS.colors.edge;

  return {
    kind,
    stroke,
    fill: stroke,
    strokeWidth: semantic.strokeWidth + (emphasized ? 1 : 0),
    dash: semantic.dash,
    labelFill: CANVAS_VISUAL_TOKENS.colors.surface,
    labelStroke: emphasized || hovered ? stroke : CANVAS_VISUAL_TOKENS.colors.labelStroke,
    labelTextFill: emphasized || hovered ? CANVAS_VISUAL_TOKENS.colors.accent : CANVAS_VISUAL_TOKENS.colors.edgeText
  };
}

export function getConnectionDraftVisualState() {
  return {
    stroke: CANVAS_VISUAL_TOKENS.colors.connection,
    fill: CANVAS_VISUAL_TOKENS.colors.connection,
    strokeWidth: 2,
    dash: [...CANVAS_VISUAL_TOKENS.overlay.connectionDash],
    pointerLength: CANVAS_VISUAL_TOKENS.edge.pointerLength,
    pointerWidth: CANVAS_VISUAL_TOKENS.edge.pointerWidth
  };
}

export function getSelectionBoxVisualState() {
  return {
    fill: CANVAS_VISUAL_TOKENS.colors.selectionFill,
    stroke: CANVAS_VISUAL_TOKENS.colors.accent,
    strokeWidth: CANVAS_VISUAL_TOKENS.overlay.strokeWidth,
    dash: [...CANVAS_VISUAL_TOKENS.overlay.selectionDash]
  };
}

export function getAlignmentGuideVisualState(kind: AlignmentGuide["kind"]) {
  return {
    stroke: kind === "center" ? CANVAS_VISUAL_TOKENS.colors.accent : CANVAS_VISUAL_TOKENS.colors.accentHover,
    strokeWidth: CANVAS_VISUAL_TOKENS.overlay.strokeWidth,
    dash: kind === "center" ? [...CANVAS_VISUAL_TOKENS.overlay.centerGuideDash] : undefined
  };
}

export function getEdgeEndpointVisualState() {
  return {
    radius: CANVAS_VISUAL_TOKENS.anchor.endpointRadius,
    fill: CANVAS_VISUAL_TOKENS.colors.accent,
    stroke: CANVAS_VISUAL_TOKENS.colors.anchorStroke,
    strokeWidth: CANVAS_VISUAL_TOKENS.anchor.strokeWidth
  };
}

function getNodeVisualKind(input: {
  nodeId: string;
  selection: Selection;
  hoveredNodeId: string | null;
  interactionState: InteractionState;
  inlineEdit?: InlineEditTarget;
}): NodeVisualKind {
  if (isEditingNode(input.nodeId, input.interactionState, input.inlineEdit)) return "editing";
  if (isDraggingNode(input.nodeId, input.interactionState, input.selection)) return "dragging";
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
  if (isEditingNode(input.nodeId, input.interactionState, input.inlineEdit)) return "hidden";

  if (input.interactionState.kind === "connectingEdge") {
    if (input.interactionState.fromNodeId === input.nodeId) return "active";
    if (input.hoveredNodeId === input.nodeId) return "target";
  }

  if (input.mode === "connect" || input.hoveredNodeId === input.nodeId || input.selection.nodeIds.includes(input.nodeId)) return "available";
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
  return interactionState.kind === "connectingEdge" && interactionState.fromNodeId !== nodeId && hoveredNodeId === nodeId;
}

function emphasizedNode(kind: NodeVisualKind, stroke: string): NodeVisualState {
  return {
    kind,
    stroke,
    strokeWidth: CANVAS_VISUAL_TOKENS.node.emphasizedStrokeWidth,
    textFill: CANVAS_VISUAL_TOKENS.colors.nodeText
  };
}

function edgeSemanticStyle(edge: CanvasEdge) {
  if (edge.style === "thick") return { strokeWidth: 4, dash: undefined };
  if (edge.style === "dotted") return { strokeWidth: 2, dash: [1, 8] };
  return { strokeWidth: 2, dash: undefined };
}
