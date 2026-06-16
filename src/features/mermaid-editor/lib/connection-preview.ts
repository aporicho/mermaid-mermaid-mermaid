import type { CanvasPoint } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { EdgeDraftTarget } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasEdge } from "@/features/mermaid-editor/lib/editor-types";
import { pointInsideNodeFrame, type NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";

export type ConnectionPreviewReason = "valid" | "blank" | "source-node" | "same-endpoint";

export type ConnectionPreview = {
  valid: boolean;
  targetNodeId: string | null;
  invalidNodeId: string | null;
  reason: ConnectionPreviewReason;
  geometryTarget: EdgeDraftTarget;
};

export function resolveConnectionPreview(input: {
  fromNodeId: string;
  currentWorld: CanvasPoint;
  nodes: NodeGeometry[];
}): ConnectionPreview {
  const target = nodeAtPoint(input.nodes, input.currentWorld);
  if (!target) return pointPreview(input.currentWorld, "blank");
  if (target.id === input.fromNodeId) return invalidNodePreview(target, input.currentWorld, "source-node");

  return validNodePreview(target);
}

export function resolveRetargetPreview(input: {
  edge: CanvasEdge;
  side: "from" | "to";
  currentWorld: CanvasPoint;
  nodes: NodeGeometry[];
}): ConnectionPreview {
  const target = nodeAtPoint(input.nodes, input.currentWorld);
  if (!target) return pointPreview(input.currentWorld, "blank");
  if (target.id === input.edge[input.side]) return invalidNodePreview(target, input.currentWorld, "same-endpoint");

  return validNodePreview(target);
}

function nodeAtPoint(nodes: NodeGeometry[], point: CanvasPoint) {
  return nodes.find((geometry) => pointInsideNodeFrame(point, geometry)) ?? null;
}

function validNodePreview(node: NodeGeometry): ConnectionPreview {
  return {
    valid: true,
    targetNodeId: node.id,
    invalidNodeId: null,
    reason: "valid",
    geometryTarget: { kind: "node", rect: node.routedRect }
  };
}

function invalidNodePreview(node: NodeGeometry, point: CanvasPoint, reason: ConnectionPreviewReason): ConnectionPreview {
  return {
    valid: false,
    targetNodeId: null,
    invalidNodeId: node.id,
    reason,
    geometryTarget: { kind: "point", point }
  };
}

function pointPreview(point: CanvasPoint, reason: ConnectionPreviewReason): ConnectionPreview {
  return {
    valid: false,
    targetNodeId: null,
    invalidNodeId: null,
    reason,
    geometryTarget: { kind: "point", point }
  };
}
