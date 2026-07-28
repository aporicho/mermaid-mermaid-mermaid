import type { CanvasPoint, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import { resolveConnectionPreview, resolveRetargetPreview } from "@/features/mermaid-editor/lib/connection-preview";
import type { CanvasEdge, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { CanvasGeometryIndex } from "@/features/mermaid-editor/lib/canvas-geometry-index";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";

type EdgeCommandGeometry = {
  graph: MermaidGraph;
  nodes: NodeGeometry[];
  subgraphs: SubgraphGeometry[];
  geometryIndex: CanvasGeometryIndex;
  nodeById: Map<string, NodeGeometry>;
  subgraphById: Map<string, SubgraphGeometry>;
  anchorSnapRadiusWorld: number;
};

export function commandForFinishedConnection(
  draft: Extract<InteractionState, { kind: "connectingEdge" }>,
  point: CanvasPoint,
  geometry: EdgeCommandGeometry
): EditorCommand | null {
  const preview = resolveConnectionPreview({
    fromId: draft.fromId,
    currentWorld: point,
    nodes: geometry.nodes,
    subgraphs: geometry.subgraphs,
    geometryIndex: geometry.geometryIndex,
    nodeById: geometry.nodeById,
    subgraphById: geometry.subgraphById,
    anchorSnapRadiusWorld: geometry.anchorSnapRadiusWorld
  });
  if (!preview.valid || !preview.targetId) return null;
  return {
    type: "graph.createEdge",
    fromId: draft.fromId,
    toId: preview.targetId,
    fromAnchor: draft.fromAnchor,
    toAnchor: preview.targetAnchor || undefined,
    message: preview.targetAnchor || draft.fromAnchor ? "已创建固定端点连线。" : "已创建连线。",
    source: "pointer"
  };
}

export function commandForEdgeRetarget(
  edgeId: string,
  side: "from" | "to",
  point: CanvasPoint,
  geometry: EdgeCommandGeometry
): EditorCommand | null {
  const edge = geometry.graph.edges.find((item: CanvasEdge) => item.id === edgeId);
  if (!edge) return null;
  const preview = resolveRetargetPreview({
    edge,
    side,
    currentWorld: point,
    nodes: geometry.nodes,
    subgraphs: geometry.subgraphs,
    geometryIndex: geometry.geometryIndex,
    nodeById: geometry.nodeById,
    subgraphById: geometry.subgraphById,
    anchorSnapRadiusWorld: geometry.anchorSnapRadiusWorld
  });
  if (!preview.valid || !preview.targetId) return null;
  return {
    type: "graph.retargetEdge",
    edgeId,
    side,
    targetId: preview.targetId,
    anchor: preview.targetAnchor,
    message: preview.targetAnchor ? "已重连并固定端点。" : "已重连为自动端点。",
    source: "pointer"
  };
}
