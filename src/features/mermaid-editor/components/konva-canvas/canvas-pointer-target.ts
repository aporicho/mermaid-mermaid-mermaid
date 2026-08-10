import type { CanvasPointerTarget } from "@/features/mermaid-editor/lib/canvas-geometry-hit-test";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";

export function targetNodeId(target: CanvasPointerTarget) {
  if (target.kind === "node") return target.id;
  if (target.kind === "tableColumnResize" || target.kind === "tableCell" || target.kind === "tableHeader" || target.kind === "nodeAnchor") return target.nodeId;
  return null;
}

export function anchorWorldPoint(target: CanvasPointerTarget, nodes: Map<string, NodeGeometry>, subgraphs: Map<string, SubgraphGeometry>) {
  if (target.kind === "nodeAnchor") return nodes.get(target.nodeId)?.anchorsWorld.find((anchor) => anchor.key === target.anchor);
  if (target.kind === "subgraphAnchor") return subgraphs.get(target.subgraphId)?.anchorsWorld.find((anchor) => anchor.key === target.anchor);
  return null;
}
