import type {
  CanvasEdge,
  CanvasNode,
  CanvasSubgraph,
  EdgeRouting,
  LayoutMode,
  MermaidGraph,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import { buildMermaidDocument, type MermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import {
  DEFAULT_VIEWPORT,
  type DiffChange,
  type DiffResult,
  type GraphSummary
} from "@/features/mermaid-editor/lib/mermaid-patch/types";

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

export function normalizeDocumentText(value: string) {
  return `${value.trim()}\n`;
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
  return { id: node.id, label: node.label, shape: node.shape || "rect", asset: node.asset };
}

function layoutNode(node: CanvasNode) {
  return { id: node.id, x: node.x, y: node.y, fill: node.fill };
}

function semanticEdge(edge: CanvasEdge) {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    label: edge.label,
    style: edge.style,
    markerStart: edge.markerStart || "none",
    markerEnd: edge.markerEnd || edge.arrowType || "arrow",
    arrowType: edge.markerEnd || edge.arrowType || "arrow",
    minLength: edge.minLength || 1,
    mermaidId: edge.mermaidId,
    animation: edge.animation || "none",
    curve: edge.curve,
    classes: edge.classes || [],
    styleText: edge.styleText
  };
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
