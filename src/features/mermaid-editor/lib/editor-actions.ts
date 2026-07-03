import type {
  CanvasEdge,
  CanvasEdgeBatchPatch,
  CanvasNode,
  CanvasNodeBatchPatch,
  CanvasSubgraph,
  CanvasSubgraphBatchPatch,
  ClipboardPayload,
  EditorMode,
  GraphDirection,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import { createImageAsset } from "@/features/mermaid-editor/lib/node-assets";
import { inferNodeActionFromPlainText } from "@/features/mermaid-editor/lib/node-actions";
import { normalizeCanvasNodePreview } from "@/features/mermaid-editor/lib/node-preview";
import { createNode, nextCanvasNodeId, toSafeNodeId } from "@/features/mermaid-editor/lib/mermaid-graph";

export const emptySelection: Selection = { nodeIds: [], edgeIds: [], subgraphIds: [] };

export function hasSelection(selection: Selection) {
  return selection.nodeIds.length > 0 || selection.edgeIds.length > 0 || (selection.subgraphIds?.length || 0) > 0;
}

export function selectOnlyNode(id: string): Selection {
  return { nodeIds: [id], edgeIds: [], subgraphIds: [], primaryId: id };
}

export function selectOnlyEdge(id: string): Selection {
  return { nodeIds: [], edgeIds: [id], subgraphIds: [], primaryId: id };
}

export function selectOnlySubgraph(id: string): Selection {
  return { nodeIds: [], edgeIds: [], subgraphIds: [id], primaryId: id };
}

export function toggleNodeSelection(selection: Selection, id: string): Selection {
  const hasNode = selection.nodeIds.includes(id);
  const nodeIds = hasNode ? selection.nodeIds.filter((nodeId) => nodeId !== id) : [...selection.nodeIds, id];
  return { nodeIds, edgeIds: [], subgraphIds: [], primaryId: hasNode ? nodeIds.at(-1) : id };
}

export function toggleEdgeSelection(selection: Selection, id: string): Selection {
  const hasEdge = selection.edgeIds.includes(id);
  const edgeIds = hasEdge ? selection.edgeIds.filter((edgeId) => edgeId !== id) : [...selection.edgeIds, id];
  return { nodeIds: [], edgeIds, subgraphIds: [], primaryId: hasEdge ? edgeIds.at(-1) : id };
}

export function toggleSubgraphSelection(selection: Selection, id: string): Selection {
  const current = selection.subgraphIds || [];
  const hasSubgraph = current.includes(id);
  const subgraphIds = hasSubgraph ? current.filter((subgraphId) => subgraphId !== id) : [...current, id];
  return { nodeIds: [], edgeIds: [], subgraphIds, primaryId: hasSubgraph ? subgraphIds.at(-1) : id };
}

export function addNode(graph: MermaidGraph, viewport: ViewportState): { graph: MermaidGraph; selection: Selection } {
  const centerX = (420 - viewport.x) / viewport.scale;
  const centerY = (260 - viewport.y) / viewport.scale;

  return addNodeAt(graph, centerX, centerY);
}

export type AddCanvasNodeOptions = {
  label?: string;
  action?: CanvasNodeAction;
  preview?: CanvasNode["preview"];
};

export type AddCanvasNodeItem = AddCanvasNodeOptions & {
  x: number;
  y: number;
};

export function addNodeAt(graph: MermaidGraph, x: number, y: number, options: AddCanvasNodeOptions = {}): { graph: MermaidGraph; selection: Selection } {
  const node = createNodeWithOptions(graph.nodes, x, y, options);

  return {
    graph: { ...graph, nodes: [...graph.nodes, node] },
    selection: selectOnlyNode(node.id)
  };
}

export function addNodesAt(graph: MermaidGraph, items: AddCanvasNodeItem[]): { graph: MermaidGraph; selection: Selection } {
  const nextNodes = [...graph.nodes];
  const addedIds: string[] = [];

  for (const item of items) {
    const node = createNodeWithOptions(nextNodes, item.x, item.y, item);
    nextNodes.push(node);
    addedIds.push(node.id);
  }

  return {
    graph: { ...graph, nodes: nextNodes },
    selection: {
      nodeIds: addedIds,
      edgeIds: [],
      subgraphIds: [],
      primaryId: addedIds[0]
    }
  };
}

export function updateNodeLabel(graph: MermaidGraph, id: string, label: string): MermaidGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (node.id === id ? applyNodeLabelPatch(node, label) : node))
  };
}

export function updateNodeFill(graph: MermaidGraph, ids: string[], fill: string): MermaidGraph {
  return updateNodes(graph, ids, { fill });
}

