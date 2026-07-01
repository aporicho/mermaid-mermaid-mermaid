import { DEFAULT_CURVE_VALUE, ROOT_VALUE, INHERIT_VALUE } from "@/features/mermaid-editor/components/inspector-panel/constants";
import { descendantSubgraphIds } from "@/features/mermaid-editor/lib/editor-actions";
import type {
  CanvasEdge,
  CanvasEdgeBatchPatch,
  CanvasNode,
  CanvasNodeBatchPatch,
  CanvasSubgraph,
  MermaidGraph,
  Selection
} from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_FLOWCHART_NODE_SHAPE, normalizeFlowchartShape } from "@/features/mermaid-editor/lib/flowchart-shapes";
import { flowchartPortPoints, type ShapeGeometryPortKind } from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import { DEFAULT_IMAGE_ASSET_HEIGHT, DEFAULT_IMAGE_ASSET_WIDTH } from "@/features/mermaid-editor/lib/node-assets";

const anchorKindLabels: Record<ShapeGeometryPortKind, string> = {
  "edge-midpoint": "边中点",
  corner: "角点",
  "polygon-edge": "边中点",
  "polygon-vertex": "顶点",
  "ellipse-cardinal": "主方向",
  "ellipse-diagonal": "斜向"
};

const anchorKeyLabels: Record<string, string> = {
  top: "上",
  "top-right": "右上",
  right: "右",
  "bottom-right": "右下",
  bottom: "下",
  "bottom-left": "左下",
  left: "左",
  "top-left": "左上"
};

export type SharedSelectionValue<T> = { mixed: boolean; value: T };

