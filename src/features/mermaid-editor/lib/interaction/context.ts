import type { HitTarget } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasInteractionKind } from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import type {
  DiagramType,
  EditableKind,
  EdgeRouting,
  EditorMode,
  LayoutMode,
  MermaidGraph,
  ParseStatus,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_VIEW_FILTERS, isEdgeVisible, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { emptyInteractionModifiers, normalizeModifiers, type InteractionModifiers } from "@/features/mermaid-editor/lib/interaction/input";

export type InteractionWorkspaceView = "canvas" | "render" | "source" | "markdown";

export type InteractionEditingContext =
  | { kind: "node"; id: string; draftText: string }
  | { kind: "edge"; id: string; draftText: string }
  | { kind: "source"; draftText: string };

export type InteractionVisibleScope = {
  nodeIds: string[];
  edgeIds: string[];
  subgraphIds: string[];
  grid: boolean;
  nodeLabels: boolean;
  edgeLabels: boolean;
  worldBounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
};

export type InteractionCapabilities = {
  canEditGraph: boolean;
  canEditText: boolean;
  canUseSelection: boolean;
  canPanViewport: boolean;
  canZoomViewport: boolean;
};

export type InteractionContext = {
  version: 1;
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  viewFilters: ViewFilters;
  mode: EditorMode;
  workspaceView: InteractionWorkspaceView;
  diagramType: DiagramType;
  editableKind: EditableKind;
  parseStatus: ParseStatus;
  edgeRouting?: EdgeRouting;
  layoutMode?: LayoutMode;
  sourceLength?: number;
  dirty?: boolean;
  canvasSize?: { width: number; height: number };
  hitTarget: HitTarget;
  modifiers: InteractionModifiers;
  gestureState: CanvasInteractionKind;
  editing?: InteractionEditingContext;
  visibleScope: InteractionVisibleScope;
  capabilities: InteractionCapabilities;
};

export type BuildInteractionContextInput = {
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  viewFilters?: ViewFilters;
  mode?: EditorMode;
  workspaceView?: InteractionWorkspaceView;
  diagramType?: DiagramType;
  editableKind?: EditableKind;
  parseStatus?: ParseStatus;
  edgeRouting?: EdgeRouting;
  layoutMode?: LayoutMode;
  sourceLength?: number;
  dirty?: boolean;
  canvasSize?: { width: number; height: number };
  hitTarget?: HitTarget;
  modifiers?: Partial<InteractionModifiers>;
  gestureState?: CanvasInteractionKind;
  editing?: InteractionEditingContext | null;
};

const ESTIMATED_NODE_WIDTH = 180;
const ESTIMATED_NODE_HEIGHT = 76;

export function buildInteractionContext(input: BuildInteractionContextInput): InteractionContext {
  const viewFilters = input.viewFilters || DEFAULT_VIEW_FILTERS;
  const workspaceView = input.workspaceView || "canvas";
  const editableKind = input.editableKind || input.graph.editableKind || "flowchart";
  const diagramType = input.diagramType || input.graph.diagramType || "flowchart";
  const parseStatus = input.parseStatus || input.graph.parseStatus || (editableKind === "flowchart" ? "parsed" : "render-only");
  const canEditGraph = workspaceView === "canvas" && editableKind === "flowchart";
  const canEditText = canEditGraph || workspaceView === "source" || workspaceView === "markdown";

  return {
    version: 1,
    graph: input.graph,
    selection: normalizeSelection(input.selection),
    viewport: input.viewport,
    viewFilters,
    mode: input.mode || "select",
    workspaceView,
    diagramType,
    editableKind,
    parseStatus,
    edgeRouting: input.edgeRouting,
    layoutMode: input.layoutMode,
    sourceLength: input.sourceLength,
    dirty: input.dirty,
    canvasSize: input.canvasSize,
    hitTarget: input.hitTarget || { kind: "blank" },
    modifiers: input.modifiers ? normalizeModifiers(input.modifiers) : emptyInteractionModifiers,
    gestureState: input.gestureState || "idle",
    ...(input.editing ? { editing: input.editing } : {}),
    visibleScope: buildVisibleScope(input.graph, input.viewport, viewFilters, input.canvasSize),
    capabilities: {
      canEditGraph,
      canEditText,
      canUseSelection: workspaceView === "canvas",
      canPanViewport: true,
      canZoomViewport: true
    }
  };
}

export function buildVisibleScope(
  graph: MermaidGraph,
  viewport: ViewportState,
  filters: ViewFilters,
  canvasSize?: { width: number; height: number }
): InteractionVisibleScope {
  const worldBounds = canvasSize && canvasSize.width > 0 && canvasSize.height > 0 ? viewportWorldBounds(viewport, canvasSize) : undefined;
  const nodeIds = filters.nodes
    ? graph.nodes.filter((node) => !worldBounds || pointInBounds(node, worldBounds)).map((node) => node.id)
    : [];
  const viewportNodeIds = new Set(nodeIds);
  const subgraphIds = filters.subgraphs
    ? (graph.subgraphs || [])
        .filter((subgraph) => !worldBounds || subgraph.nodeIds.some((nodeId) => viewportNodeIds.has(nodeId)))
        .map((subgraph) => subgraph.id)
    : [];
  const viewportSubgraphIds = new Set(subgraphIds);
  const edgeIds = graph.edges
    .filter((edge) => isEdgeVisible(edge, graph, filters))
    .filter((edge) => !worldBounds || viewportNodeIds.has(edge.from) || viewportNodeIds.has(edge.to) || viewportSubgraphIds.has(edge.from) || viewportSubgraphIds.has(edge.to))
    .map((edge) => edge.id);

  return {
    nodeIds,
    edgeIds,
    subgraphIds,
    grid: filters.grid,
    nodeLabels: filters.nodes && filters.nodeLabels,
    edgeLabels: filters.edges && filters.edgeLabels,
    ...(worldBounds ? { worldBounds } : {})
  };
}

function normalizeSelection(selection: Selection): Selection {
  return {
    nodeIds: selection.nodeIds || [],
    edgeIds: selection.edgeIds || [],
    subgraphIds: selection.subgraphIds || [],
    primaryId: selection.primaryId
  };
}

function viewportWorldBounds(viewport: ViewportState, canvasSize: { width: number; height: number }) {
  return {
    left: -viewport.x / viewport.scale - ESTIMATED_NODE_WIDTH,
    top: -viewport.y / viewport.scale - ESTIMATED_NODE_HEIGHT,
    right: (canvasSize.width - viewport.x) / viewport.scale + ESTIMATED_NODE_WIDTH,
    bottom: (canvasSize.height - viewport.y) / viewport.scale + ESTIMATED_NODE_HEIGHT
  };
}

function pointInBounds(point: { x: number; y: number }, bounds: NonNullable<InteractionVisibleScope["worldBounds"]>) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}
