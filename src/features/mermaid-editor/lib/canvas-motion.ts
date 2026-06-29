import type { CanvasEdge, CanvasNode, MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import type { RuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import { shouldAnimateCanvasItemCount } from "@/features/mermaid-editor/lib/editor-motion";

export type CanvasMotionNodeSnapshot = Pick<CanvasNode, "id" | "x" | "y">;

export type CanvasMotionChangeSet = {
  createdNodeIds: string[];
  movedNodeIds: string[];
  removedNodeIds: string[];
  highlightedNodeIds: string[];
  highlightedEdgeIds: string[];
  animateLayout: boolean;
};

export type CanvasMotionFrame = {
  width: number;
  height: number;
};

export type CanvasCenterScaleTransform = {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
};

export type CanvasNodePreviewPositions = Record<string, { x: number; y: number }>;
export type CanvasProximityScales = Record<string, number>;

export type CanvasProximityFrame = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasProximityViewport = {
  x: number;
  y: number;
  scale: number;
};

export type CanvasProximityPoint = {
  x: number;
  y: number;
};

export type CanvasProximityRuntimeInput = {
  reduced: boolean;
  viewNodes: boolean;
  panningRequested: boolean;
  inlineEditing: boolean;
  interactionKind: string;
  radiusPx: number;
  maxScale: number;
  mode?: string;
};

export type CanvasProximityStepInput = {
  current: CanvasProximityScales;
  target: CanvasProximityScales;
  deltaMs: number;
  durationMs: number;
};

export function snapshotCanvasNodes(graph: MermaidGraph): Map<string, CanvasMotionNodeSnapshot> {
  return new Map(graph.nodes.map((node) => [node.id, { id: node.id, x: node.x, y: node.y }]));
}

export function mergeCanvasNodePreviewPositions(nodes: CanvasNode[], positions: CanvasNodePreviewPositions | null | undefined) {
  if (!positions) return nodes;
  return nodes.map((node) => {
    const position = positions[node.id];
    return position ? { ...node, x: position.x, y: position.y } : node;
  });
}

export function resolveCanvasMotionChanges(input: {
  previousNodes: Map<string, CanvasMotionNodeSnapshot>;
  graph: MermaidGraph;
  previousSelection?: Selection;
  selection: Selection;
  motion: RuntimeEditorMotion;
  interactionKind: string;
}): CanvasMotionChangeSet {
  const currentNodes = snapshotCanvasNodes(input.graph);
  const createdNodeIds: string[] = [];
  const movedNodeIds: string[] = [];
  const removedNodeIds: string[] = [];

  for (const node of input.graph.nodes) {
    const previous = input.previousNodes.get(node.id);
    if (!previous) {
      createdNodeIds.push(node.id);
      continue;
    }
    if (previous.x !== node.x || previous.y !== node.y) movedNodeIds.push(node.id);
  }

  for (const previousId of input.previousNodes.keys()) {
    if (!currentNodes.has(previousId)) removedNodeIds.push(previousId);
  }

  const createdNodeIdSet = new Set(createdNodeIds);
  const highlightedNodeIds = changedSelectionItems(input.previousSelection?.nodeIds ?? [], input.selection.nodeIds).filter((id) => !createdNodeIdSet.has(id));
  const highlightedEdgeIds = changedSelectionItems(input.previousSelection?.edgeIds ?? [], input.selection.edgeIds);
  const changedCount = createdNodeIds.length + movedNodeIds.length + removedNodeIds.length;
  const animatableInteraction = input.interactionKind !== "draggingNodes" && input.interactionKind !== "draggingSubgraphs" && input.interactionKind !== "panning";

  return {
    createdNodeIds,
    movedNodeIds,
    removedNodeIds,
    highlightedNodeIds,
    highlightedEdgeIds,
    animateLayout: animatableInteraction && shouldAnimateCanvasItemCount(changedCount, input.motion)
  };
}

export function centerScaleTransform(frame: CanvasMotionFrame): CanvasCenterScaleTransform {
  return {
    x: frame.width / 2,
    y: frame.height / 2,
    offsetX: frame.width / 2,
    offsetY: frame.height / 2
  };
}

export function proximityScaleAtDistance(distancePx: number, radiusPx: number, maxScale: number) {
  if (!Number.isFinite(distancePx) || radiusPx <= 0 || maxScale <= 1) return 1;
  const progress = clamp(1 - distancePx / radiusPx, 0, 1);
  const eased = 1 - (1 - progress) ** 2;
  return 1 + (maxScale - 1) * eased;
}

export function resolveCanvasProximityScales(input: {
  frames: CanvasProximityFrame[];
  pointerScreen: CanvasProximityPoint | null | undefined;
  viewport: CanvasProximityViewport;
  radiusPx: number;
  maxScale: number;
}): CanvasProximityScales {
  if (!input.pointerScreen || input.radiusPx <= 0 || input.maxScale <= 1) return {};

  const viewportScale = Math.max(input.viewport.scale, 0.01);
  const scales: CanvasProximityScales = {};
  for (const frame of input.frames) {
    const centerWorld = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
    const centerScreen = {
      x: input.viewport.x + centerWorld.x * viewportScale,
      y: input.viewport.y + centerWorld.y * viewportScale
    };
    const distance = Math.hypot(input.pointerScreen.x - centerScreen.x, input.pointerScreen.y - centerScreen.y);
    const scale = proximityScaleAtDistance(distance, input.radiusPx, input.maxScale);
    if (scale > 1.001) scales[frame.id] = scale;
  }

  return scales;
}

export function resolveNextCanvasProximityScales(input: CanvasProximityStepInput): CanvasProximityScales {
  const alpha = proximityTrackingAlpha(input.deltaMs, input.durationMs);
  const next: CanvasProximityScales = {};
  const keys = new Set([...Object.keys(input.current), ...Object.keys(input.target)]);

  for (const key of keys) {
    const from = input.current[key] ?? 1;
    const to = input.target[key] ?? 1;
    const value = alpha >= 1 ? to : from + (to - from) * alpha;
    const resolved = Math.abs(value - to) <= 0.001 ? to : value;
    if (Math.abs(resolved - 1) > 0.001) next[key] = resolved;
  }

  return next;
}

export function resolveCanvasProximityEdgeIds(edges: Pick<CanvasEdge, "id" | "from" | "to">[], scales: CanvasProximityScales) {
  const activeNodeIds = new Set(Object.keys(scales).filter((id) => Math.abs(scales[id] - 1) > 0.001));
  const edgeIds = new Set<string>();
  if (activeNodeIds.size === 0) return edgeIds;

  for (const edge of edges) {
    if (activeNodeIds.has(edge.from) || activeNodeIds.has(edge.to)) edgeIds.add(edge.id);
  }

  return edgeIds;
}

export function shouldRunCanvasProximity(input: CanvasProximityRuntimeInput) {
  return (
    !input.reduced &&
    input.viewNodes &&
    input.radiusPx > 0 &&
    input.maxScale > 1 &&
    !input.panningRequested &&
    !input.inlineEditing &&
    !isCanvasProximityPausedInteraction(input.interactionKind)
  );
}

export function isCanvasProximityPausedInteraction(kind: string) {
  return (
    kind === "draggingNodes" ||
    kind === "draggingSubgraphs" ||
    kind === "panning" ||
    kind === "marqueeSelecting" ||
    kind === "connectingEdge" ||
    kind === "retargetingEdge" ||
    kind === "editingNodeText" ||
    kind === "editingEdgeLabel"
  );
}

export function scaleRectFromCenter<T extends CanvasProximityFrame>(frame: T, scale: number): T {
  if (!Number.isFinite(scale) || scale <= 1) return frame;

  const width = frame.width * scale;
  const height = frame.height * scale;
  return {
    ...frame,
    x: frame.x - (width - frame.width) / 2,
    y: frame.y - (height - frame.height) / 2,
    width,
    height
  };
}

function changedSelectionItems(previous: readonly string[], next: readonly string[]) {
  const previousSet = new Set(previous);
  return next.filter((id) => !previousSet.has(id));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function proximityTrackingAlpha(deltaMs: number, durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 1;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return clamp(1 - Math.exp((-deltaMs * 4) / durationMs), 0, 1);
}
