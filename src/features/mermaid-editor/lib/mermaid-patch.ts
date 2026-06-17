import type {
  CanvasEdge,
  CanvasNode,
  CanvasSubgraph,
  EdgeRouting,
  EdgeStyle,
  FlowchartArrowType,
  GraphDirection,
  LayoutMode,
  MermaidGraph,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import { normalizeMermaidError, type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { buildMermaidDocument, loadMermaidDocument, type MermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { isFlowchartNodeShape, normalizeFlowchartShape } from "@/features/mermaid-editor/lib/flowchart-shapes";
import { nextCanvasNodeId, serializeMermaid, toSafeNodeId } from "@/features/mermaid-editor/lib/mermaid-graph";

export type PatchOperation =
  | {
      type: "addNode";
      id?: string;
      label?: string;
      x?: number;
      y?: number;
      fill?: string;
      shape?: string;
      parentId?: string;
    }
  | {
      type: "updateNode";
      id: string;
      label?: string;
      x?: number;
      y?: number;
      fill?: string;
      shape?: string;
      parentId?: string | null;
    }
  | { type: "deleteNode"; id: string }
  | {
      type: "addEdge";
      id?: string;
      from: string;
      to: string;
      label?: string;
      style?: EdgeStyle;
      arrowType?: FlowchartArrowType;
    }
  | {
      type: "updateEdge";
      id: string;
      from?: string;
      to?: string;
      label?: string;
      style?: EdgeStyle;
      arrowType?: FlowchartArrowType;
    }
  | { type: "deleteEdge"; id: string }
  | {
      type: "createSubgraph";
      id: string;
      title?: string;
      nodeIds?: string[];
      parentId?: string;
      direction?: GraphDirection;
    }
  | {
      type: "updateSubgraph";
      id: string;
      title?: string;
      nodeIds?: string[];
      parentId?: string | null;
      direction?: GraphDirection | null;
    }
  | { type: "deleteSubgraph"; id: string }
  | {
      type: "setGraph";
      direction?: GraphDirection;
      edgeRouting?: EdgeRouting;
      layoutMode?: LayoutMode;
      viewport?: ViewportState;
    };

export type PatchInput = PatchOperation[] | { ops?: PatchOperation[] };

export type GraphSummary = {
  direction: GraphDirection;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  subgraphs: CanvasSubgraph[];
  preservedStatementsCount: number;
};

export type DiffResult = {
  hasChanges: boolean;
  semanticChanges: Record<string, DiffChange[]>;
  layoutChanges: Record<string, DiffChange[]>;
  metadataChanges: Record<string, DiffChange[]>;
};

export type MermaidPatchResult = {
  source: string;
  changed: boolean;
  written: boolean;
  diff: DiffResult;
  graph: GraphSummary;
};

export type MermaidPatchEnvelope = {
  ok: boolean;
  result?: MermaidPatchResult;
  diagnostics: EditorDiagnostic[];
};

type DiffChange = {
  type: "added" | "removed" | "updated";
  id: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

const DEFAULT_VIEWPORT: ViewportState = { x: 160, y: 90, scale: 1 };
const VALID_EDGE_STYLES = new Set<EdgeStyle>(["solid", "thick", "dotted"]);
const VALID_ARROW_TYPES = new Set<FlowchartArrowType>(["arrow", "none", "circle", "cross"]);
const VALID_DIRECTIONS = new Set<GraphDirection>(["TD", "TB", "BT", "RL", "LR"]);
const VALID_EDGE_ROUTINGS = new Set<EdgeRouting>(["straight", "bezier", "orthogonal", "mermaid"]);
const VALID_LAYOUT_MODES = new Set<LayoutMode>(["manual", "auto"]);
const MERMAID_ID_PATTERN = /^[A-Za-z][\w-]*$/;

export function applyMermaidPatch(source: string, input: PatchInput, options: { write?: boolean } = {}): MermaidPatchEnvelope {
  try {
    const document = loadMermaidDocument(source);
    const ops = normalizePatchInput(input);
    if (!ops) {
      return patchEnvelope(false, undefined, [patchDiagnostic("INVALID_PATCH_INPUT", "Patch 输入必须是操作数组，或包含 ops 数组的对象。")]);
    }

    if (document.editableKind !== "flowchart") {
      return patchEnvelope(false, undefined, [
        patchDiagnostic(
          "UNSUPPORTED_DIAGRAM_TYPE",
          `当前命令只支持 flowchart，可读取但不能结构化修改 ${document.diagramType} 图。`,
          "对非 flowchart 图先使用 read/validate，或在源码层手动修改。"
        )
      ]);
    }

    const result = applyPatchOperations(document, ops);
    if (result.diagnostics.length) return patchEnvelope(false, undefined, result.diagnostics);

    const nextSource = buildSourceFromDocument(document, result.graph, result.viewport, result.edgeRouting, result.layoutMode);
    const nextDocument = loadMermaidDocument(nextSource);

    return patchEnvelope(
      true,
      {
        source: nextSource,
        changed: nextSource !== normalizeDocumentText(source),
        written: Boolean(options.write),
        diff: diffDocuments(document, nextDocument),
        graph: graphSummary(nextDocument.graph)
      },
      []
    );
  } catch (error) {
    return patchEnvelope(false, undefined, [normalizeMermaidError(error, source, "serializer")]);
  }
}

export function graphSummary(graph: MermaidGraph): GraphSummary {
  return {
    direction: graph.direction,
    nodes: graph.nodes,
    edges: graph.edges,
    subgraphs: graph.subgraphs || [],
    preservedStatementsCount: graph.preservedStatements?.filter((statement) => statement.trim()).length || 0
  };
}

export function buildSourceFromDocument(document: MermaidDocument, graph: MermaidGraph, viewport: ViewportState, edgeRouting: EdgeRouting, layoutMode: LayoutMode) {
  return buildMermaidDocument(serializeMermaid(graph), graph, viewport || document.viewport || DEFAULT_VIEWPORT, edgeRouting, layoutMode);
}

export function diffDocuments(before: MermaidDocument, after: MermaidDocument): DiffResult {
  const semanticChanges = {
    nodes: diffById(before.graph.nodes, after.graph.nodes, semanticNode),
    edges: diffById(before.graph.edges, after.graph.edges, semanticEdge),
    subgraphs: diffById(before.graph.subgraphs || [], after.graph.subgraphs || [], semanticSubgraph),
    graph: diffRecord({ direction: before.graph.direction }, { direction: after.graph.direction }, "graph")
  };
  const layoutChanges = {
    nodes: diffById(before.graph.nodes, after.graph.nodes, layoutNode),
    canvas: diffRecord(
      { edgeRouting: before.edgeRouting, layoutMode: before.layoutMode, viewport: before.viewport },
      { edgeRouting: after.edgeRouting, layoutMode: after.layoutMode, viewport: after.viewport },
      "canvas"
    )
  };
  const metadataChanges = {
    document: diffRecord(
      { diagramType: before.diagramType, editableKind: before.editableKind, parseStatus: before.parseStatus },
      { diagramType: after.diagramType, editableKind: after.editableKind, parseStatus: after.parseStatus },
      "document"
    )
  };
  const hasChanges =
    Object.values(semanticChanges).some((changes) => changes.length) || Object.values(layoutChanges).some((changes) => changes.length) || metadataChanges.document.length > 0;

  return {
    hasChanges,
    semanticChanges,
    layoutChanges,
    metadataChanges
  };
}

export function patchDiagnostic(code: string, message: string, suggestion?: string): EditorDiagnostic {
  return {
    id: `patch:${code}:${hashText(message)}`,
    severity: "error",
    source: "serializer",
    code,
    message,
    suggestion
  };
}

function patchEnvelope(ok: boolean, result: MermaidPatchResult | undefined, diagnostics: EditorDiagnostic[]): MermaidPatchEnvelope {
  return {
    ok,
    ...(result === undefined ? {} : { result }),
    diagnostics
  };
}

function normalizePatchInput(input: PatchInput): PatchOperation[] | null {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray(input.ops)) return input.ops;
  return null;
}

function applyPatchOperations(document: MermaidDocument, ops: PatchOperation[]) {
  let graph = document.graph;
  let viewport = document.viewport || DEFAULT_VIEWPORT;
  let edgeRouting = document.edgeRouting;
  let layoutMode = document.layoutMode;
  const diagnostics: EditorDiagnostic[] = [];

  for (const [index, op] of ops.entries()) {
    const diagnostic = validateOperationShape(op, index);
    if (diagnostic) {
      diagnostics.push(diagnostic);
      continue;
    }

    const result = applyPatchOperation(graph, op, { viewport, edgeRouting, layoutMode });
    if (result.diagnostic) diagnostics.push(result.diagnostic);
    if (result.graph) graph = result.graph;
    if (result.viewport) viewport = result.viewport;
    if (result.edgeRouting) edgeRouting = result.edgeRouting;
    if (result.layoutMode) layoutMode = result.layoutMode;
  }

  return { graph, viewport, edgeRouting, layoutMode, diagnostics };
}

function validateOperationShape(op: PatchOperation, index: number) {
  if (!op || typeof op !== "object" || typeof op.type !== "string") {
    return patchDiagnostic("INVALID_PATCH_OPERATION", `第 ${index + 1} 个 patch 操作缺少 type。`);
  }
  return null;
}

function applyPatchOperation(
  graph: MermaidGraph,
  op: PatchOperation,
  state: { viewport: ViewportState; edgeRouting: EdgeRouting; layoutMode: LayoutMode }
): { graph?: MermaidGraph; viewport?: ViewportState; edgeRouting?: EdgeRouting; layoutMode?: LayoutMode; diagnostic?: EditorDiagnostic } {
  switch (op.type) {
    case "addNode":
      return addNodeOp(graph, op);
    case "updateNode":
      return updateNodeOp(graph, op);
    case "deleteNode":
      return deleteNodeOp(graph, op.id);
    case "addEdge":
      return addEdgeOp(graph, op);
    case "updateEdge":
      return updateEdgeOp(graph, op);
    case "deleteEdge":
      return requireEdge(graph, op.id) ? { graph: { ...graph, edges: graph.edges.filter((edge) => edge.id !== op.id) } } : missing("edge", op.id);
    case "createSubgraph":
      return createSubgraphOp(graph, op);
    case "updateSubgraph":
      return updateSubgraphOp(graph, op);
    case "deleteSubgraph":
      return deleteSubgraphOp(graph, op.id);
    case "setGraph":
      return setGraphOp(graph, op, state);
    default:
      return { diagnostic: patchDiagnostic("UNKNOWN_PATCH_OPERATION", `未知 patch 操作：${(op as { type?: string }).type || "unknown"}`) };
  }
}

function addNodeOp(graph: MermaidGraph, op: Extract<PatchOperation, { type: "addNode" }>) {
  const id = op.id || nextCanvasNodeId(graph.nodes);
  if (!isValidNewId(graph, id)) return { diagnostic: invalidId(id) };
  if (op.parentId && !requireSubgraph(graph, op.parentId)) return missing("subgraph", op.parentId);

  const shape = normalizeOptionalShape(op.shape);
  if (shape.diagnostic) return { diagnostic: shape.diagnostic };

  const node: CanvasNode = {
    id,
    label: op.label || id,
    x: finiteNumber(op.x, 120),
    y: finiteNumber(op.y, 120),
    fill: op.fill || "#fbf6ef",
    shape: shape.value || "rect"
  };

  return {
    graph: {
      ...graph,
      nodes: [...graph.nodes, node],
      subgraphs: assignParent(graph.subgraphs || [], id, op.parentId)
    }
  };
}

function updateNodeOp(graph: MermaidGraph, op: Extract<PatchOperation, { type: "updateNode" }>) {
  const node = requireNode(graph, op.id);
  if (!node) return missing("node", op.id);
  if (op.parentId && !requireSubgraph(graph, op.parentId)) return missing("subgraph", op.parentId);

  const shape = normalizeOptionalShape(op.shape);
  if (shape.diagnostic) return { diagnostic: shape.diagnostic };

  return {
    graph: {
      ...graph,
      nodes: graph.nodes.map((item) =>
        item.id === op.id
          ? {
              ...item,
              ...(op.label === undefined ? {} : { label: op.label }),
              ...(op.x === undefined ? {} : { x: finiteNumber(op.x, item.x) }),
              ...(op.y === undefined ? {} : { y: finiteNumber(op.y, item.y) }),
              ...(op.fill === undefined ? {} : { fill: op.fill }),
              ...(shape.value === undefined ? {} : { shape: shape.value })
            }
          : item
      ),
      subgraphs: op.parentId === undefined ? graph.subgraphs : assignParent(graph.subgraphs || [], op.id, op.parentId || undefined)
    }
  };
}

function deleteNodeOp(graph: MermaidGraph, id: string) {
  if (!requireNode(graph, id)) return missing("node", id);

  return {
    graph: {
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== id),
      edges: graph.edges.filter((edge) => edge.from !== id && edge.to !== id),
      subgraphs: (graph.subgraphs || []).map((subgraph) => ({
        ...subgraph,
        nodeIds: subgraph.nodeIds.filter((nodeId) => nodeId !== id)
      }))
    }
  };
}

function addEdgeOp(graph: MermaidGraph, op: Extract<PatchOperation, { type: "addEdge" }>) {
  if (!graphEndpointExists(graph, op.from)) return missing("endpoint", op.from);
  if (!graphEndpointExists(graph, op.to)) return missing("endpoint", op.to);
  const style = op.style || "solid";
  const arrowType = op.arrowType || "arrow";
  if (!VALID_EDGE_STYLES.has(style)) return invalidEnum("edge style", style);
  if (!VALID_ARROW_TYPES.has(arrowType)) return invalidEnum("arrow type", arrowType);

  const id = op.id && !graph.edges.some((edge) => edge.id === op.id) ? op.id : nextEdgeId(graph, op.from, op.to);
  return {
    graph: {
      ...graph,
      edges: [
        ...graph.edges,
        {
          id,
          from: op.from,
          to: op.to,
          label: op.label || "",
          style,
          arrowType
        }
      ]
    }
  };
}

function updateEdgeOp(graph: MermaidGraph, op: Extract<PatchOperation, { type: "updateEdge" }>) {
  const edge = requireEdge(graph, op.id);
  if (!edge) return missing("edge", op.id);
  if (op.from && !graphEndpointExists(graph, op.from)) return missing("endpoint", op.from);
  if (op.to && !graphEndpointExists(graph, op.to)) return missing("endpoint", op.to);
  if (op.style && !VALID_EDGE_STYLES.has(op.style)) return invalidEnum("edge style", op.style);
  if (op.arrowType && !VALID_ARROW_TYPES.has(op.arrowType)) return invalidEnum("arrow type", op.arrowType);

  return {
    graph: {
      ...graph,
      edges: graph.edges.map((item) =>
        item.id === op.id
          ? {
              ...item,
              ...(op.from === undefined ? {} : { from: op.from }),
              ...(op.to === undefined ? {} : { to: op.to }),
              ...(op.label === undefined ? {} : { label: op.label }),
              ...(op.style === undefined ? {} : { style: op.style }),
              ...(op.arrowType === undefined ? {} : { arrowType: op.arrowType })
            }
          : item
      )
    }
  };
}

function createSubgraphOp(graph: MermaidGraph, op: Extract<PatchOperation, { type: "createSubgraph" }>) {
  if (!isValidNewId(graph, op.id)) return { diagnostic: invalidId(op.id) };
  if (op.parentId && !requireSubgraph(graph, op.parentId)) return missing("subgraph", op.parentId);
  if (op.direction && !VALID_DIRECTIONS.has(op.direction)) return invalidEnum("direction", op.direction);
  const nodeIds = op.nodeIds || [];
  const missingNode = nodeIds.find((nodeId) => !requireNode(graph, nodeId));
  if (missingNode) return missing("node", missingNode);

  return {
    graph: {
      ...graph,
      subgraphs: [
        ...(graph.subgraphs || []).map((subgraph) => ({
          ...subgraph,
          nodeIds: subgraph.nodeIds.filter((nodeId) => !nodeIds.includes(nodeId))
        })),
        {
          id: op.id,
          title: op.title || op.id,
          nodeIds,
          parentId: op.parentId,
          direction: op.direction
        }
      ]
    }
  };
}

function updateSubgraphOp(graph: MermaidGraph, op: Extract<PatchOperation, { type: "updateSubgraph" }>) {
  const subgraph = requireSubgraph(graph, op.id);
  if (!subgraph) return missing("subgraph", op.id);
  if (op.parentId && !requireSubgraph(graph, op.parentId)) return missing("subgraph", op.parentId);
  if (op.parentId === op.id) return { diagnostic: patchDiagnostic("INVALID_SUBGRAPH_PARENT", "分组不能把自己设为父级。") };
  if (op.direction && !VALID_DIRECTIONS.has(op.direction)) return invalidEnum("direction", op.direction);
  const nodeIds = op.nodeIds || subgraph.nodeIds;
  const missingNode = nodeIds.find((nodeId) => !requireNode(graph, nodeId));
  if (missingNode) return missing("node", missingNode);

  return {
    graph: {
      ...graph,
      subgraphs: (graph.subgraphs || []).map((item) => {
        if (item.id !== op.id) {
          return op.nodeIds ? { ...item, nodeIds: item.nodeIds.filter((nodeId) => !op.nodeIds?.includes(nodeId)) } : item;
        }
        return {
          ...item,
          ...(op.title === undefined ? {} : { title: op.title }),
          ...(op.nodeIds === undefined ? {} : { nodeIds }),
          ...(op.parentId === undefined ? {} : { parentId: op.parentId || undefined }),
          ...(op.direction === undefined ? {} : { direction: op.direction || undefined })
        };
      })
    }
  };
}

function deleteSubgraphOp(graph: MermaidGraph, id: string) {
  const removed = requireSubgraph(graph, id);
  if (!removed) return missing("subgraph", id);

  return {
    graph: {
      ...graph,
      edges: graph.edges.filter((edge) => edge.from !== id && edge.to !== id),
      subgraphs: (graph.subgraphs || [])
        .filter((subgraph) => subgraph.id !== id)
        .map((subgraph) => {
          if (subgraph.parentId === id) return { ...subgraph, parentId: removed.parentId };
          if (subgraph.id === removed.parentId) {
            return { ...subgraph, nodeIds: [...subgraph.nodeIds, ...removed.nodeIds.filter((nodeId) => !subgraph.nodeIds.includes(nodeId))] };
          }
          return subgraph;
        })
    }
  };
}

function setGraphOp(
  graph: MermaidGraph,
  op: Extract<PatchOperation, { type: "setGraph" }>,
  state: { viewport: ViewportState; edgeRouting: EdgeRouting; layoutMode: LayoutMode }
) {
  if (op.direction && !VALID_DIRECTIONS.has(op.direction)) return invalidEnum("direction", op.direction);
  if (op.edgeRouting && !VALID_EDGE_ROUTINGS.has(op.edgeRouting)) return invalidEnum("edge routing", op.edgeRouting);
  if (op.layoutMode && !VALID_LAYOUT_MODES.has(op.layoutMode)) return invalidEnum("layout mode", op.layoutMode);

  return {
    graph: {
      ...graph,
      ...(op.direction === undefined ? {} : { direction: op.direction })
    },
    viewport: op.viewport ? normalizeViewport(op.viewport, state.viewport) : undefined,
    edgeRouting: op.edgeRouting,
    layoutMode: op.layoutMode
  };
}

function normalizeOptionalShape(value: string | undefined): { value?: CanvasNode["shape"]; diagnostic?: EditorDiagnostic } {
  if (value === undefined) return {};
  const shape = normalizeFlowchartShape(value);
  if (!shape || !isFlowchartNodeShape(shape)) return invalidEnum("node shape", value);
  return { value: shape };
}

function assignParent(subgraphs: CanvasSubgraph[], nodeId: string, parentId: string | undefined) {
  return subgraphs.map((subgraph) => {
    const nodeIds = subgraph.nodeIds.filter((id) => id !== nodeId);
    if (parentId && subgraph.id === parentId) return { ...subgraph, nodeIds: [...nodeIds, nodeId] };
    return { ...subgraph, nodeIds };
  });
}

function diffById<T extends { id: string }>(before: T[], after: T[], pick: (item: T) => Record<string, unknown>): DiffChange[] {
  const beforeMap = new Map(before.map((item) => [item.id, item]));
  const afterMap = new Map(after.map((item) => [item.id, item]));
  const ids = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();
  return ids.flatMap<DiffChange>((id) => {
    const beforeItem = beforeMap.get(id);
    const afterItem = afterMap.get(id);
    if (!beforeItem && afterItem) return [{ type: "added", id, after: pick(afterItem) }];
    if (beforeItem && !afterItem) return [{ type: "removed", id, before: pick(beforeItem) }];
    if (!beforeItem || !afterItem) return [];
    const beforeValue = pick(beforeItem);
    const afterValue = pick(afterItem);
    return stableStringify(beforeValue) === stableStringify(afterValue) ? [] : [{ type: "updated", id, before: beforeValue, after: afterValue }];
  });
}

function diffRecord(before: Record<string, unknown>, after: Record<string, unknown>, id: string): DiffChange[] {
  return stableStringify(before) === stableStringify(after) ? [] : [{ type: "updated", id, before, after }];
}

function semanticNode(node: CanvasNode) {
  return { id: node.id, label: node.label, shape: node.shape || "rect" };
}

function layoutNode(node: CanvasNode) {
  return { id: node.id, x: node.x, y: node.y, fill: node.fill };
}

function semanticEdge(edge: CanvasEdge) {
  return { id: edge.id, from: edge.from, to: edge.to, label: edge.label, style: edge.style, arrowType: edge.arrowType || "arrow" };
}

function semanticSubgraph(subgraph: CanvasSubgraph) {
  return {
    id: subgraph.id,
    title: subgraph.title,
    nodeIds: subgraph.nodeIds,
    parentId: subgraph.parentId,
    direction: subgraph.direction
  };
}

function stableStringify(value: unknown) {
  return JSON.stringify(value, Object.keys(flattenKeys(value)).sort());
}

function flattenKeys(value: unknown, result: Record<string, true> = {}) {
  if (!value || typeof value !== "object") return result;
  for (const [key, child] of Object.entries(value)) {
    result[key] = true;
    flattenKeys(child, result);
  }
  return result;
}

function normalizeDocumentText(value: string) {
  return `${value.trim()}\n`;
}

function normalizeViewport(value: ViewportState, fallback: ViewportState): ViewportState {
  return {
    x: finiteNumber(value.x, fallback.x),
    y: finiteNumber(value.y, fallback.y),
    scale: finiteNumber(value.scale, fallback.scale)
  };
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nextEdgeId(graph: MermaidGraph, from: string, to: string) {
  return toSafeNodeId(`${from}_${to}`, graph.edges.map((edge) => edge.id), "Edge");
}

function graphEndpointExists(graph: MermaidGraph, id: string) {
  return Boolean(requireNode(graph, id) || requireSubgraph(graph, id));
}

function requireNode(graph: MermaidGraph, id: string) {
  return graph.nodes.find((node) => node.id === id);
}

function requireEdge(graph: MermaidGraph, id: string) {
  return graph.edges.find((edge) => edge.id === id);
}

function requireSubgraph(graph: MermaidGraph, id: string) {
  return (graph.subgraphs || []).find((subgraph) => subgraph.id === id);
}

function isValidNewId(graph: MermaidGraph, id: string) {
  return MERMAID_ID_PATTERN.test(id) && !graphEndpointExists(graph, id);
}

function missing(kind: string, id: string) {
  return { diagnostic: patchDiagnostic("MISSING_TARGET", `找不到 ${kind}：${id}`) };
}

function invalidId(id: string) {
  return patchDiagnostic("INVALID_ID", `无效或重复的 Mermaid ID：${id}`, "ID 必须以字母开头，并且只能包含字母、数字、下划线或连字符。");
}

function invalidEnum(kind: string, value: string) {
  return { diagnostic: patchDiagnostic("INVALID_ENUM_VALUE", `不支持的 ${kind}：${value}`) };
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
