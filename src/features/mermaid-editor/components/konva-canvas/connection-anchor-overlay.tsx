import { Circle } from "react-konva";

import { resolveConnectionAnchorOverlay } from "@/features/mermaid-editor/components/konva-canvas/connection-anchor-overlay-state";
import type { HitTarget } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { ConnectionPreview } from "@/features/mermaid-editor/lib/connection-preview";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";

export function CanvasConnectionAnchorOverlay({
  hoveredHitTarget,
  connectionPreview,
  retargetPreview,
  nodeGeometryById,
  subgraphGeometries,
  nodeProximityScale,
  visualTokens
}: {
  hoveredHitTarget: HitTarget;
  connectionPreview: ConnectionPreview | null;
  retargetPreview: ConnectionPreview | null;
  nodeGeometryById: Map<string, NodeGeometry>;
  subgraphGeometries: SubgraphGeometry[];
  nodeProximityScale: Record<string, number>;
  visualTokens: CanvasVisualTokens;
}) {
  const anchor = resolveConnectionAnchorOverlay({
    hoveredHitTarget,
    connectionPreview,
    retargetPreview,
    nodeGeometryById,
    subgraphGeometries,
    nodeProximityScale
  });
  if (!anchor) return null;

  const tokens = visualTokens.overlay.anchor;
  return (
    <Circle
      name="canvas-connection-anchor"
      x={anchor.point.x}
      y={anchor.point.y}
      radius={tokens.radius}
      fill={anchor.kind === "target" ? tokens.targetColor : tokens.hoverColor}
      stroke={tokens.strokeColor}
      strokeWidth={tokens.strokeWidth}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}
