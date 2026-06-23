import type { CanvasEdge, EdgeStyle, FlowchartArrowType, MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";

export type ViewFilters = {
  nodes: boolean;
  subgraphs: boolean;
  edges: boolean;
  nodeLabels: boolean;
  edgeLabels: boolean;
  grid: boolean;
  edgeStyles: Record<EdgeStyle, boolean>;
  arrowTypes: Record<FlowchartArrowType, boolean>;
};

export const EDGE_STYLE_FILTERS: EdgeStyle[] = ["solid", "thick", "dotted", "invisible"];
export const ARROW_TYPE_FILTERS: FlowchartArrowType[] = ["arrow", "none", "circle", "cross"];

export const DEFAULT_VIEW_FILTERS: ViewFilters = {
  nodes: true,
  subgraphs: true,
  edges: true,
  nodeLabels: true,
  edgeLabels: true,
  grid: true,
  edgeStyles: {
    solid: true,
    thick: true,
    dotted: true,
    invisible: true
  },
  arrowTypes: {
    arrow: true,
    none: true,
    circle: true,
    cross: true
  }
};

export function normalizeViewFilters(value: unknown, legacy?: { showGrid?: boolean; showEdges?: boolean }): ViewFilters {
  const input = isRecord(value) ? value : {};

  return {
    nodes: normalizeBoolean(input.nodes, true),
    subgraphs: normalizeBoolean(input.subgraphs, true),
    edges: normalizeBoolean(input.edges, legacy?.showEdges ?? true),
    nodeLabels: normalizeBoolean(input.nodeLabels, true),
    edgeLabels: normalizeBoolean(input.edgeLabels, true),
    grid: normalizeBoolean(input.grid, legacy?.showGrid ?? true),
    edgeStyles: normalizeFilterRecord(input.edgeStyles, EDGE_STYLE_FILTERS),
    arrowTypes: normalizeFilterRecord(input.arrowTypes, ARROW_TYPE_FILTERS)
  };
}

export function edgeStyleFilterKey(edge: CanvasEdge): EdgeStyle {
  return edge.style || "solid";
}

export function arrowTypeFilterKey(edge: CanvasEdge): FlowchartArrowType {
  return edge.markerEnd || edge.arrowType || "arrow";
}

export function isNodeVisible(filters: ViewFilters) {
  return filters.nodes;
}

export function isSubgraphVisible(filters: ViewFilters) {
  return filters.subgraphs;
}

export function isEdgeVisible(edge: CanvasEdge, graph: MermaidGraph, filters: ViewFilters) {
  if (!filters.edges) return false;
  if (!filters.edgeStyles[edgeStyleFilterKey(edge)]) return false;
  if (!filters.arrowTypes[arrowTypeFilterKey(edge)]) return false;

  const endpointVisibility = endpointVisible(edge.from, graph, filters) && endpointVisible(edge.to, graph, filters);
  return endpointVisibility;
}

export function selectionWithoutHidden(selection: Selection, graph: MermaidGraph, filters: ViewFilters): Selection {
  const visibleNodeIds = filters.nodes ? new Set(graph.nodes.map((node) => node.id)) : new Set<string>();
  const visibleSubgraphIds = filters.subgraphs ? new Set((graph.subgraphs || []).map((subgraph) => subgraph.id)) : new Set<string>();
  const visibleEdgeIds = new Set(graph.edges.filter((edge) => isEdgeVisible(edge, graph, filters)).map((edge) => edge.id));

  const nodeIds = selection.nodeIds.filter((id) => visibleNodeIds.has(id));
  const edgeIds = selection.edgeIds.filter((id) => visibleEdgeIds.has(id));
  const subgraphIds = (selection.subgraphIds || []).filter((id) => visibleSubgraphIds.has(id));
  const visiblePrimaryId = selection.primaryId && (nodeIds.includes(selection.primaryId) || edgeIds.includes(selection.primaryId) || subgraphIds.includes(selection.primaryId));

  return {
    nodeIds,
    edgeIds,
    subgraphIds,
    primaryId: visiblePrimaryId ? selection.primaryId : nodeIds[0] || edgeIds[0] || subgraphIds[0]
  };
}

export function hiddenFilterCount(filters: ViewFilters) {
  const primaryHidden = [filters.nodes, filters.subgraphs, filters.edges, filters.nodeLabels, filters.edgeLabels, filters.grid].filter((value) => !value).length;
  const edgeStylesHidden = EDGE_STYLE_FILTERS.filter((style) => !filters.edgeStyles[style]).length;
  const arrowTypesHidden = ARROW_TYPE_FILTERS.filter((arrowType) => !filters.arrowTypes[arrowType]).length;
  return primaryHidden + edgeStylesHidden + arrowTypesHidden;
}

function endpointVisible(id: string, graph: MermaidGraph, filters: ViewFilters) {
  if (graph.nodes.some((node) => node.id === id)) return filters.nodes;
  if ((graph.subgraphs || []).some((subgraph) => subgraph.id === id)) return filters.subgraphs;
  return true;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeFilterRecord<T extends string>(value: unknown, keys: T[]): Record<T, boolean> {
  const input = isRecord(value) ? value : {};
  return Object.fromEntries(keys.map((key) => [key, normalizeBoolean(input[key], true)])) as Record<T, boolean>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
