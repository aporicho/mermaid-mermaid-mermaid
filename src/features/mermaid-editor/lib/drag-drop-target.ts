import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import { subgraphAtPoint, type SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";

export function nodeDragDropTarget(node: CanvasNode | undefined, geometry: NodeGeometry | undefined, position: { x: number; y: number } | undefined, subgraphs: SubgraphGeometry[]) {
  if (!node || !geometry || !position) return null;
  return subgraphAtPoint(subgraphs, {
    x: geometry.frame.x + geometry.frame.width / 2 + position.x - node.x,
    y: geometry.frame.y + geometry.frame.height / 2 + position.y - node.y
  });
}

export function subgraphDragDropTarget(geometry: SubgraphGeometry | undefined, delta: { x: number; y: number }, subgraphs: SubgraphGeometry[], ignoredIds: string[]) {
  if (!geometry) return null;
  return subgraphAtPoint(subgraphs, {
    x: geometry.frame.x + geometry.frame.width / 2 + delta.x,
    y: geometry.frame.y + geometry.frame.height / 2 + delta.y
  }, ignoredIds);
}
