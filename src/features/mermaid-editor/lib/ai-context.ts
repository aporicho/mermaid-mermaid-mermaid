import type {
  CanvasEdge,
  CanvasNode,
  CanvasSubgraph,
  DiagramType,
  EdgeRouting,
  EditableKind,
  EditorMode,
  LayoutMode,
  MermaidGraph,
  ParseStatus,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { InteractionContext } from "@/features/mermaid-editor/lib/interaction/context";

export type AiWorkspaceView = "canvas" | "render" | "source" | "markdown";

export type AiContextEntityKind = "node" | "edge" | "subgraph";

export type AiCanvasSize = {
  width: number;
  height: number;
};

export type AiRecentAction = {
  id: string;
  at: string;
  type: string;
  target?: {
    kind: AiContextEntityKind | "document" | "canvas" | "source";
    id?: string;
  };
  summary?: string;
};

export type AiEditingContext =
  | {
      kind: "node";
      id: string;
      draftText: string;
    }
  | {
      kind: "edge";
      id: string;
      draftText: string;
    }
  | {
      kind: "subgraph";
      id: string;
      draftText: string;
    }
  | {
      kind: "source";
      draftText: string;
    };

export type AiNodeContext = {
  id: string;
  label: string;
  shape: string;
  asset?: CanvasNode["asset"];
  x: number;
  y: number;
  parentId?: string;
  incoming: number;
  outgoing: number;
  screenCenter?: { x: number; y: number };
  distanceToViewportCenter?: number;
};

export type AiEdgeContext = {
  id: string;
  from: string;
  to: string;
  label: string;
  style: CanvasEdge["style"];
  arrowType: NonNullable<CanvasEdge["arrowType"]>;
  markerStart: NonNullable<CanvasEdge["markerStart"]>;
  markerEnd: NonNullable<CanvasEdge["markerEnd"]>;
  minLength: number;
  mermaidId?: string;
  animation: NonNullable<CanvasEdge["animation"]>;
  curve?: CanvasEdge["curve"];
  classes: string[];
  styleText?: string;
  fromAnchor?: string;
  toAnchor?: string;
};

export type AiSubgraphContext = {
  id: string;
  title: string;
  nodeIds: string[];
  parentId?: string;
  direction?: CanvasSubgraph["direction"];
};

export type AiFocusContext = {
  kind: AiContextEntityKind;
  id: string;
  score: number;
  reasons: string[];
  label?: string;
};

export type AiEditorContext = {
  version: 1;
  updatedAt: string;
  ttlMs: number;
  stale: boolean;
  document: {
    fileName: string;
    dirty: boolean;
    diagramType: DiagramType;
    editableKind: EditableKind;
    parseStatus: ParseStatus;
    workspaceView: AiWorkspaceView;
    mode: EditorMode;
    edgeRouting: EdgeRouting;
    layoutMode: LayoutMode;
    sourceLength: number;
    nodeCount: number;
    edgeCount: number;
    subgraphCount: number;
  };
  selection: {
    nodeIds: string[];
    edgeIds: string[];
    subgraphIds: string[];
    primary?: AiFocusContext;
    nodes: AiNodeContext[];
    edges: AiEdgeContext[];
    subgraphs: AiSubgraphContext[];
  };
  editing?: AiEditingContext;
  viewport: {
    x: number;
    y: number;
    scale: number;
    canvasSize?: AiCanvasSize;
    worldCenter?: { x: number; y: number };
  };
  visible: {
    nodes: AiNodeContext[];
    edges: AiEdgeContext[];
    subgraphs: AiSubgraphContext[];
  };
  focusRank: AiFocusContext[];
  recentActions: AiRecentAction[];
  diagnostics: EditorDiagnostic[];
};

export type BuildAiEditorContextInput = {
  source: string;
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  fileName: string;
  dirty: boolean;
  diagramType: DiagramType;
  editableKind: EditableKind;
  mode: EditorMode;
  workspaceView: AiWorkspaceView;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  diagnostics: EditorDiagnostic[];
  canvasSize?: AiCanvasSize;
  editing?: AiEditingContext | null;
  recentActions?: AiRecentAction[];
  interactionContext?: InteractionContext;
  now?: Date;
  ttlMs?: number;
};

const DEFAULT_AI_CONTEXT_TTL_MS = 10_000;
const MAX_VISIBLE_ITEMS = 40;
const MAX_FOCUS_ITEMS = 12;
const MAX_RECENT_ACTIONS = 20;
const ESTIMATED_NODE_WIDTH = 180;
const ESTIMATED_NODE_HEIGHT = 76;

export function buildAiEditorContext(input: BuildAiEditorContextInput): AiEditorContext {
  const now = input.now || new Date();
  const ttlMs = finitePositiveNumber(input.ttlMs, DEFAULT_AI_CONTEXT_TTL_MS);
  const parentByNodeId = nodeParentMap(input.graph.subgraphs || []);
  const nodeById = new Map(input.graph.nodes.map((node) => [node.id, node]));
  const subgraphById = new Map((input.graph.subgraphs || []).map((subgraph) => [subgraph.id, subgraph]));
  const edgeById = new Map(input.graph.edges.map((edge) => [edge.id, edge]));
  const worldCenter = viewportWorldCenter(input.viewport, input.canvasSize);
  const nodeContexts = input.graph.nodes.map((node) => nodeContext(node, input.graph.edges, parentByNodeId, input.viewport, input.canvasSize));
  const nodeContextById = new Map(nodeContexts.map((node) => [node.id, node]));
  const edgeContexts = input.graph.edges.map(edgeContext);
  const edgeContextById = new Map(edgeContexts.map((edge) => [edge.id, edge]));
  const subgraphContexts = (input.graph.subgraphs || []).map(subgraphContext);
  const subgraphContextById = new Map(subgraphContexts.map((subgraph) => [subgraph.id, subgraph]));
  const visibleScope = input.interactionContext?.visibleScope;
  const visibleNodeIds = visibleScope?.nodeIds || visibleNodes(input.graph.nodes, input.viewport, input.canvasSize);
  const visibleNodesById = new Set(visibleNodeIds);
  const visibleEdgeIds =
    visibleScope?.edgeIds ||
    input.graph.edges.filter((edge) => visibleNodesById.has(edge.from) || visibleNodesById.has(edge.to)).map((edge) => edge.id);
  const visibleSubgraphIds =
    visibleScope?.subgraphIds ||
    (input.graph.subgraphs || [])
      .filter((subgraph) => subgraph.nodeIds.some((nodeId) => visibleNodesById.has(nodeId)))
      .map((subgraph) => subgraph.id);
  const selection = normalizeSelection(input.selection);
  const focusRank = rankFocus({
    graph: input.graph,
    selection,
    editing: input.editing || undefined,
    visibleNodeIds,
    visibleEdgeIds,
    visibleSubgraphIds,
    recentActions: input.recentActions || [],
    nodeContexts,
    edgeContexts,
    subgraphContexts,
    worldCenter
  });

  return {
    version: 1,
    updatedAt: now.toISOString(),
    ttlMs,
    stale: false,
    document: {
      fileName: input.fileName,
      dirty: input.dirty,
      diagramType: input.diagramType,
      editableKind: input.editableKind,
      parseStatus: input.graph.parseStatus || (input.editableKind === "flowchart" ? "parsed" : "render-only"),
      workspaceView: input.workspaceView,
      mode: input.mode,
      edgeRouting: input.edgeRouting,
      layoutMode: input.layoutMode,
      sourceLength: input.source.length,
      nodeCount: input.graph.nodes.length,
      edgeCount: input.graph.edges.length,
      subgraphCount: input.graph.subgraphs?.length || 0
    },
    selection: {
      nodeIds: selection.nodeIds,
      edgeIds: selection.edgeIds,
      subgraphIds: selection.subgraphIds,
      primary: focusRank.find((item) => item.id === selection.primaryId),
      nodes: selection.nodeIds.flatMap((id) => maybe(nodeContextById.get(id))),
      edges: selection.edgeIds.flatMap((id) => maybe(edgeContextById.get(id))),
      subgraphs: selection.subgraphIds.flatMap((id) => maybe(subgraphContextById.get(id)))
    },
    ...(input.editing ? { editing: input.editing } : {}),
    viewport: {
      x: input.viewport.x,
      y: input.viewport.y,
      scale: input.viewport.scale,
      ...(input.canvasSize ? { canvasSize: input.canvasSize, worldCenter } : {})
    },
    visible: {
      nodes: visibleNodeIds.flatMap((id) => maybe(nodeContextById.get(id))).slice(0, MAX_VISIBLE_ITEMS),
      edges: visibleEdgeIds.flatMap((id) => maybe(edgeContextById.get(id))).slice(0, MAX_VISIBLE_ITEMS),
      subgraphs: visibleSubgraphIds.flatMap((id) => maybe(subgraphContextById.get(id))).slice(0, MAX_VISIBLE_ITEMS)
    },
    focusRank,
    recentActions: (input.recentActions || []).slice(0, MAX_RECENT_ACTIONS),
    diagnostics: input.diagnostics
  };

  function maybe<T>(value: T | undefined): T[] {
    return value ? [value] : [];
  }

  void nodeById;
  void subgraphById;
  void edgeById;
}

export function markAiEditorContextStale(context: AiEditorContext, now = new Date()): AiEditorContext {
  const updatedAtMs = Date.parse(context.updatedAt);
  const stale = !Number.isFinite(updatedAtMs) || now.getTime() - updatedAtMs > context.ttlMs;
  return stale === context.stale ? context : { ...context, stale };
}

export function aiContextSchemaExample(): AiEditorContext {
  const graph: MermaidGraph = {
    diagramType: "flowchart",
    editableKind: "flowchart",
    parseStatus: "parsed",
    direction: "LR",
    nodes: [
      { id: "User", label: "用户", x: 120, y: 120, fill: "#fbf6ef", shape: "rect" },
      { id: "AI", label: "AI", x: 360, y: 120, fill: "#fbf6ef", shape: "circle" }
    ],
    edges: [{ id: "User_AI", from: "User", to: "AI", label: "反馈", style: "solid", arrowType: "arrow" }],
    subgraphs: []
  };

  return buildAiEditorContext({
    source: "flowchart LR\n  User[用户] -->|反馈| AI((AI))\n",
    graph,
    selection: { nodeIds: ["User"], edgeIds: [], subgraphIds: [], primaryId: "User" },
    viewport: { x: 0, y: 0, scale: 1 },
    canvasSize: { width: 800, height: 520 },
    fileName: "diagram.mmd",
    dirty: true,
    diagramType: "flowchart",
    editableKind: "flowchart",
    mode: "select",
    workspaceView: "canvas",
    edgeRouting: "mermaid",
    layoutMode: "manual",
    diagnostics: [],
    recentActions: [
      {
        id: "example-action",
        at: "2026-06-17T00:00:00.000Z",
        type: "selection.change",
        target: { kind: "node", id: "User" },
        summary: "选中了用户节点"
      }
    ],
    now: new Date("2026-06-17T00:00:00.000Z")
  });
}

function normalizeSelection(selection: Selection): Required<Selection> {
  return {
    nodeIds: selection.nodeIds || [],
    edgeIds: selection.edgeIds || [],
    subgraphIds: selection.subgraphIds || [],
    primaryId: selection.primaryId || selection.nodeIds[0] || selection.edgeIds[0] || selection.subgraphIds?.[0] || ""
  };
}

function rankFocus(input: {
  graph: MermaidGraph;
  selection: Required<Selection>;
  editing?: AiEditingContext;
  visibleNodeIds: string[];
  visibleEdgeIds: string[];
  visibleSubgraphIds: string[];
  recentActions: AiRecentAction[];
  nodeContexts: AiNodeContext[];
  edgeContexts: AiEdgeContext[];
  subgraphContexts: AiSubgraphContext[];
  worldCenter?: { x: number; y: number };
}) {
  const focus = new Map<string, AiFocusContext>();
  const labels = new Map<string, string>();

  for (const node of input.nodeContexts) labels.set(focusKey("node", node.id), node.label);
  for (const edge of input.edgeContexts) labels.set(focusKey("edge", edge.id), edge.label);
  for (const subgraph of input.subgraphContexts) labels.set(focusKey("subgraph", subgraph.id), subgraph.title);

  function add(kind: AiContextEntityKind, id: string | undefined, score: number, reason: string) {
    if (!id) return;
    const key = focusKey(kind, id);
    const current = focus.get(key);
    if (current) {
      current.score += score;
      if (!current.reasons.includes(reason)) current.reasons.push(reason);
      return;
    }
    focus.set(key, { kind, id, score, reasons: [reason], label: labels.get(key) });
  }

  if (input.editing?.kind === "node") add("node", input.editing.id, 120, "editing");
  if (input.editing?.kind === "edge") add("edge", input.editing.id, 120, "editing");
  if (input.editing?.kind === "subgraph") add("subgraph", input.editing.id, 120, "editing");
  addKindList("node", input.selection.nodeIds, 90, "selected");
  addKindList("edge", input.selection.edgeIds, 90, "selected");
  addKindList("subgraph", input.selection.subgraphIds, 90, "selected");
  add("node", input.selection.primaryId, 20, "primary-selection");
  add("edge", input.selection.primaryId, 20, "primary-selection");
  add("subgraph", input.selection.primaryId, 20, "primary-selection");
  addKindList("node", input.visibleNodeIds, 8, "visible");
  addKindList("edge", input.visibleEdgeIds, 6, "visible");
  addKindList("subgraph", input.visibleSubgraphIds, 6, "visible");

  for (const node of input.nodeContexts) {
    if (typeof node.distanceToViewportCenter !== "number") continue;
    const centerScore = Math.max(0, 40 - Math.round(node.distanceToViewportCenter / 20));
    if (centerScore > 0) add("node", node.id, centerScore, "near-viewport-center");
  }

  for (const action of input.recentActions.slice(0, 8)) {
    const target = action.target;
    if (!target || target.kind === "document" || target.kind === "canvas" || target.kind === "source") continue;
    add(target.kind, target.id, 10, "recent-action");
  }

  for (const edgeId of input.selection.edgeIds) {
    const edge = input.graph.edges.find((item) => item.id === edgeId);
    if (!edge) continue;
    add("node", edge.from, 18, "selected-edge-source");
    add("node", edge.to, 18, "selected-edge-target");
  }

  return [...focus.values()]
    .filter((item) => entityExists(input.graph, item.kind, item.id))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, MAX_FOCUS_ITEMS);

  function addKindList(kind: AiContextEntityKind, ids: string[], score: number, reason: string) {
    for (const id of ids) add(kind, id, score, reason);
  }
}