export function updateNodes(graph: MermaidGraph, ids: string[], patch: CanvasNodeBatchPatch): MermaidGraph {
  const idSet = new Set(ids);

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (!idSet.has(node.id)) return node;

      return {
        ...node,
        ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
        ...(patch.shape !== undefined ? { shape: patch.shape } : {}),
        ...(patch.asset && node.asset ? { asset: createImageAsset({ ...node.asset, ...patch.asset }) } : {})
      };
    })
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
      })),
      subgraphs: graph.subgraphs?.map((subgraph) => ({
        ...subgraph,
        nodeIds: subgraph.nodeIds.map((id) => (id === oldId ? nextId : id))
      }))
    },
    selection: selectOnlyNode(nextId)
  };
}

export function addImageNodeAt(graph: MermaidGraph, x: number, y: number, asset: NonNullable<CanvasNode["asset"]>, label?: string): { graph: MermaidGraph; selection: Selection } {
  const id = nextCanvasNodeId(graph.nodes);
  const node: CanvasNode = {
    id,
    label: label || imageLabelFromSrc(asset.src),
    x,
    y,
    fill: "#fbf6ef",
    shape: "rect",
    asset: createImageAsset(asset)
  };

  return {
    graph: { ...graph, nodes: [...graph.nodes, node] },
    selection: selectOnlyNode(id)
  };
}

function imageLabelFromSrc(src: string) {
  return src.split(/[\\/]/).filter(Boolean).at(-1)?.replace(/\.[^.]+$/, "") || "图片";
}

function createNodeWithOptions(existingNodes: CanvasNode[], x: number, y: number, options: AddCanvasNodeOptions): CanvasNode {
  const node = createNode(existingNodes, x, y);
  const label = options.label ?? node.label;
  const action = options.action || inferNodeActionFromPlainText(label);
  const preview = normalizeCanvasNodePreview(options.preview);
  return {
    ...node,
    label,
    ...(action ? { action } : {}),
    ...(preview ? { preview } : {})
  };
}

export function applyNodeLabelPatch(node: CanvasNode, label: string): CanvasNode {
  const nextNode = { ...node, label };
  if (node.action) return nextNode;

  const action = inferNodeActionFromPlainText(label);
  return action ? { ...nextNode, action } : nextNode;
}

export function renameSubgraph(graph: MermaidGraph, oldId: string, value: string): { graph: MermaidGraph; selection: Selection } {
  const existingIds = [...graph.nodes.map((node) => node.id), ...(graph.subgraphs || []).filter((subgraph) => subgraph.id !== oldId).map((subgraph) => subgraph.id)];
  const nextId = toSafeNodeId(value, existingIds, oldId);

  return {
    graph: {
      ...graph,
      subgraphs: (graph.subgraphs || []).map((subgraph) => ({
        ...subgraph,
        id: subgraph.id === oldId ? nextId : subgraph.id,
        parentId: subgraph.parentId === oldId ? nextId : subgraph.parentId
      })),
      edges: graph.edges.map((edge) => ({
        ...edge,
        from: edge.from === oldId ? nextId : edge.from,
        to: edge.to === oldId ? nextId : edge.to
      }))
    },
    selection: selectOnlySubgraph(nextId)
  };
}

export function updateSubgraph(graph: MermaidGraph, id: string, patch: Partial<Pick<CanvasSubgraph, "title" | "parentId" | "direction">>): MermaidGraph {
  return {
    ...graph,
    subgraphs: (graph.subgraphs || []).map((subgraph) => (subgraph.id === id ? { ...subgraph, ...patch } : subgraph))
  };
}

export function updateSubgraphs(graph: MermaidGraph, ids: string[], patch: CanvasSubgraphBatchPatch): MermaidGraph {
  const idSet = new Set(ids);
  const canApplyParent =
    !("parentId" in patch) ||
    !patch.parentId ||
    (!idSet.has(patch.parentId) && ids.every((id) => id !== patch.parentId && !descendantSubgraphIds(graph, id).includes(patch.parentId!)));

  return {
    ...graph,
    subgraphs: (graph.subgraphs || []).map((subgraph) => {
      if (!idSet.has(subgraph.id)) return subgraph;

      return {
        ...subgraph,
        ...("direction" in patch ? { direction: patch.direction } : {}),
        ...("parentId" in patch && canApplyParent ? { parentId: patch.parentId } : {})
      };
    })
  };
}

