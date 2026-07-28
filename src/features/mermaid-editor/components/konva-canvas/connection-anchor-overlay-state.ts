import type { HitTarget } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { ConnectionPreview } from "@/features/mermaid-editor/lib/connection-preview";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";

export type ConnectionAnchorOverlayState = {
  entityKind: "node" | "subgraph";
  entityId: string;
  anchor: string;
  point: { x: number; y: number };
  kind: "hovered" | "target";
};

export function resolveConnectionAnchorOverlay({
  hoveredHitTarget,
  connectionPreview,
  retargetPreview,
  nodeGeometryById,
  subgraphGeometries,
  nodeProximityScale = {}
}: {
  hoveredHitTarget: HitTarget;
  connectionPreview?: ConnectionPreview | null;
  retargetPreview?: ConnectionPreview | null;
  nodeGeometryById: Map<string, NodeGeometry>;
  subgraphGeometries: SubgraphGeometry[];
  nodeProximityScale?: Record<string, number>;
}): ConnectionAnchorOverlayState | null {
  const preview = retargetPreview ?? connectionPreview;
  if (preview) {
    if (!preview.valid || !preview.targetId || !preview.targetKind || !preview.targetAnchor) return null;
    return anchorState(
      preview.targetKind,
      preview.targetId,
      preview.targetAnchor,
      "target",
      nodeGeometryById,
      subgraphGeometries,
      nodeProximityScale
    );
  }

  if (hoveredHitTarget.kind === "nodeAnchor") {
    return anchorState(
      "node",
      hoveredHitTarget.nodeId,
      hoveredHitTarget.anchor,
      "hovered",
      nodeGeometryById,
      subgraphGeometries,
      nodeProximityScale
    );
  }
  if (hoveredHitTarget.kind === "subgraphAnchor") {
    return anchorState(
      "subgraph",
      hoveredHitTarget.subgraphId,
      hoveredHitTarget.anchor,
      "hovered",
      nodeGeometryById,
      subgraphGeometries,
      nodeProximityScale
    );
  }
  return null;
}

function anchorState(
  entityKind: "node" | "subgraph",
  entityId: string,
  anchorKey: string,
  kind: ConnectionAnchorOverlayState["kind"],
  nodeGeometryById: Map<string, NodeGeometry>,
  subgraphGeometries: SubgraphGeometry[],
  nodeProximityScale: Record<string, number>
): ConnectionAnchorOverlayState | null {
  if (entityKind === "node") {
    const geometry = nodeGeometryById.get(entityId);
    const anchor = geometry?.anchorsLocal.find((candidate) => candidate.key === anchorKey);
    if (!geometry || !anchor) return null;
    const scale = nodeProximityScale[entityId] ?? 1;
    return {
      entityKind,
      entityId,
      anchor: anchorKey,
      kind,
      point: {
        x: geometry.frame.x + geometry.frame.width / 2 + (anchor.x - geometry.frame.width / 2) * scale,
        y: geometry.frame.y + geometry.frame.height / 2 + (anchor.y - geometry.frame.height / 2) * scale
      }
    };
  }

  const geometry = subgraphGeometries.find((candidate) => candidate.id === entityId);
  const anchor = geometry?.anchorsWorld.find((candidate) => candidate.key === anchorKey);
  if (!anchor) return null;
  return { entityKind, entityId, anchor: anchorKey, kind, point: { x: anchor.x, y: anchor.y } };
}
