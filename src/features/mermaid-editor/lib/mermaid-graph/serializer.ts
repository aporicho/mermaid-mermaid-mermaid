import type {
  CanvasNode,
  CanvasSubgraph,
  MermaidGraph
} from "@/features/mermaid-editor/lib/editor-types";

import {
  edgeOperatorFromSemantics,
  serializeEdgeProperties
} from "./edge-token";
import { serializeNodeActionStatement } from "./node-action-token";
import { serializeNodeToken } from "./node-token";
import {
  graphEndpointExists,
  groupSubgraphsByParent,
  serializeSubgraphHeader
} from "./subgraph";
import { escapeMermaidLabel } from "./syntax";

export function serializeMermaid(graph: MermaidGraph) {
  const lines = [];
  const frontmatter = graph.frontmatter?.trim();
  if (frontmatter) lines.push(frontmatter);

  lines.push(`flowchart ${graph.direction || "LR"}`);
  const declaredInSubgraph = new Set<string>();
  const childrenByParent = groupSubgraphsByParent(graph.subgraphs || []);

  for (const subgraph of childrenByParent.get("__root__") || []) {
    serializeSubgraph(lines, graph, subgraph, childrenByParent, declaredInSubgraph, "  ");
  }

  for (const node of graph.nodes) {
    if (!declaredInSubgraph.has(node.id)) lines.push(`  ${serializeNodeToken(node)}`);
  }

  for (const edge of graph.edges) {
    if (!graphEndpointExists(graph, edge.from) || !graphEndpointExists(graph, edge.to)) continue;

    const operator = edgeOperatorFromSemantics(edge);
    const edgeText = edge.label ? `${operator}|${escapeMermaidLabel(edge.label)}|` : operator;
    lines.push(`  ${edge.from} ${edgeText} ${edge.to}`);
  }

  for (const edge of graph.edges) {
    if (!edge.mermaidId) continue;
    const propertyText = serializeEdgeProperties(edge);
    if (propertyText) lines.push(`  ${edge.mermaidId}@{ ${propertyText} }`);
  }

  for (const edge of graph.edges) {
    if (edge.mermaidId && edge.classes?.length) lines.push(`  class ${edge.mermaidId} ${edge.classes.join(",")}`);
  }

  if (graph.defaultEdgeStyleText) lines.push(`  linkStyle default ${graph.defaultEdgeStyleText}`);

  graph.edges.forEach((edge, index) => {
    if (edge.styleText) lines.push(`  linkStyle ${index} ${edge.styleText}`);
  });

  for (const node of graph.nodes) {
    const actionStatement = serializeNodeActionStatement(node);
    if (actionStatement) lines.push(actionStatement);
  }

  for (const statement of graph.preservedStatements || []) {
    if (statement.trim()) lines.push(statement);
  }

  return lines.join("\n");
}

function serializeSubgraph(
  lines: string[],
  graph: MermaidGraph,
  subgraph: CanvasSubgraph,
  childrenByParent: Map<string, CanvasSubgraph[]>,
  declaredInSubgraph: Set<string>,
  indent: string
) {
  lines.push(`${indent}${serializeSubgraphHeader(subgraph)}`);
  if (subgraph.direction) lines.push(`${indent}  direction ${subgraph.direction}`);

  for (const child of childrenByParent.get(subgraph.id) || []) {
    serializeSubgraph(lines, graph, child, childrenByParent, declaredInSubgraph, `${indent}  `);
  }

  for (const node of subgraph.nodeIds.map((id) => graph.nodes.find((item) => item.id === id)).filter(Boolean) as CanvasNode[]) {
    declaredInSubgraph.add(node.id);
    lines.push(`${indent}  ${serializeNodeToken(node)}`);
  }

  lines.push(`${indent}end`);
}
