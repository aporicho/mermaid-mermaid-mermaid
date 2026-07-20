import type { CanvasEdge, EdgeRouting, FlowchartNodeShape, LayoutMode } from "@/features/mermaid-editor/lib/editor-types";

export type EdgeAnchorPolicy = "center-ray" | "fixed-port" | "boundary-ray";
export type EdgeTangentPolicy = "radial" | "side-normal";
export type EdgePathKind = "straight" | "cubic-bezier" | "rounded-orthogonal" | "basis-spline";

export type Point = {
  x: number;
  y: number;
};

export type RoutedNodeRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: FlowchartNodeShape;
};

export type EdgePathGeometry = {
  points: number[];
  pathData?: string;
  labelPoint: Point;
  start: Point;
  end: Point;
  startTangent: Point;
  endTangent: Point;
};

export type EdgeDraftTarget = { kind: "node"; rect: RoutedNodeRect } | { kind: "point"; point: Point };
export type EdgeRetargetSide = "from" | "to";
export type EdgeLaneAssignment = {
  groupKey: string;
  laneIndex: number;
  laneCount: number;
  laneOffset: number;
  directionSign: 1 | -1;
};
export type EdgeRoutingOptions = {
  lane?: EdgeLaneAssignment;
  curveSegments?: number;
};
export type EdgePathMapOptions = {
  laneSpacing?: number;
  curveSegments?: number;
};

export type FinalEdgeGeometryMapInput = {
  edges: Pick<CanvasEdge, "id" | "fromAnchor" | "toAnchor">[];
  fallbackGeometryById: Map<string, EdgePathGeometry>;
  proximityGeometryById?: Map<string, EdgePathGeometry>;
  mermaidRouteByEdgeId?: Map<string, EdgePathGeometry>;
  layoutMode: LayoutMode;
};

export type EdgeRoutingPreset = {
  anchorPolicy: EdgeAnchorPolicy;
  tangentPolicy: EdgeTangentPolicy;
  pathKind: EdgePathKind;
};

export type EdgeAnchors = {
  start: Point;
  end: Point;
  sourceTangent: Point;
  endTangent: Point;
};

export type ShapePort = {
  point: Point;
  outward: Point;
};

export const SOURCE_GAP = 6;
export const TARGET_GAP = 10;
export const CUBIC_SEGMENTS = 120;
export const ORTHOGONAL_STUB = 28;
export const ORTHOGONAL_CORNER_RADIUS = 14;
export const ORTHOGONAL_CORNER_SEGMENTS = 25;
export const EPSILON = 0.001;
export const DEFAULT_PARALLEL_EDGE_SPACING = 18;

export const routingPresets: Record<EdgeRouting, EdgeRoutingPreset> = {
  straight: {
    anchorPolicy: "center-ray",
    tangentPolicy: "radial",
    pathKind: "straight"
  },
  bezier: {
    anchorPolicy: "fixed-port",
    tangentPolicy: "side-normal",
    pathKind: "cubic-bezier"
  },
  orthogonal: {
    anchorPolicy: "fixed-port",
    tangentPolicy: "side-normal",
    pathKind: "rounded-orthogonal"
  },
  mermaid: {
    anchorPolicy: "boundary-ray",
    tangentPolicy: "radial",
    pathKind: "basis-spline"
  }
};
