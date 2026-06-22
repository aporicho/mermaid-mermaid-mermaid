import type { CanvasPoint } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { EdgeDraftTarget, RoutedNodeRect } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasEdge } from "@/features/mermaid-editor/lib/editor-types";
import { pointInsideNodeFrame, type NodeAnchorPoint, type NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";

export type ConnectionPreviewReason = "valid" | "blank" | "source-node" | "same-endpoint";
export type ConnectionPreviewTargetKind = "node" | "subgraph";

export type ConnectionPreview = {
  valid: boolean;
  targetId: string | null;
  targetKind: ConnectionPreviewTargetKind | null;
  targetAnchor: string | null;
  targetNodeId: string | null;
  targetSubgraphId: string | null;
  invalidId: string | null;
  invalidKind: ConnectionPreviewTargetKind | null;
  invalidNodeId: string | null;
  invalidSubgraphId: string | null;
  reason: ConnectionPreviewReason;
  geometryTarget: EdgeDraftTarget;
};

export function resolveConnectionPreview(input: {
  fromId: string;
  currentWorld: CanvasPoint;
  nodes: NodeGeometry[];
  subgraphs?: SubgraphGeometry[];
  anchorSnapRadiusWorld?: number;
}): ConnectionPreview {
  const target = entityAtPoint(input.nodes, input.subgraphs || [], input.currentWorld);
  if (!target) return pointPreview(input.currentWorld, "blank");
  if (target.id === input.fromId) return invalidEntityPreview(target, input.currentWorld, "source-node");

  return validEntityPreview(target, input.currentWorld, input.anchorSnapRadiusWorld);
}

export function resolveRetargetPreview(input: {
  edge: CanvasEdge;
  side: "from" | "to";
  currentWorld: CanvasPoint;
  nodes: NodeGeometry[];
  subgraphs?: SubgraphGeometry[];
  anchorSnapRadiusWorld?: number;
}): ConnectionPreview {
  const target = entityAtPoint(input.nodes, input.subgraphs || [], input.currentWorld);
  if (!target) return pointPreview(input.currentWorld, "blank");
  const targetAnchor = nearestAnchorKey(target.anchorsWorld, input.currentWorld, input.anchorSnapRadiusWorld);
  const currentAnchor = input.side === "from" ? input.edge.fromAnchor : input.edge.toAnchor;
  const changesAnchorOnSameEndpoint = Boolean(targetAnchor && targetAnchor !== currentAnchor) || Boolean(!targetAnchor && currentAnchor);
  if (target.id === input.edge[input.side] && !changesAnchorOnSameEndpoint) {
    return invalidNodePreview(target, input.currentWorld, "same-endpoint");
  }

  return validEntityPreview(target, input.currentWorld, input.anchorSnapRadiusWorld);
}

type ConnectionEntity = {
  kind: ConnectionPreviewTargetKind;
  id: string;
  rect: RoutedNodeRect;
  anchorsWorld: NodeAnchorPoint[];
};

function entityAtPoint(nodes: NodeGeometry[], subgraphs: SubgraphGeometry[], point: CanvasPoint): ConnectionEntity | null {
  const node = nodes.find((geometry) => pointInsideNodeFrame(point, geometry));
  if (node) return { kind: "node", id: node.id, rect: node.routedRect, anchorsWorld: node.anchorsWorld };

  const subgraph = subgraphs
    .filter((geometry) => pointInsideRect(point, geometry.frame))
    .sort((a, b) => b.depth - a.depth)[0];
  return subgraph ? { kind: "subgraph", id: subgraph.id, rect: subgraph.routedRect, anchorsWorld: subgraph.anchorsWorld } : null;
}

function validEntityPreview(entity: ConnectionEntity, point: CanvasPoint, anchorSnapRadiusWorld = 0): ConnectionPreview {
  return {
    valid: true,
    targetId: entity.id,
    targetKind: entity.kind,
    targetAnchor: nearestAnchorKey(entity.anchorsWorld, point, anchorSnapRadiusWorld),
    targetNodeId: entity.kind === "node" ? entity.id : null,
    targetSubgraphId: entity.kind === "subgraph" ? entity.id : null,
    invalidId: null,
    invalidKind: null,
    invalidNodeId: null,
    invalidSubgraphId: null,
    reason: "valid",
    geometryTarget: { kind: "node", rect: entity.rect }
  };
}

function invalidNodePreview(entity: ConnectionEntity, point: CanvasPoint, reason: ConnectionPreviewReason): ConnectionPreview {
  return invalidEntityPreview(entity, point, reason);
}

function invalidEntityPreview(entity: ConnectionEntity, point: CanvasPoint, reason: ConnectionPreviewReason): ConnectionPreview {
  return {
    valid: false,
    targetId: null,
    targetKind: null,
    targetAnchor: null,
    targetNodeId: null,
    targetSubgraphId: null,
    invalidId: entity.id,
    invalidKind: entity.kind,
    invalidNodeId: entity.kind === "node" ? entity.id : null,
    invalidSubgraphId: entity.kind === "subgraph" ? entity.id : null,
    reason,
    geometryTarget: { kind: "point", point }
  };
}

function pointPreview(point: CanvasPoint, reason: ConnectionPreviewReason): ConnectionPreview {
  return {
    valid: false,
    targetId: null,
    targetKind: null,
    targetAnchor: null,
    targetNodeId: null,
    targetSubgraphId: null,
    invalidId: null,
    invalidKind: null,
    invalidNodeId: null,
    invalidSubgraphId: null,
    reason,
    geometryTarget: { kind: "point", point }
  };
}

function pointInsideRect(point: CanvasPoint, rect: { x: number; y: number; width: number; height: number }) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function nearestAnchorKey(anchors: NodeAnchorPoint[], point: CanvasPoint, radius: number | undefined) {
  if (!anchors.length || !radius || radius <= 0) return null;

  let nearest: NodeAnchorPoint | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const anchor of anchors) {
    const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y);
    if (distance > radius || distance >= nearestDistance) continue;

    nearest = anchor;
    nearestDistance = distance;
  }

  return nearest?.key ?? null;
}