function entityExists(graph: MermaidGraph, kind: AiContextEntityKind, id: string) {
  if (kind === "node") return graph.nodes.some((node) => node.id === id);
  if (kind === "edge") return graph.edges.some((edge) => edge.id === id);
  return (graph.subgraphs || []).some((subgraph) => subgraph.id === id);
}

function nodeContext(
  node: CanvasNode,
  edges: CanvasEdge[],
  parentByNodeId: Map<string, string>,
  viewport: ViewportState,
  canvasSize?: AiCanvasSize
): AiNodeContext {
  const screenCenter = canvasSize ? worldToScreen(node, viewport) : undefined;
  const viewportCenter = canvasSize ? { x: canvasSize.width / 2, y: canvasSize.height / 2 } : undefined;
  return {
    id: node.id,
    label: node.label,
    shape: node.shape || "rect",
    ...(node.asset ? { asset: node.asset } : {}),
    x: node.x,
    y: node.y,
    parentId: parentByNodeId.get(node.id),
    incoming: edges.filter((edge) => edge.to === node.id).length,
    outgoing: edges.filter((edge) => edge.from === node.id).length,
    ...(screenCenter ? { screenCenter } : {}),
    ...(screenCenter && viewportCenter ? { distanceToViewportCenter: distance(screenCenter, viewportCenter) } : {})
  };
}

