import type { HitTarget } from "@/features/mermaid-editor/lib/canvas-interaction";

export const CANVAS_HIT_NAMES = {
  node: "canvas-node",
  nodeAnchor: "canvas-node-anchor",
  edge: "canvas-edge",
  edgeLabel: "canvas-edge-label",
  edgeEndpoint: "canvas-edge-endpoint"
} as const;

type HitNode = {
  id?: () => string;
  name?: () => string;
  getParent?: () => HitNode | null;
};

export function nodeHitId(nodeId: string) {
  return `node:${encodePart(nodeId)}`;
}

export function nodeAnchorHitId(nodeId: string, anchor: string) {
  return `node-anchor:${encodePart(nodeId)}:${encodePart(anchor)}`;
}

export function edgeHitId(edgeId: string) {
  return `edge:${encodePart(edgeId)}`;
}

export function edgeLabelHitId(edgeId: string) {
  return `edge-label:${encodePart(edgeId)}`;
}

export function edgeEndpointHitId(edgeId: string, side: "from" | "to") {
  return `edge-endpoint:${encodePart(edgeId)}:${side}`;
}

export function resolveKonvaHitTarget(target: HitNode | null | undefined, stage: HitNode | null | undefined): HitTarget {
  let current = target;

  while (current && current !== stage) {
    const hit = parseHitTargetId(readNodeId(current));
    if (hit) return hit;
    current = current.getParent?.() ?? null;
  }

  return { kind: "blank" };
}

export function parseHitTargetId(value: string): HitTarget | null {
  const parts = value.split(":");
  const [kind, first, second] = parts;

  if (kind === "node" && first) {
    return { kind: "node", id: decodePart(first) };
  }

  if (kind === "node-anchor" && first && second) {
    return { kind: "nodeAnchor", nodeId: decodePart(first), anchor: decodePart(second) };
  }

  if (kind === "edge" && first) {
    return { kind: "edge", id: decodePart(first) };
  }

  if (kind === "edge-label" && first) {
    return { kind: "edgeLabel", id: decodePart(first) };
  }

  if (kind === "edge-endpoint" && first && (second === "from" || second === "to")) {
    return { kind: "edgeEndpoint", edgeId: decodePart(first), side: second };
  }

  return null;
}

function readNodeId(node: HitNode) {
  return node.id?.() ?? "";
}

function encodePart(value: string) {
  return encodeURIComponent(value);
}

function decodePart(value: string) {
  return decodeURIComponent(value);
}
