function visualId(kind: "node" | "subgraph" | "edge", id: string) {
  return `${kind}-visual:${encodeURIComponent(id)}`;
}

export function nodeVisualId(nodeId: string) {
  return visualId("node", nodeId);
}

export function subgraphVisualId(subgraphId: string) {
  return visualId("subgraph", subgraphId);
}

export function edgeVisualId(edgeId: string) {
  return visualId("edge", edgeId);
}