function edgeContext(edge: CanvasEdge): AiEdgeContext {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    label: edge.label,
    style: edge.style,
    arrowType: edge.markerEnd || edge.arrowType || "arrow",
    markerStart: edge.markerStart || "none",
    markerEnd: edge.markerEnd || edge.arrowType || "arrow",
    minLength: edge.minLength || 1,
    ...(edge.mermaidId ? { mermaidId: edge.mermaidId } : {}),
    animation: edge.animation || "none",
    ...(edge.curve ? { curve: edge.curve } : {}),
    classes: edge.classes || [],
    ...(edge.styleText ? { styleText: edge.styleText } : {}),
    ...(edge.fromAnchor ? { fromAnchor: edge.fromAnchor } : {}),
    ...(edge.toAnchor ? { toAnchor: edge.toAnchor } : {})
  };
}

function subgraphContext(subgraph: CanvasSubgraph): AiSubgraphContext {
  return {
    id: subgraph.id,
    title: subgraph.title,
    nodeIds: subgraph.nodeIds,
    parentId: subgraph.parentId,
    direction: subgraph.direction
  };
}

function visibleNodes(nodes: CanvasNode[], viewport: ViewportState, canvasSize?: AiCanvasSize) {
  if (!canvasSize || canvasSize.width <= 0 || canvasSize.height <= 0) return nodes.map((node) => node.id).slice(0, MAX_VISIBLE_ITEMS);

  const left = -viewport.x / viewport.scale - ESTIMATED_NODE_WIDTH;
  const top = -viewport.y / viewport.scale - ESTIMATED_NODE_HEIGHT;
  const right = (canvasSize.width - viewport.x) / viewport.scale + ESTIMATED_NODE_WIDTH;
  const bottom = (canvasSize.height - viewport.y) / viewport.scale + ESTIMATED_NODE_HEIGHT;

  return nodes.filter((node) => node.x >= left && node.x <= right && node.y >= top && node.y <= bottom).map((node) => node.id);
}

function viewportWorldCenter(viewport: ViewportState, canvasSize?: AiCanvasSize) {
  if (!canvasSize || canvasSize.width <= 0 || canvasSize.height <= 0) return undefined;
  return {
    x: (canvasSize.width / 2 - viewport.x) / viewport.scale,
    y: (canvasSize.height / 2 - viewport.y) / viewport.scale
  };
}

function worldToScreen(point: { x: number; y: number }, viewport: ViewportState) {
  return {
    x: point.x * viewport.scale + viewport.x,
    y: point.y * viewport.scale + viewport.y
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y));
}

function nodeParentMap(subgraphs: CanvasSubgraph[]) {
  const result = new Map<string, string>();
  for (const subgraph of subgraphs) {
    for (const nodeId of subgraph.nodeIds) result.set(nodeId, subgraph.id);
  }
  return result;
}

function focusKey(kind: AiContextEntityKind, id: string) {
  return `${kind}:${id}`;
}

function finitePositiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
