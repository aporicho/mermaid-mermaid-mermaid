import type { InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasEdge, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { Rect } from "@/features/mermaid-editor/lib/node-geometry";
import { isEdgeVisible, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";

export type CanvasRenderEntityBounds = {
  id: string;
  frame: Rect;
};

export type CanvasRenderScope = {
  nodeIds: Set<string>;
  subgraphIds: Set<string>;
  edgeIds: Set<string>;
  worldBounds?: Rect;
};

export type CanvasRenderScopeInlineEdit =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | null;

export type ResolveCanvasRenderScopeInput = {
  graph: MermaidGraph;
  viewport: ViewportState;
  canvasSize: { width: number; height: number };
  viewFilters: ViewFilters;
  nodeBounds: CanvasRenderEntityBounds[];
  subgraphBounds: CanvasRenderEntityBounds[];
  edges?: CanvasEdge[];
  selection: Selection;
  hoveredNodeId?: string | null;
  hoveredSubgraphId?: string | null;
  hoveredEdgeId?: string | null;
  inlineEdit?: CanvasRenderScopeInlineEdit;
  interactionState?: InteractionState;
  connectionTargetNodeId?: string | null;
  connectionInvalidNodeId?: string | null;
  connectionTargetSubgraphId?: string | null;
  connectionInvalidSubgraphId?: string | null;
  overscanPx?: number;
};

export const DEFAULT_CANVAS_RENDER_SCOPE_OVERSCAN_PX = 1200;

export function resolveCanvasRenderScope(input: ResolveCanvasRenderScopeInput): CanvasRenderScope {
  const edges = input.edges || input.graph.edges;
  const worldBounds = viewportRenderBounds(input.viewport, input.canvasSize, input.overscanPx ?? DEFAULT_CANVAS_RENDER_SCOPE_OVERSCAN_PX);
  const shouldCull = Boolean(worldBounds);
  const nodeIds = new Set<string>();
  const subgraphIds = new Set<string>();

  if (input.viewFilters.nodes) {
    for (const node of input.nodeBounds) {
      if (!shouldCull || rectIntersects(node.frame, worldBounds!)) nodeIds.add(node.id);
    }
  }

  if (input.viewFilters.subgraphs) {
    for (const subgraph of input.subgraphBounds) {
      if (!shouldCull || rectIntersects(subgraph.frame, worldBounds!)) subgraphIds.add(subgraph.id);
    }
  }

  const nodeBoundsById = new Map(input.nodeBounds.map((item) => [item.id, item]));
  const subgraphBoundsById = new Map(input.subgraphBounds.map((item) => [item.id, item]));
  addProtectedEntities(input, nodeIds, subgraphIds, nodeBoundsById, subgraphBoundsById);

  const edgeIds = new Set<string>();
  if (input.viewFilters.edges) {
    for (const edge of edges) {
      if (!isEdgeVisible(edge, input.graph, input.viewFilters)) continue;
      if (nodeIds.has(edge.from) || nodeIds.has(edge.to) || subgraphIds.has(edge.from) || subgraphIds.has(edge.to)) {
        edgeIds.add(edge.id);
      }
    }
  }

  addProtectedEdges(input, edgeIds, edges);

  return {
    nodeIds,
    subgraphIds,
    edgeIds,
    ...(worldBounds ? { worldBounds } : {})
  };
}

function addProtectedEntities(
  input: ResolveCanvasRenderScopeInput,
  nodeIds: Set<string>,
  subgraphIds: Set<string>,
  nodeBoundsById: Map<string, CanvasRenderEntityBounds>,
  subgraphBoundsById: Map<string, CanvasRenderEntityBounds>
) {
  const entityIds = new Set<string>();
  for (const id of input.selection.nodeIds) entityIds.add(id);
  for (const id of input.selection.subgraphIds || []) entityIds.add(id);
  addIfPresent(entityIds, input.hoveredNodeId);
  addIfPresent(entityIds, input.hoveredSubgraphId);
  if (input.inlineEdit?.type === "node") entityIds.add(input.inlineEdit.id);

  const state = input.interactionState;
  if (state?.kind === "pendingNodePointer" || state?.kind === "draggingNodes") entityIds.add(state.nodeId);
  if (state?.kind === "pendingSubgraphPointer" || state?.kind === "draggingSubgraphs") entityIds.add(state.subgraphId);
  if (state?.kind === "connectingEdge") entityIds.add(state.fromId);

  addIfPresent(entityIds, input.connectionTargetNodeId);
  addIfPresent(entityIds, input.connectionInvalidNodeId);
  addIfPresent(entityIds, input.connectionTargetSubgraphId);
  addIfPresent(entityIds, input.connectionInvalidSubgraphId);

  if (input.viewFilters.nodes) {
    for (const id of entityIds) {
      if (nodeBoundsById.has(id)) nodeIds.add(id);
    }
  }

  if (input.viewFilters.subgraphs) {
    for (const id of entityIds) {
      if (subgraphBoundsById.has(id)) subgraphIds.add(id);
    }
  }
}

function addProtectedEdges(input: ResolveCanvasRenderScopeInput, edgeIds: Set<string>, edges: CanvasEdge[]) {
  if (!input.viewFilters.edges) return;

  const protectedEdgeIds = new Set<string>();
  for (const id of input.selection.edgeIds) protectedEdgeIds.add(id);
  addIfPresent(protectedEdgeIds, input.hoveredEdgeId);
  if (input.inlineEdit?.type === "edge") protectedEdgeIds.add(input.inlineEdit.id);
  if (input.interactionState?.kind === "retargetingEdge") protectedEdgeIds.add(input.interactionState.edgeId);

  const visibleEdgeIds = new Set(edges.filter((edge) => isEdgeVisible(edge, input.graph, input.viewFilters)).map((edge) => edge.id));
  for (const id of protectedEdgeIds) {
    if (visibleEdgeIds.has(id)) edgeIds.add(id);
  }
}

function viewportRenderBounds(viewport: ViewportState, canvasSize: { width: number; height: number }, overscanPx: number): Rect | null {
  if (canvasSize.width <= 0 || canvasSize.height <= 0 || viewport.scale <= 0) return null;

  return {
    x: (-overscanPx - viewport.x) / viewport.scale,
    y: (-overscanPx - viewport.y) / viewport.scale,
    width: (canvasSize.width + overscanPx * 2) / viewport.scale,
    height: (canvasSize.height + overscanPx * 2) / viewport.scale
  };
}

function rectIntersects(rect: Rect, bounds: Rect) {
  return rect.x < bounds.x + bounds.width && rect.x + rect.width > bounds.x && rect.y < bounds.y + bounds.height && rect.y + rect.height > bounds.y;
}

function addIfPresent(values: Set<string>, value: string | null | undefined) {
  if (value) values.add(value);
}
