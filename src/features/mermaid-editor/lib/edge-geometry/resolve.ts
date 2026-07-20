import type { CanvasEdge, EdgeRouting } from "@/features/mermaid-editor/lib/editor-types";
import { resolveParallelEdgeLanes } from "@/features/mermaid-editor/lib/edge-geometry/lanes";
import { computeEdgePathFromRectMap, remapEdgePathGeometry } from "@/features/mermaid-editor/lib/edge-geometry/routing";
import type {
  EdgePathGeometry,
  EdgePathMapOptions,
  FinalEdgeGeometryMapInput,
  RoutedNodeRect
} from "@/features/mermaid-editor/lib/edge-geometry/types";

export function computeEdgePathMap(edges: CanvasEdge[], nodes: RoutedNodeRect[], edgeRouting: EdgeRouting, options: EdgePathMapOptions = {}): Map<string, EdgePathGeometry> {
  const rectById = new Map(nodes.map((node) => [node.id, node]));
  const lanes = resolveParallelEdgeLanes(edges, nodes, options);
  const geometryById = new Map<string, EdgePathGeometry>();

  for (const edge of edges) {
    const geometry = computeEdgePathFromRectMap(edge, rectById, edgeRouting, {
      lane: lanes.get(edge.id),
      curveSegments: options.curveSegments
    });
    if (geometry) geometryById.set(edge.id, geometry);
  }

  return geometryById;
}

export function resolveFinalEdgeGeometryMap(input: FinalEdgeGeometryMapInput): Map<string, EdgePathGeometry> {
  const resolved = new Map(input.fallbackGeometryById);
  const proximityGeometryById = input.proximityGeometryById ?? new Map<string, EdgePathGeometry>();
  const mermaidRouteByEdgeId = input.mermaidRouteByEdgeId ?? new Map<string, EdgePathGeometry>();

  for (const [edgeId, geometry] of proximityGeometryById) {
    resolved.set(edgeId, geometry);
  }

  for (const edge of input.edges) {
    const routeGeometry = mermaidRouteByEdgeId.get(edge.id);
    if (!routeGeometry) continue;

    const proximityFallbackGeometry = proximityGeometryById.get(edge.id);
    const fallbackGeometry = proximityFallbackGeometry || input.fallbackGeometryById.get(edge.id);
    if ((edge.fromAnchor || edge.toAnchor) && fallbackGeometry) {
      resolved.set(edge.id, fallbackGeometry);
      continue;
    }

    if ((input.layoutMode === "auto" && !proximityFallbackGeometry) || !fallbackGeometry) {
      resolved.set(edge.id, routeGeometry);
      continue;
    }

    resolved.set(edge.id, remapEdgePathGeometry(routeGeometry, fallbackGeometry));
  }

  return resolved;
}