export function createSubgraphFromSelection(graph: MermaidGraph, selection: Selection): { graph: MermaidGraph; selection: Selection } {
  const selectedNodeIds = selection.nodeIds;
  const selectedSubgraphIds = selection.subgraphIds || [];
  if (!selectedNodeIds.length && !selectedSubgraphIds.length) return { graph, selection };

  const id = toSafeNodeId("Group", [...graph.nodes.map((node) => node.id), ...(graph.subgraphs || []).map((subgraph) => subgraph.id)], "Group");
  const selectedParents = [
    ...selectedNodeIds.map((nodeId) => parentSubgraphForNode(graph, nodeId)),
    ...selectedSubgraphIds.map((subgraphId) => (graph.subgraphs || []).find((subgraph) => subgraph.id === subgraphId)?.parentId)
  ];
  const parentId = selectedParents.every((item) => item === selectedParents[0]) ? selectedParents[0] : undefined;
  const subgraph: CanvasSubgraph = { id, title: "新分组", nodeIds: selectedNodeIds, parentId };

  return {
    graph: {
      ...graph,
      subgraphs: [
        ...(graph.subgraphs || []).map((item) => {
          if (selectedNodeIds.length) {
            return { ...item, nodeIds: item.nodeIds.filter((nodeId) => !selectedNodeIds.includes(nodeId)) };
          }
          if (selectedSubgraphIds.includes(item.id)) return { ...item, parentId: id };
          return item;
        }),
        subgraph
      ]
    },
    selection: selectOnlySubgraph(id)
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

export function createEdge(graph: MermaidGraph, from: string, to: string, label = "", anchors: Pick<CanvasEdge, "fromAnchor" | "toAnchor"> = {}): { graph: MermaidGraph; selection: Selection } {
  const edge: CanvasEdge = {
    id: `${from}_${to}_${Date.now()}`,
    from,
    to,
    label,
    style: "solid",
    markerStart: "none",
    markerEnd: "arrow",
    minLength: 1,
    arrowType: "arrow",
    ...(anchors.fromAnchor ? { fromAnchor: anchors.fromAnchor } : {}),
    ...(anchors.toAnchor ? { toAnchor: anchors.toAnchor } : {})
  };

  return {
    graph: { ...graph, edges: [...graph.edges, edge] },
    selection: selectOnlyEdge(edge.id)
  };
}

export function updateEdge(graph: MermaidGraph, id: string, patch: Partial<CanvasEdge>): MermaidGraph {
  const usedMermaidIds = new Set(graph.edges.map((edge) => edge.mermaidId).filter(Boolean) as string[]);

  return {
    ...graph,
    edges: graph.edges.map((edge) => {
      if (edge.id !== id) return edge;
      return {
        ...normalizeEdgeAfterPatch({
          ...edge,
          ...edgeMermaidIdPatch(edge, patch, usedMermaidIds),
          ...("from" in patch && patch.from !== edge.from && !("fromAnchor" in patch) ? { fromAnchor: undefined } : {}),
          ...("to" in patch && patch.to !== edge.to && !("toAnchor" in patch) ? { toAnchor: undefined } : {}),
          ...patch
        })
      };
    })
  };
}

export function updateEdges(graph: MermaidGraph, ids: string[], patch: CanvasEdgeBatchPatch): MermaidGraph {
  const idSet = new Set(ids);
  const usedMermaidIds = new Set(graph.edges.map((edge) => edge.mermaidId).filter(Boolean) as string[]);

  return {
    ...graph,
    edges: graph.edges.map((edge) => {
      if (!idSet.has(edge.id)) return edge;
      return normalizeEdgeAfterPatch({ ...edge, ...edgeMermaidIdPatch(edge, patch, usedMermaidIds), ...patch });
    })
  };
}

function edgeMermaidIdPatch(edge: CanvasEdge, patch: Partial<CanvasEdge>, usedMermaidIds: Set<string>) {
  if (edge.mermaidId || patch.mermaidId || !edgePatchNeedsMermaidId(patch)) return {};
  const mermaidId = nextEdgeMermaidId(usedMermaidIds);
  usedMermaidIds.add(mermaidId);
  return { mermaidId };
}

function edgePatchNeedsMermaidId(patch: Partial<CanvasEdge>) {
  return Boolean(("animation" in patch && patch.animation && patch.animation !== "none") || ("curve" in patch && patch.curve) || ("classes" in patch && patch.classes?.length));
}

function nextEdgeMermaidId(usedIds: Set<string>) {
  let index = 1;
  while (usedIds.has(`e${index}`)) index += 1;
  return `e${index}`;
}

function normalizeEdgeAfterPatch(edge: CanvasEdge): CanvasEdge {
  const style = edge.style || "solid";
  const markerStart = style === "invisible" ? "none" : edge.markerStart || "none";
  let markerEnd = style === "invisible" ? "none" : edge.markerEnd || edge.arrowType || "arrow";
  if (markerStart !== "none" && markerEnd === "none") markerEnd = "arrow";

  return {
    ...edge,
    style,
    markerStart,
    markerEnd,
    arrowType: markerEnd,
    ...(edge.minLength !== undefined ? { minLength: Math.max(1, Math.round(edge.minLength)) } : {})
  };
}

export function deleteSelection(graph: MermaidGraph, selection: Selection): MermaidGraph {
  const nodeIds = new Set(selection.nodeIds);
  const edgeIds = new Set(selection.edgeIds);
  const subgraphIds = new Set(selection.subgraphIds || []);
  const subgraphsAfterDissolve = dissolveSubgraphs(graph.subgraphs || [], subgraphIds);

  return {
    ...graph,
    nodes: graph.nodes.filter((node) => !nodeIds.has(node.id)),
    edges: graph.edges.filter(
      (edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.from) && !nodeIds.has(edge.to) && !subgraphIds.has(edge.from) && !subgraphIds.has(edge.to)
    ),
    subgraphs: subgraphsAfterDissolve
      .map((subgraph) => ({
        ...subgraph,
        nodeIds: subgraph.nodeIds.filter((nodeId) => !nodeIds.has(nodeId))
      }))
      .filter((subgraph) => subgraph.nodeIds.length > 0 || subgraphsAfterDissolve.some((child) => child.parentId === subgraph.id))
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

export function setNodeParent(graph: MermaidGraph, nodeId: string, parentId?: string): MermaidGraph {
  return {
    ...graph,
    subgraphs: (graph.subgraphs || []).map((subgraph) => {
      const withoutNode = subgraph.nodeIds.filter((id) => id !== nodeId);
      if (parentId && subgraph.id === parentId) return { ...subgraph, nodeIds: [...withoutNode, nodeId] };
      return { ...subgraph, nodeIds: withoutNode };
    })
  };
}

export function setSubgraphParent(graph: MermaidGraph, subgraphId: string, parentId?: string): MermaidGraph {
  if (subgraphId === parentId || parentId && descendantSubgraphIds(graph, subgraphId).includes(parentId)) return graph;

  return {
    ...graph,
    subgraphs: (graph.subgraphs || []).map((subgraph) => (subgraph.id === subgraphId ? { ...subgraph, parentId } : subgraph))
  };
}

export function parentSubgraphForNode(graph: MermaidGraph, nodeId: string) {
  return (graph.subgraphs || []).find((subgraph) => subgraph.nodeIds.includes(nodeId))?.id;
}

export function descendantNodeIds(graph: MermaidGraph, subgraphId: string): string[] {
  const childSubgraphIds = descendantSubgraphIds(graph, subgraphId);
  return [
    ...((graph.subgraphs || []).find((subgraph) => subgraph.id === subgraphId)?.nodeIds || []),
    ...childSubgraphIds.flatMap((childId) => (graph.subgraphs || []).find((subgraph) => subgraph.id === childId)?.nodeIds || [])
  ];
}

export function descendantSubgraphIds(graph: MermaidGraph, subgraphId: string): string[] {
  const result: string[] = [];
  const visit = (id: string) => {
    for (const child of (graph.subgraphs || []).filter((subgraph) => subgraph.parentId === id)) {
      result.push(child.id);
      visit(child.id);
    }
  };
  visit(subgraphId);
  return result;
}

export function graphDirections(): GraphDirection[] {
  return ["TD", "TB", "BT", "RL", "LR"];
}

function dissolveSubgraphs(subgraphs: CanvasSubgraph[], removed: Set<string>) {
  return subgraphs
    .filter((subgraph) => !removed.has(subgraph.id))
    .map((subgraph) => {
      const removedParent = subgraphs.find((item) => item.id === subgraph.parentId && removed.has(item.id));
      return {
        ...subgraph,
        parentId: removedParent ? removedParent.parentId : subgraph.parentId
      };
    })
    .map((subgraph) => {
      const dissolvedChildren = subgraphs.filter((item) => item.parentId === subgraph.id && removed.has(item.id));
      if (!dissolvedChildren.length) return subgraph;
      return {
        ...subgraph,
        nodeIds: [...subgraph.nodeIds, ...dissolvedChildren.flatMap((item) => item.nodeIds).filter((nodeId) => !subgraph.nodeIds.includes(nodeId))]
      };
    });
}

export function setMode(mode: EditorMode) {
  return mode;
}

export function setViewport(viewport: ViewportState) {
  return viewport;
}
