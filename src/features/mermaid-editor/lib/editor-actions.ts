import type { CanvasEdge, CanvasNode, ClipboardPayload, EditorMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { createNode, toSafeNodeId } from "@/features/mermaid-editor/lib/mermaid-graph";

export const emptySelection: Selection = { nodeIds: [], edgeIds: [] };

export function hasSelection(selection: Selection) {
  return selection.nodeIds.length > 0 || selection.edgeIds.length > 0;
}

export function selectOnlyNode(id: string): Selection {
  return { nodeIds: [id], edgeIds: [], primaryId: id };
}

export function selectOnlyEdge(id: string): Selection {
  return { nodeIds: [], edgeIds: [id], primaryId: id };
}

export function toggleNodeSelection(selection: Selection, id: string): Selection {
  const hasNode = selection.nodeIds.includes(id);
  const nodeIds = hasNode ? selection.nodeIds.filter((nodeId) => nodeId !== id) : [...selection.nodeIds, id];
  return { nodeIds, edgeIds: [], primaryId: hasNode ? nodeIds.at(-1) : id };
}

export function toggleEdgeSelection(selection: Selection, id: string): Selection {
  const hasEdge = selection.edgeIds.includes(id);
  const edgeIds = hasEdge ? selection.edgeIds.filter((edgeId) => edgeId !== id) : [...selection.edgeIds, id];
  return { nodeIds: [], edgeIds, primaryId: hasEdge ? edgeIds.at(-1) : id };
}

export function addNode(graph: MermaidGraph, viewport: ViewportState): { graph: MermaidGraph; selection: Selection } {
  const centerX = (420 - viewport.x) / viewport.scale;
  const centerY = (260 - viewport.y) / viewport.scale;

  return addNodeAt(graph, centerX, centerY);
}

export function addNodeAt(graph: MermaidGraph, x: number, y: number): { graph: MermaidGraph; selection: Selection } {
  const node = createNode(graph.nodes, x, y);

  return {
    graph: { ...graph, nodes: [...graph.nodes, node] },
    selection: selectOnlyNode(node.id)
  };
}

export function updateNodeLabel(graph: MermaidGraph, id: string, label: string): MermaidGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (node.id === id ? { ...node, label } : node))
  };
}

export function updateNodeFill(graph: MermaidGraph, ids: string[], fill: string): MermaidGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (ids.includes(node.id) ? { ...node, fill } : node))
  };
}

export function renameNode(graph: MermaidGraph, oldId: string, value: string): { graph: MermaidGraph; selection: Selection } {
  const nextId = toSafeNodeId(
    value,
    graph.nodes.filter((node) => node.id !== oldId).map((node) => node.id),
    oldId
  );

  return {
    graph: {
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === oldId ? { ...node, id: nextId } : node)),
      edges: graph.edges.map((edge) => ({
        ...edge,
        from: edge.from === oldId ? nextId : edge.from,
        to: edge.to === oldId ? nextId : edge.to
      }))
    },
    selection: selectOnlyNode(nextId)
  };
}

export function moveNodes(graph: MermaidGraph, nodeIds: string[], deltaX: number, deltaY: number): MermaidGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (nodeIds.includes(node.id) ? { ...node, x: node.x + deltaX, y: node.y + deltaY } : node))
  };
}

export function setNodePositions(graph: MermaidGraph, positions: Record<string, { x: number; y: number }>): MermaidGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (positions[node.id] ? { ...node, ...positions[node.id] } : node))
  };
}

export function createEdge(graph: MermaidGraph, from: string, to: string, label = ""): { graph: MermaidGraph; selection: Selection } {
  const edge: CanvasEdge = {
    id: `${from}_${to}_${Date.now()}`,
    from,
    to,
    label,
    style: "solid",
    path: "straight"
  };

  return {
    graph: { ...graph, edges: [...graph.edges, edge] },
    selection: selectOnlyEdge(edge.id)
  };
}

export function updateEdge(graph: MermaidGraph, id: string, patch: Partial<CanvasEdge>): MermaidGraph {
  return {
    ...graph,
    edges: graph.edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge))
  };
}

export function deleteSelection(graph: MermaidGraph, selection: Selection): MermaidGraph {
  const nodeIds = new Set(selection.nodeIds);
  const edgeIds = new Set(selection.edgeIds);

  return {
    ...graph,
    nodes: graph.nodes.filter((node) => !nodeIds.has(node.id)),
    edges: graph.edges.filter((edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.from) && !nodeIds.has(edge.to))
  };
}

export function copySelection(graph: MermaidGraph, selection: Selection): ClipboardPayload {
  const nodeIds = new Set(selection.nodeIds);

  return {
    nodes: graph.nodes.filter((node) => nodeIds.has(node.id)),
    edges: graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
  };
}

export function pasteClipboard(graph: MermaidGraph, payload: ClipboardPayload): { graph: MermaidGraph; selection: Selection } {
  const existingIds = graph.nodes.map((node) => node.id);
  const idMap = new Map<string, string>();
  const pastedNodes: CanvasNode[] = payload.nodes.map((node) => {
    const nextId = toSafeNodeId(`${node.id}_copy`, [...existingIds, ...idMap.values()]);
    idMap.set(node.id, nextId);
    return { ...node, id: nextId, x: node.x + 32, y: node.y + 32 };
  });
  const pastedEdges = payload.edges
    .filter((edge) => idMap.has(edge.from) && idMap.has(edge.to))
    .map((edge, index) => ({
      ...edge,
      id: `${idMap.get(edge.from)}_${idMap.get(edge.to)}_${Date.now()}_${index}`,
      from: idMap.get(edge.from)!,
      to: idMap.get(edge.to)!
    }));

  return {
    graph: {
      ...graph,
      nodes: [...graph.nodes, ...pastedNodes],
      edges: [...graph.edges, ...pastedEdges]
    },
    selection: { nodeIds: pastedNodes.map((node) => node.id), edgeIds: [], primaryId: pastedNodes[0]?.id }
  };
}

export function setMode(mode: EditorMode) {
  return mode;
}

export function setViewport(viewport: ViewportState) {
  return viewport;
}