export function createInspectorSelectionModel(graph: MermaidGraph, selection: Selection) {
  const selectedNodes = graph.nodes.filter((node) => selection.nodeIds.includes(node.id));
  const selectedEdges = graph.edges.filter((edge) => selection.edgeIds.includes(edge.id));
  const selectedSubgraphs = (graph.subgraphs || []).filter((subgraph) => (selection.subgraphIds || []).includes(subgraph.id));
  const selectedNode = selectedNodes.length === 1 && selectedEdges.length === 0 && selectedSubgraphs.length === 0 ? selectedNodes[0] : undefined;
  const selectedEdge = selectedEdges.length === 1 && selectedNodes.length === 0 && selectedSubgraphs.length === 0 ? selectedEdges[0] : undefined;
  const selectedSubgraph = selectedSubgraphs.length === 1 && selectedNodes.length === 0 && selectedEdges.length === 0 ? selectedSubgraphs[0] : undefined;
  const selectedEdgeFromNode = selectedEdge ? graph.nodes.find((node) => node.id === selectedEdge.from) : undefined;
  const selectedEdgeToNode = selectedEdge ? graph.nodes.find((node) => node.id === selectedEdge.to) : undefined;

  return {
    selectedNodes,
    selectedEdges,
    selectedSubgraphs,
    selectedNode,
    selectedEdge,
    selectedSubgraph,
    multiNode: selectedNodes.length > 1 && selectedEdges.length === 0 && selectedSubgraphs.length === 0,
    multiEdge: selectedEdges.length > 1 && selectedNodes.length === 0 && selectedSubgraphs.length === 0,
    multiSubgraph: selectedSubgraphs.length > 1 && selectedNodes.length === 0 && selectedEdges.length === 0,
    selectedEdgeFromNode,
    selectedEdgeToNode,
    selectedEdgeFromAnchorOptions: nodeAnchorOptions(selectedEdgeFromNode),
    selectedEdgeToAnchorOptions: nodeAnchorOptions(selectedEdgeToNode),
    selectedSubgraphParentOptions: selectedSubgraph ? subgraphParentOptionsForSingle(graph, selectedSubgraph) : [],
    batchNodeShape: sharedSelectionValue(selectedNodes, (node) => node.shape || DEFAULT_FLOWCHART_NODE_SHAPE, DEFAULT_FLOWCHART_NODE_SHAPE),
    batchNodeFill: sharedSelectionValue(selectedNodes, (node) => node.fill, ""),
    canBatchNodeAsset: selectedNodes.length > 1 && selectedNodes.every((node) => node.asset),
    batchAssetWidth: sharedSelectionValue(selectedNodes, (node) => node.asset?.width || DEFAULT_IMAGE_ASSET_WIDTH, DEFAULT_IMAGE_ASSET_WIDTH),
    batchAssetHeight: sharedSelectionValue(selectedNodes, (node) => node.asset?.height || DEFAULT_IMAGE_ASSET_HEIGHT, DEFAULT_IMAGE_ASSET_HEIGHT),
    batchAssetLabelPosition: sharedSelectionValue(selectedNodes, (node) => node.asset?.labelPosition || "bottom", "bottom"),
    batchAssetPreserveAspectRatio: sharedSelectionValue(selectedNodes, (node) => node.asset?.preserveAspectRatio ?? true, true),
    batchEdgeStyle: sharedSelectionValue(selectedEdges, (edge) => edge.style || "solid", "solid"),
    batchEdgeMarkerStart: sharedSelectionValue(selectedEdges, (edge) => edge.markerStart || "none", "none"),
    batchEdgeMarkerEnd: sharedSelectionValue(selectedEdges, edgeEndMarker, "arrow"),
    batchEdgeMinLength: sharedSelectionValue(selectedEdges, (edge) => edge.minLength || 1, 1),
    batchEdgeAnimation: sharedSelectionValue(selectedEdges, (edge) => edge.animation || "none", "none"),
    batchEdgeCurve: sharedSelectionValue(selectedEdges, (edge) => edge.curve || DEFAULT_CURVE_VALUE, DEFAULT_CURVE_VALUE),
    batchEdgeClasses: sharedSelectionValue(selectedEdges, (edge) => edgeClassesInput(edge.classes), ""),
    batchEdgeStyleText: sharedSelectionValue(selectedEdges, (edge) => edge.styleText || "", ""),
    batchSubgraphDirection: sharedSelectionValue(selectedSubgraphs, (subgraph) => subgraph.direction || INHERIT_VALUE, INHERIT_VALUE),
    batchSubgraphParent: sharedSelectionValue(selectedSubgraphs, (subgraph) => subgraph.parentId || ROOT_VALUE, ROOT_VALUE),
    batchSubgraphParentOptions: subgraphParentOptionsForBatch(graph, selectedSubgraphs),
    endpointOptions: [
      ...graph.nodes.map((node) => ({ id: node.id, label: `${node.id} · 节点` })),
      ...(graph.subgraphs || []).map((subgraph) => ({ id: subgraph.id, label: `${subgraph.id} · 组` }))
    ]
  };
}

export type InspectorSelectionModel = ReturnType<typeof createInspectorSelectionModel>;

export function nodeAnchorOptions(node: CanvasNode | undefined) {
  if (!node) return [];
  const shape = normalizeFlowchartShape(node.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  return flowchartPortPoints(shape, { x: 0, y: 0, width: 100, height: 100 }).map((port, index) => ({
    value: port.key,
    label: anchorLabel(port.key, port.kind, index)
  }));
}

export function edgeAnchorSelectValue(value: string | undefined, options: { value: string }[]) {
  return value && options.some((option) => option.value === value) ? value : "auto";
}

export function edgeEndMarker(edge: Pick<CanvasEdge, "markerEnd" | "arrowType">) {
  return edge.markerEnd || edge.arrowType || "arrow";
}

export function normalizeMermaidEdgeId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const safe = trimmed.replace(/[^\w-]/g, "_");
  return /^[A-Za-z]/.test(safe) ? safe : `e${safe}`;
}

export function edgeClassesInput(classes: string[] | undefined) {
  return (classes || []).join(", ");
}

