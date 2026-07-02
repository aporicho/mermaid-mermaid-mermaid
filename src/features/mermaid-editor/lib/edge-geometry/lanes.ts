import type { CanvasEdge } from "@/features/mermaid-editor/lib/editor-types";
import {
  DEFAULT_PARALLEL_EDGE_SPACING,
  type EdgeLaneAssignment,
  type EdgePathMapOptions,
  type RoutedNodeRect
} from "@/features/mermaid-editor/lib/edge-geometry/types";

export function resolveParallelEdgeLanes(edges: CanvasEdge[], nodes: RoutedNodeRect[], options: EdgePathMapOptions = {}): Map<string, EdgeLaneAssignment> {
  const rectIds = new Set(nodes.map((node) => node.id));
  const laneSpacing = options.laneSpacing ?? DEFAULT_PARALLEL_EDGE_SPACING;
  const groups = new Map<string, { edge: CanvasEdge; canonicalFrom: string; canonicalTo: string }[]>();

  for (const edge of edges) {
    if (!rectIds.has(edge.from) || !rectIds.has(edge.to)) continue;
    const canonical = canonicalEdgeEndpoints(edge.from, edge.to);
    const groupKey = edge.from === edge.to ? `self::${edge.from}` : `${canonical.from}::${canonical.to}`;
    const group = groups.get(groupKey) || [];
    group.push({ edge, canonicalFrom: canonical.from, canonicalTo: canonical.to });
    groups.set(groupKey, group);
  }

  const lanes = new Map<string, EdgeLaneAssignment>();
  for (const [groupKey, group] of groups) {
    const laneCount = group.length;
    const center = (laneCount - 1) / 2;

    group.forEach((item, index) => {
      const laneIndex = index - center;
      const directionSign = item.edge.from === item.canonicalFrom && item.edge.to === item.canonicalTo ? 1 : -1;
      lanes.set(item.edge.id, {
        groupKey,
        laneIndex,
        laneCount,
        laneOffset: laneIndex * laneSpacing,
        directionSign
      });
    });
  }

  return lanes;
}

export function effectiveLaneOffset(lane: EdgeLaneAssignment | undefined): number {
  if (!lane || lane.laneCount < 2) return 0;
  return lane.laneOffset * lane.directionSign;
}

function canonicalEdgeEndpoints(from: string, to: string) {
  return from <= to ? { from, to } : { from: to, to: from };
}
