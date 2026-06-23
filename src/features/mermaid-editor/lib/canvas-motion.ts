import type { CanvasNode, MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import type { RuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import { shouldAnimateCanvasItemCount } from "@/features/mermaid-editor/lib/editor-motion";

export type CanvasMotionNodeSnapshot = Pick<CanvasNode, "id" | "x" | "y">;

export type CanvasMotionChangeSet = {
  createdNodeIds: string[];
  movedNodeIds: string[];
  removedNodeIds: string[];
  highlightedNodeIds: string[];
  highlightedEdgeIds: string[];
  animateLayout: boolean;
};

export function snapshotCanvasNodes(graph: MermaidGraph): Map<string, CanvasMotionNodeSnapshot> {
  return new Map(graph.nodes.map((node) => [node.id, { id: node.id, x: node.x, y: node.y }]));
}

export function resolveCanvasMotionChanges(input: {
  previousNodes: Map<string, CanvasMotionNodeSnapshot>;
  graph: MermaidGraph;
  previousSelection?: Selection;
  selection: Selection;
  motion: RuntimeEditorMotion;
  interactionKind: string;
}): CanvasMotionChangeSet {
  const currentNodes = snapshotCanvasNodes(input.graph);
  const createdNodeIds: string[] = [];
  const movedNodeIds: string[] = [];
  const removedNodeIds: string[] = [];

  for (const node of input.graph.nodes) {
    const previous = input.previousNodes.get(node.id);
    if (!previous) {
      createdNodeIds.push(node.id);
      continue;
    }
    if (previous.x !== node.x || previous.y !== node.y) movedNodeIds.push(node.id);
  }

  for (const previousId of input.previousNodes.keys()) {
    if (!currentNodes.has(previousId)) removedNodeIds.push(previousId);
  }

  const highlightedNodeIds = changedSelectionItems(input.previousSelection?.nodeIds ?? [], input.selection.nodeIds);
  const highlightedEdgeIds = changedSelectionItems(input.previousSelection?.edgeIds ?? [], input.selection.edgeIds);
  const changedCount = createdNodeIds.length + movedNodeIds.length + removedNodeIds.length;
  const animatableInteraction = input.interactionKind !== "draggingNodes" && input.interactionKind !== "draggingSubgraphs" && input.interactionKind !== "panning";

  return {
    createdNodeIds,
    movedNodeIds,
    removedNodeIds,
    highlightedNodeIds,
    highlightedEdgeIds,
    animateLayout: animatableInteraction && shouldAnimateCanvasItemCount(changedCount, input.motion)
  };
}

function changedSelectionItems(previous: readonly string[], next: readonly string[]) {
  const previousSet = new Set(previous);
  return next.filter((id) => !previousSet.has(id));
}
