function visualId(kind: "node" | "subgraph", id: string) {
  return `${kind}-visual:${encodeURIComponent(id)}`;
}

export function nodeVisualId(nodeId: string) {
  return visualId("node", nodeId);
}

export function subgraphVisualId(subgraphId: string) {
  return visualId("subgraph", subgraphId);
}
