import type {
  CanvasSubgraph,
  GraphDirection,
  MermaidGraph
} from "@/features/mermaid-editor/lib/editor-types";

import { parseNodeToken } from "./node-token";
import {
  cleanNodeId,
  escapeMermaidLabel,
  normalizeLabel
} from "./syntax";
import type { ParsedNodeToken } from "./types";

export function parseSubgraphHeader(clean: string, index: number): CanvasSubgraph {
  const raw = clean.replace(/^subgraph\s+/i, "").trim().replace(/;$/, "");
  const idAndTitle = raw.match(/^([A-Za-z][\w-]*)\s*\[(.*)\]$/);
  if (idAndTitle) {
    return {
      id: idAndTitle[1],
      title: normalizeLabel(idAndTitle[2]),
      nodeIds: []
    };
  }

  const nodeLike = parseNodeToken(raw);
  if (nodeLike?.label) {
    return {
      id: nodeLike.id,
      title: nodeLike.label,
      nodeIds: []
    };
  }

  const id = /^[A-Za-z][\w-]*$/.test(raw) ? raw : cleanNodeId(raw || `Subgraph_${index + 1}`);
  return {
    id,
    title: raw || id,
    nodeIds: []
  };
}

export function serializeSubgraphHeader(subgraph: CanvasSubgraph) {
  if (!subgraph.title || subgraph.title === subgraph.id) return `subgraph ${subgraph.id}`;
  return `subgraph ${subgraph.id} [${escapeMermaidLabel(subgraph.title)}]`;
}

export function isGraphDirection(value: string | undefined): value is GraphDirection {
  return value === "TD" || value === "TB" || value === "BT" || value === "RL" || value === "LR";
}

export function assignNodeToSubgraph(subgraphs: CanvasSubgraph[], nodeId: string, parentId: string) {
  for (const subgraph of subgraphs) {
    subgraph.nodeIds = subgraph.nodeIds.filter((id) => id !== nodeId);
  }

  const parent = subgraphs.find((subgraph) => subgraph.id === parentId);
  if (parent && !parent.nodeIds.includes(nodeId)) parent.nodeIds.push(nodeId);
}

export function endpointKind(token: ParsedNodeToken, subgraphIds: Set<string>) {
  return !token.hasShape && subgraphIds.has(token.id) ? "subgraph" : "node";
}

export function groupSubgraphsByParent(subgraphs: CanvasSubgraph[]) {
  const childrenByParent = new Map<string, CanvasSubgraph[]>();

  for (const subgraph of subgraphs) {
    const parentId = subgraph.parentId || "__root__";
    const children = childrenByParent.get(parentId) || [];
    children.push(subgraph);
    childrenByParent.set(parentId, children);
  }

  return childrenByParent;
}

export function graphEndpointExists(graph: MermaidGraph, id: string) {
  return graph.nodes.some((node) => node.id === id) || (graph.subgraphs || []).some((subgraph) => subgraph.id === id);
}
