import { computeEdgePathFromRectMap, type EdgeLaneAssignment, type EdgePathGeometry, type RoutedNodeRect } from "@/features/mermaid-editor/lib/edge-geometry";
import { incrementPerformanceCounter } from "@/features/mermaid-editor/lib/editor-performance";
import type { CanvasEdge, EdgeRouting } from "@/features/mermaid-editor/lib/editor-types";

export type EdgeGeometryCache = Map<string, { key: string; geometry: EdgePathGeometry }>;

export function resolveCachedEdgeGeometries(input: {
  cache: EdgeGeometryCache;
  edges: CanvasEdge[];
  rectById: Map<string, RoutedNodeRect>;
  routing: EdgeRouting;
  lanes: Map<string, EdgeLaneAssignment>;
  curveSegments: number;
}) {
  const resolved = new Map<string, EdgePathGeometry>();
  let hits = 0;
  let misses = 0;
  for (const edge of input.edges) {
    const lane = input.lanes.get(edge.id);
    const key = edgeGeometryCacheKey(edge, input.rectById, input.routing, lane, input.curveSegments);
    const cached = input.cache.get(edge.id);
    if (cached?.key === key) {
      resolved.set(edge.id, cached.geometry);
      hits += 1;
      continue;
    }

    const geometry = computeEdgePathFromRectMap(edge, input.rectById, input.routing, { lane, curveSegments: input.curveSegments });
    if (!geometry) continue;
    input.cache.set(edge.id, { key, geometry });
    resolved.set(edge.id, geometry);
    misses += 1;
  }
  if (hits) incrementPerformanceCounter("canvas-edge-route-cache-hit", hits);
  if (misses) incrementPerformanceCounter("canvas-edge-route-cache-miss", misses);
  return resolved;
}

export function pruneEdgeGeometryCache(cache: EdgeGeometryCache, activeEdges: CanvasEdge[]) {
  const activeEdgeIds = new Set(activeEdges.map((edge) => edge.id));
  for (const edgeId of cache.keys()) {
    if (!activeEdgeIds.has(edgeId)) cache.delete(edgeId);
  }
}

function edgeGeometryCacheKey(
  edge: CanvasEdge,
  rectById: Map<string, RoutedNodeRect>,
  routing: EdgeRouting,
  lane: EdgeLaneAssignment | undefined,
  curveSegments: number
) {
  return [
    routing,
    curveSegments,
    edge.from,
    edge.to,
    edge.fromAnchor || "",
    edge.toAnchor || "",
    routedRectKey(rectById.get(edge.from)),
    routedRectKey(rectById.get(edge.to)),
    lane?.laneIndex ?? 0,
    lane?.laneCount ?? 1,
    lane?.laneOffset ?? 0,
    lane?.directionSign ?? 1
  ].join("|");
}

function routedRectKey(rect: RoutedNodeRect | undefined) {
  return rect ? `${rect.x},${rect.y},${rect.width},${rect.height},${rect.shape || "rect"}` : "missing";
}
