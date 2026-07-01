import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_FLOWCHART_NODE_SHAPE } from "@/features/mermaid-editor/lib/flowchart-shapes";

import { NODE_COLORS } from "./constants";
import { cleanNodeId } from "./syntax";

export function toSafeNodeId(value: string, existingIds: string[], fallback = "Node") {
  const base = cleanNodeId(value || fallback);
  if (!existingIds.includes(base)) return base;

  let index = 2;
  while (existingIds.includes(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

export function nextCanvasNodeId(existingNodes: CanvasNode[]) {
  const existingIds = existingNodes.map((node) => node.id);
  const maxGeneratedIndex = existingIds.reduce((max, id) => {
    const match = id.match(/^N(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return toSafeNodeId(`N${maxGeneratedIndex + 1}`, existingIds, "N1");
}

export function createNode(existingNodes: CanvasNode[], x = 160, y = 120): CanvasNode {
  const id = nextCanvasNodeId(existingNodes);
  return {
    id,
    label: "新节点",
    x,
    y,
    fill: NODE_COLORS[existingNodes.length % NODE_COLORS.length],
    shape: DEFAULT_FLOWCHART_NODE_SHAPE
  };
}
