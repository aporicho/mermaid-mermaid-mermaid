import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";

export function dragGraphChanged(previous: MermaidGraph, next: MermaidGraph) {
  if (previous.nodes.some((node, index) => {
    const candidate = next.nodes[index];
    return !candidate || node.id !== candidate.id || node.x !== candidate.x || node.y !== candidate.y;
  })) return true;
  const previousSubgraphs = previous.subgraphs || [];
  const nextSubgraphs = next.subgraphs || [];
  if (previousSubgraphs.length !== nextSubgraphs.length) return true;
  return previousSubgraphs.some((subgraph, index) => {
    const candidate = nextSubgraphs[index];
    return !candidate || subgraph.id !== candidate.id || subgraph.parentId !== candidate.parentId
      || subgraph.nodeIds.length !== candidate.nodeIds.length
      || subgraph.nodeIds.some((id, nodeIndex) => id !== candidate.nodeIds[nodeIndex]);
  });
}