export function parseEdgeClasses(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeNodePatch(patch: Partial<CanvasNode>) {
  return {
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
    ...(patch.shape !== undefined ? { shape: patch.shape } : {}),
    ...("asset" in patch ? { asset: patch.asset } : {}),
    ...("action" in patch ? { action: patch.action } : {})
  };
}

export function normalizeEdgePatch(patch: Partial<CanvasEdge>) {
  return {
    ...(patch.from !== undefined ? { from: patch.from } : {}),
    ...(patch.to !== undefined ? { to: patch.to } : {}),
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.style !== undefined ? { style: patch.style } : {}),
    ...(patch.arrowType !== undefined ? { arrowType: patch.arrowType } : {}),
    ...(patch.markerStart !== undefined ? { markerStart: patch.markerStart } : {}),
    ...(patch.markerEnd !== undefined ? { markerEnd: patch.markerEnd } : {}),
    ...(patch.minLength !== undefined ? { minLength: patch.minLength } : {}),
    ...("mermaidId" in patch ? { mermaidId: patch.mermaidId } : {}),
    ...(patch.animation !== undefined ? { animation: patch.animation } : {}),
    ...("curve" in patch ? { curve: patch.curve } : {}),
    ...("classes" in patch ? { classes: patch.classes } : {}),
    ...("styleText" in patch ? { styleText: patch.styleText } : {}),
    ...("fromAnchor" in patch ? { fromAnchor: patch.fromAnchor } : {}),
    ...("toAnchor" in patch ? { toAnchor: patch.toAnchor } : {})
  };
}

export function normalizeSubgraphPatch(patch: Partial<CanvasSubgraph>) {
  return {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...("parentId" in patch ? { parentId: patch.parentId } : {}),
    ...("direction" in patch ? { direction: patch.direction } : {})
  };
}

export function sharedSelectionValue<T, V>(items: T[], read: (item: T) => V, fallback: V): SharedSelectionValue<V> {
  const first = items[0] ? read(items[0]) : fallback;
  return {
    value: first,
    mixed: items.length > 1 && items.some((item) => !Object.is(read(item), first))
  };
}

export function updateBatchNodeAssetNumber(updateSelectedNodes: (patch: CanvasNodeBatchPatch) => void, key: "width" | "height", value: string) {
  if (!value.trim()) return;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;

  updateSelectedNodes({ asset: key === "width" ? { width: parsed } : { height: parsed } });
}

export function updateSelectedEdgeNumber(updateSelectedEdge: (id: string, patch: Partial<CanvasEdge>) => void, edgeId: string, key: "minLength", value: string) {
  if (!value.trim()) return;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;

  updateSelectedEdge(edgeId, { [key]: Math.max(1, Math.round(parsed)) });
}

export function updateBatchEdgeNumber(updateSelectedEdges: (patch: CanvasEdgeBatchPatch) => void, key: "minLength", value: string) {
  if (!value.trim()) return;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;

  updateSelectedEdges({ [key]: Math.max(1, Math.round(parsed)) });
}

function subgraphParentOptionsForSingle(graph: MermaidGraph, selectedSubgraph: CanvasSubgraph) {
  return (graph.subgraphs || []).filter((subgraph) => subgraph.id !== selectedSubgraph.id && !descendantSubgraphIds(graph, selectedSubgraph.id).includes(subgraph.id));
}

function subgraphParentOptionsForBatch(graph: MermaidGraph, selectedSubgraphs: CanvasSubgraph[]) {
  const blockedIds = new Set(selectedSubgraphs.map((subgraph) => subgraph.id));
  selectedSubgraphs.forEach((subgraph) => {
    descendantSubgraphIds(graph, subgraph.id).forEach((id) => blockedIds.add(id));
  });

  return (graph.subgraphs || []).filter((subgraph) => !blockedIds.has(subgraph.id));
}

function anchorLabel(key: string, kind: ShapeGeometryPortKind, index: number) {
  const readableKey = anchorKeyLabels[key] || key.replace(/^edge-(\d+)$/, "边 $1").replace(/^vertex-(\d+)$/, "顶点 $1");
  return `${readableKey} · ${anchorKindLabels[kind] || `连接点 ${index + 1}`}`;
}
