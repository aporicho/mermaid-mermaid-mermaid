export { resolveParallelEdgeLanes } from "@/features/mermaid-editor/lib/edge-geometry/lanes";
export {
  computeEdgeDraftPath,
  computeEdgePath,
  computeEdgeRetargetPath,
  remapEdgePathGeometry
} from "@/features/mermaid-editor/lib/edge-geometry/routing";
export {
  computeEdgePathMap,
  resolveFinalEdgeGeometryMap
} from "@/features/mermaid-editor/lib/edge-geometry/resolve";
export {
  DEFAULT_PARALLEL_EDGE_SPACING
} from "@/features/mermaid-editor/lib/edge-geometry/types";
export type {
  EdgeAnchorPolicy,
  EdgeDraftTarget,
  EdgeLaneAssignment,
  EdgePathGeometry,
  EdgePathKind,
  EdgePathMapOptions,
  EdgeRetargetSide,
  EdgeRoutingOptions,
  EdgeTangentPolicy,
  FinalEdgeGeometryMapInput,
  RoutedNodeRect
} from "@/features/mermaid-editor/lib/edge-geometry/types";
