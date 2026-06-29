import { curveBasis, line } from "d3-shape";

import type { CanvasEdge, EdgeRouting, FlowchartNodeShape, LayoutMode } from "@/features/mermaid-editor/lib/editor-types";
import {
  ellipseBoundaryPoint,
  flowchartPolygonPoints,
  flowchartPortPoints,
  isEllipseLikeFlowchartShape,
  type ShapeGeometryPoint
} from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import { DEFAULT_FLOWCHART_NODE_SHAPE, normalizeFlowchartShape } from "@/features/mermaid-editor/lib/flowchart-shapes";

export type EdgeAnchorPolicy = "center-ray" | "fixed-port" | "boundary-ray";
export type EdgeTangentPolicy = "radial" | "side-normal";
export type EdgePathKind = "straight" | "cubic-bezier" | "rounded-orthogonal" | "basis-spline";

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
};
export type EdgePathMapOptions = {
  laneSpacing?: number;
};

export type FinalEdgeGeometryMapInput = {
  edges: Pick<CanvasEdge, "id" | "fromAnchor" | "toAnchor">[];
  fallbackGeometryById: Map<string, EdgePathGeometry>;
  proximityGeometryById?: Map<string, EdgePathGeometry>;
  mermaidRouteByEdgeId?: Map<string, EdgePathGeometry>;
  layoutMode: LayoutMode;
};

type Point = {
  x: number;
  y: number;
};

type EdgeRoutingPreset = {
  anchorPolicy: EdgeAnchorPolicy;
  tangentPolicy: EdgeTangentPolicy;
  pathKind: EdgePathKind;
};

type EdgeAnchors = {
  start: Point;
  end: Point;
  sourceTangent: Point;
  endTangent: Point;
};

type ShapePort = {
  point: Point;
  outward: Point;
};

const SOURCE_GAP = 6;
const TARGET_GAP = 10;
const CUBIC_SEGMENTS = 24;
const ORTHOGONAL_STUB = 28;
const ORTHOGONAL_CORNER_RADIUS = 14;
const ORTHOGONAL_CORNER_SEGMENTS = 5;
const EPSILON = 0.001;
export const DEFAULT_PARALLEL_EDGE_SPACING = 18;

const routingPresets: Record<EdgeRouting, EdgeRoutingPreset> = {
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

const basisLine = line<Point>()
  .x((point) => point.x)
  .y((point) => point.y)
  .curve(curveBasis);

export function computeEdgePath(edge: CanvasEdge, nodes: RoutedNodeRect[], edgeRouting: EdgeRouting, options: EdgeRoutingOptions = {}): EdgePathGeometry | null {
  return computeEdgePathFromRectMap(edge, new Map(nodes.map((node) => [node.id, node])), edgeRouting, options);
}

function computeEdgePathFromRectMap(edge: CanvasEdge, rectById: Map<string, RoutedNodeRect>, edgeRouting: EdgeRouting, options: EdgeRoutingOptions = {}): EdgePathGeometry | null {
  const from = rectById.get(edge.from);
  const to = rectById.get(edge.to);
  if (!from || !to) return null;

  if (from.id === to.id) return edgeRouting === "mermaid" ? routeMermaidSelfLoop(from, options.lane) : routeSelfLoop(from, options.lane);

  return routeBetweenRects(from, to, edgeRouting, options.lane, edge);
}

export function computeEdgePathMap(edges: CanvasEdge[], nodes: RoutedNodeRect[], edgeRouting: EdgeRouting, options: EdgePathMapOptions = {}): Map<string, EdgePathGeometry> {
  const rectById = new Map(nodes.map((node) => [node.id, node]));
  const lanes = resolveParallelEdgeLanes(edges, nodes, options);
  const geometryById = new Map<string, EdgePathGeometry>();

  for (const edge of edges) {
    const geometry = computeEdgePathFromRectMap(edge, rectById, edgeRouting, { lane: lanes.get(edge.id) });
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

export function computeEdgeDraftPath(source: RoutedNodeRect, target: EdgeDraftTarget, edgeRouting: EdgeRouting): EdgePathGeometry {
  if (target.kind === "node") {
    if (source.id === target.rect.id) return computeEdgeDraftPath(source, { kind: "point", point: rectCenter(target.rect) }, edgeRouting);
    return routeBetweenRects(source, target.rect, edgeRouting);
  }

  return routeToPoint(source, target.point, edgeRouting);
}

export function computeEdgeRetargetPath(
  edge: CanvasEdge,
  nodes: RoutedNodeRect[],
  side: EdgeRetargetSide,
  target: EdgeDraftTarget,
  edgeRouting: EdgeRouting
): EdgePathGeometry | null {
  const fixedNodeId = side === "from" ? edge.to : edge.from;
  const fixed = nodes.find((node) => node.id === fixedNodeId);
  if (!fixed) return null;

  if (side === "to") {
    if (target.kind === "node" && target.rect.id === fixed.id) return routeSelfLoop(fixed);
    return computeEdgeDraftPath(fixed, target, edgeRouting);
  }

  if (target.kind === "node") {
    if (target.rect.id === fixed.id) return routeSelfLoop(fixed);
    return routeBetweenRects(target.rect, fixed, edgeRouting);
  }

  return routeFromPointToRect(target.point, fixed, edgeRouting);
}

export function remapEdgePathGeometry(route: EdgePathGeometry, fallback: EdgePathGeometry): EdgePathGeometry {
  const routePoints = unflattenPoints(route.points);
  if (routePoints.length < 2) return fallback;

  const sourceVector = { x: route.end.x - route.start.x, y: route.end.y - route.start.y };
  const targetVector = { x: fallback.end.x - fallback.start.x, y: fallback.end.y - fallback.start.y };
  const sourceLength = Math.hypot(sourceVector.x, sourceVector.y);
  const targetLength = Math.hypot(targetVector.x, targetVector.y);
  if (sourceLength < EPSILON || targetLength < EPSILON) return fallback;

  const sourceAngle = Math.atan2(sourceVector.y, sourceVector.x);
  const targetAngle = Math.atan2(targetVector.y, targetVector.x);
  const scale = targetLength / sourceLength;
  const angle = targetAngle - sourceAngle;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const transformed = routePoints.map((point) => {
    const relative = {
      x: (point.x - route.start.x) * scale,
      y: (point.y - route.start.y) * scale
    };

    return {
      x: fallback.start.x + relative.x * cos - relative.y * sin,
      y: fallback.start.y + relative.x * sin + relative.y * cos
    };
  });

  transformed[0] = fallback.start;
  transformed[transformed.length - 1] = fallback.end;

  return buildGeometry(transformed, fallback.start, fallback.end, fallback.endTangent, basisLine(transformed) || undefined);
}

function routeBetweenRects(from: RoutedNodeRect, to: RoutedNodeRect, edgeRouting: EdgeRouting, lane?: EdgeLaneAssignment, edge?: Pick<CanvasEdge, "fromAnchor" | "toAnchor">): EdgePathGeometry {
  const preset = routingPresets[edgeRouting];
  const anchors = computeAnchorsForPreset(from, to, preset, lane, edge);

  if (preset.pathKind === "cubic-bezier") return routeCubicBezier(anchors);
  if (preset.pathKind === "rounded-orthogonal") return routeRoundedOrthogonal(anchors);
  if (preset.pathKind === "basis-spline") return routeBasisSpline(anchors);

  return buildGeometry([anchors.start, anchors.end], anchors.start, anchors.end, anchors.endTangent);
}

function routeToPoint(from: RoutedNodeRect, point: Point, edgeRouting: EdgeRouting): EdgePathGeometry {
  const preset = routingPresets[edgeRouting];
  const anchors = computePointAnchorsForPreset(from, point, preset);

  if (preset.pathKind === "cubic-bezier") return routeCubicBezier(anchors);
  if (preset.pathKind === "rounded-orthogonal") return routeRoundedOrthogonal(anchors);
  if (preset.pathKind === "basis-spline") return routeBasisSpline(anchors);

  return buildGeometry([anchors.start, anchors.end], anchors.start, anchors.end, anchors.endTangent);
}

function routeFromPointToRect(point: Point, to: RoutedNodeRect, edgeRouting: EdgeRouting): EdgePathGeometry {
  const reversed = routeToPoint(to, point, edgeRouting);
  const points = unflattenPoints(reversed.points).reverse();

  return buildGeometry(points, reversed.end, reversed.start, multiply(reversed.endTangent, -1));
}

function computeAnchorsForPreset(from: RoutedNodeRect, to: RoutedNodeRect, preset: EdgeRoutingPreset, lane?: EdgeLaneAssignment, edge?: Pick<CanvasEdge, "fromAnchor" | "toAnchor">): EdgeAnchors {
  const autoAnchors = preset.anchorPolicy === "fixed-port" ? computeFixedPortAnchors(from, to, effectiveLaneOffset(lane)) : computeBoundaryRayAnchors(from, to, effectiveLaneOffset(lane));
  const sourcePort = edge?.fromAnchor ? shapePortByKey(from, edge.fromAnchor) : null;
  const targetPort = edge?.toAnchor ? shapePortByKey(to, edge.toAnchor) : null;
  if (!sourcePort && !targetPort) return autoAnchors;

  return {
    start: sourcePort ? add(sourcePort.point, multiply(sourcePort.outward, SOURCE_GAP)) : autoAnchors.start,
    end: targetPort ? add(targetPort.point, multiply(targetPort.outward, TARGET_GAP)) : autoAnchors.end,
    sourceTangent: sourcePort ? sourcePort.outward : autoAnchors.sourceTangent,
    endTangent: targetPort ? multiply(targetPort.outward, -1) : autoAnchors.endTangent
  };
}

function computePointAnchorsForPreset(from: RoutedNodeRect, point: Point, preset: EdgeRoutingPreset): EdgeAnchors {
  if (preset.anchorPolicy === "fixed-port") return computeFixedPortPointAnchors(from, point);
  return computeBoundaryRayPointAnchors(from, point);
}

function computeBoundaryRayAnchors(from: RoutedNodeRect, to: RoutedNodeRect, laneOffset = 0): EdgeAnchors {
  const fromCenter = rectCenter(from);
  const toCenter = rectCenter(to);
  const direction = normalize({ x: toCenter.x - fromCenter.x, y: toCenter.y - fromCenter.y }, { x: 1, y: 0 });
  const normal = perpendicular(direction);
  const displacement = multiply(normal, laneOffset);
  const startBase = add(fromCenter, displacement);
  const endBase = add(toCenter, displacement);
  const startBoundary = Math.abs(laneOffset) > EPSILON ? intersectShapeBoundaryFromRay(from, startBase, direction) : intersectShapeBoundary(from, direction);
  const endBoundary = Math.abs(laneOffset) > EPSILON ? intersectShapeBoundaryFromRay(to, endBase, multiply(direction, -1)) : intersectShapeBoundary(to, multiply(direction, -1));
  const start = add(startBoundary, multiply(direction, SOURCE_GAP));
  const end = add(endBoundary, multiply(direction, -TARGET_GAP));

  return {
    start,
    end,
    sourceTangent: direction,
    endTangent: direction
  };
}

function computeBoundaryRayPointAnchors(from: RoutedNodeRect, point: Point): EdgeAnchors {
  const fromCenter = rectCenter(from);
  const direction = normalize({ x: point.x - fromCenter.x, y: point.y - fromCenter.y }, { x: 1, y: 0 });
  const start = add(intersectShapeBoundary(from, direction), multiply(direction, SOURCE_GAP));

  return {
    start,
    end: point,
    sourceTangent: direction,
    endTangent: direction
  };
}

function computeFixedPortAnchors(from: RoutedNodeRect, to: RoutedNodeRect, laneOffset = 0): EdgeAnchors {
  const fromCenter = rectCenter(from);
  const toCenter = rectCenter(to);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const direction = normalize({ x: dx, y: dy }, { x: 1, y: 0 });
  const displacement = multiply(perpendicular(direction), laneOffset);
  const sourcePort = shapePort(from, { x: dx, y: dy });
  const targetPort = shapePort(to, { x: -dx, y: -dy });
  const start = add(add(sourcePort.point, displacement), multiply(sourcePort.outward, SOURCE_GAP));
  const end = add(add(targetPort.point, displacement), multiply(targetPort.outward, TARGET_GAP));

  return {
    start,
    end,
    sourceTangent: sourcePort.outward,
    endTangent: multiply(targetPort.outward, -1)
  };
}

function computeFixedPortPointAnchors(from: RoutedNodeRect, point: Point): EdgeAnchors {
  const fromCenter = rectCenter(from);
  const dx = point.x - fromCenter.x;
  const dy = point.y - fromCenter.y;
  const sourcePort = shapePort(from, { x: dx, y: dy });
  const start = add(sourcePort.point, multiply(sourcePort.outward, SOURCE_GAP));

  return {
    start,
    end: point,
    sourceTangent: sourcePort.outward,
    endTangent: sourcePort.outward
  };
}

function routeCubicBezier(anchors: EdgeAnchors): EdgePathGeometry {
  const distance = Math.hypot(anchors.end.x - anchors.start.x, anchors.end.y - anchors.start.y);
  const controlDistance = clamp(distance * 0.42, 48, 180);
  const control1 = add(anchors.start, multiply(anchors.sourceTangent, controlDistance));
  const control2 = add(anchors.end, multiply(anchors.endTangent, -controlDistance));
  const sampled = sampleCubic(anchors.start, control1, control2, anchors.end, CUBIC_SEGMENTS);

  return buildGeometry(sampled, anchors.start, anchors.end, anchors.endTangent);
}

function routeRoundedOrthogonal(anchors: EdgeAnchors): EdgePathGeometry {
  const exit = add(anchors.start, multiply(anchors.sourceTangent, ORTHOGONAL_STUB));
  const entry = add(anchors.end, multiply(anchors.endTangent, -ORTHOGONAL_STUB));
  const bridge = orthogonalBridgePoints(exit, entry, anchors.sourceTangent, anchors.endTangent);
  const raw = dedupePoints([anchors.start, exit, ...bridge, entry, anchors.end]);

  return buildGeometry(roundPolylineCorners(raw, ORTHOGONAL_CORNER_RADIUS), anchors.start, anchors.end, anchors.endTangent);
}

function routeBasisSpline(anchors: EdgeAnchors): EdgePathGeometry {
  const distance = Math.hypot(anchors.end.x - anchors.start.x, anchors.end.y - anchors.start.y);
  const controlDistance = clamp(distance * 0.36, 42, 160);
  const exit = add(anchors.start, multiply(anchors.sourceTangent, controlDistance));
  const entry = add(anchors.end, multiply(anchors.endTangent, -controlDistance));
  const bridge = orthogonalBridgePoints(exit, entry, anchors.sourceTangent, anchors.endTangent);
  const routePoints = dedupePoints([anchors.start, exit, ...bridge, entry, anchors.end]);
  const pathData = basisLine(routePoints) || undefined;

  return buildGeometry(routePoints, anchors.start, anchors.end, anchors.endTangent, pathData);
}

function orthogonalBridgePoints(start: Point, end: Point, startTangent: Point, endTangent: Point): Point[] {
  if (isMostlyHorizontal(startTangent) && isMostlyHorizontal(endTangent)) {
    const midX = (start.x + end.x) / 2;
    return [
      { x: midX, y: start.y },
      { x: midX, y: end.y }
    ];
  }

  if (!isMostlyHorizontal(startTangent) && !isMostlyHorizontal(endTangent)) {
    const midY = (start.y + end.y) / 2;
    return [
      { x: start.x, y: midY },
      { x: end.x, y: midY }
    ];
  }

  if (isMostlyHorizontal(startTangent)) return [{ x: end.x, y: start.y }];

  return [{ x: start.x, y: end.y }];
}

function roundPolylineCorners(points: Point[], radius: number): Point[] {
  if (points.length < 3) return points;

  const rounded: Point[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const previousLength = distance(previous, current);
    const nextLength = distance(current, next);
    const turnRadius = Math.min(radius, previousLength / 2, nextLength / 2);

    if (turnRadius < EPSILON || isCollinear(previous, current, next)) {
      rounded.push(current);
      continue;
    }

    const before = add(current, multiply(normalize({ x: previous.x - current.x, y: previous.y - current.y }, { x: 0, y: 0 }), turnRadius));
    const after = add(current, multiply(normalize({ x: next.x - current.x, y: next.y - current.y }, { x: 0, y: 0 }), turnRadius));
    rounded.push(before);

    for (let segment = 1; segment <= ORTHOGONAL_CORNER_SEGMENTS; segment += 1) {
      const t = segment / ORTHOGONAL_CORNER_SEGMENTS;
      rounded.push(sampleQuadratic(before, current, after, t));
    }
  }

  rounded.push(points[points.length - 1]);
  return dedupePoints(rounded);
}

function routeSelfLoop(node: RoutedNodeRect, lane?: EdgeLaneAssignment): EdgePathGeometry {
  const right = node.x + node.width;
  const laneOffset = lane?.laneOffset ?? 0;
  const spread = Math.abs(laneOffset);
  const yShift = laneOffset * 0.42;
  const upperY = node.y + node.height * 0.35 + yShift;
  const lowerY = node.y + node.height * 0.65 + yShift;
  const start = { x: right + SOURCE_GAP + spread * 0.12, y: upperY };
  const end = { x: right + TARGET_GAP + spread * 0.12, y: lowerY };
  const controlX = right + 84 + spread * 1.35;
  const control1 = { x: controlX, y: upperY };
  const control2 = { x: controlX, y: lowerY };
  const endTangent = normalize({ x: end.x - control2.x, y: end.y - control2.y }, { x: -1, y: 0 });

  return buildGeometry(sampleCubic(start, control1, control2, end, CUBIC_SEGMENTS), start, end, endTangent);
}

function routeMermaidSelfLoop(node: RoutedNodeRect, lane?: EdgeLaneAssignment): EdgePathGeometry {
  const right = node.x + node.width;
  const laneOffset = lane?.laneOffset ?? 0;
  const spread = Math.abs(laneOffset);
  const yShift = laneOffset * 0.42;
  const upperY = node.y + node.height * 0.35 + yShift;
  const lowerY = node.y + node.height * 0.65 + yShift;
  const start = { x: right + SOURCE_GAP + spread * 0.12, y: upperY };
  const end = { x: right + TARGET_GAP + spread * 0.12, y: lowerY };
  const controlX = right + 84 + spread * 1.35;
  const control1 = { x: controlX, y: upperY };
  const control2 = { x: controlX, y: lowerY };
  const points = [start, control1, control2, end];
  const endTangent = normalize({ x: end.x - control2.x, y: end.y - control2.y }, { x: -1, y: 0 });

  return buildGeometry(points, start, end, endTangent, basisLine(points) || undefined);
}

function buildGeometry(points: Point[], start: Point, end: Point, endTangent: Point, pathData?: string): EdgePathGeometry {
  const safePoints = dedupePoints(points);
  const labelPoint = pointAtHalfLength(safePoints);
  const startTangent = safePoints.length > 1 ? normalize({ x: safePoints[1].x - safePoints[0].x, y: safePoints[1].y - safePoints[0].y }, { x: 1, y: 0 }) : { x: 1, y: 0 };

  return {
    points: flattenPoints(safePoints),
    pathData,
    labelPoint,
    start,
    end,
    startTangent,
    endTangent
  };
}

function pointAtHalfLength(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }

  if (total < EPSILON) return points[0];

  let traveled = 0;
  const target = total / 2;
  for (let index = 1; index < points.length; index += 1) {
    const segmentLength = distance(points[index - 1], points[index]);
    if (traveled + segmentLength >= target) {
      const ratio = (target - traveled) / Math.max(segmentLength, EPSILON);
      return lerp(points[index - 1], points[index], ratio);
    }
    traveled += segmentLength;
  }

  return points[points.length - 1];
}

function intersectShapeBoundary(rect: RoutedNodeRect, direction: Point): Point {
  const shape = normalizeFlowchartShape(rect.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  if (isEllipseLikeFlowchartShape(shape)) return intersectEllipseBoundary(rect, direction);

  const polygon = polygonBoundaryPoints(rect, shape);
  if (polygon.length) return intersectPolygonBoundary(rect, polygon, direction);

  return intersectRectBoundary(rect, direction);
}

function intersectShapeBoundaryFromRay(rect: RoutedNodeRect, origin: Point, direction: Point): Point {
  const shape = normalizeFlowchartShape(rect.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  if (isEllipseLikeFlowchartShape(shape)) return intersectEllipseBoundaryFromRay(rect, origin, direction) || intersectShapeBoundary(rect, direction);

  const polygon = polygonBoundaryPoints(rect, shape);
  const points = polygon.length ? polygon : rectBoundaryPoints(rect);
  const far = add(origin, multiply(direction, Math.max(rect.width, rect.height) * 4));
  let best: Point | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const intersection = lineSegmentIntersection(origin, far, start, end);
    if (!intersection) continue;

    const currentDistance = distance(origin, intersection);
    if (currentDistance < bestDistance) {
      best = intersection;
      bestDistance = currentDistance;
    }
  }

  return best || intersectShapeBoundary(rect, direction);
}

function intersectEllipseBoundaryFromRay(rect: RoutedNodeRect, origin: Point, direction: Point): Point | null {
  const center = rectCenter(rect);
  const radiusX = rect.width / 2;
  const radiusY = rect.height / 2;
  if (radiusX < EPSILON || radiusY < EPSILON) return null;

  const x = origin.x - center.x;
  const y = origin.y - center.y;
  const a = (direction.x * direction.x) / (radiusX * radiusX) + (direction.y * direction.y) / (radiusY * radiusY);
  const b = (2 * x * direction.x) / (radiusX * radiusX) + (2 * y * direction.y) / (radiusY * radiusY);
  const c = (x * x) / (radiusX * radiusX) + (y * y) / (radiusY * radiusY) - 1;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0 || Math.abs(a) < EPSILON) return null;

  const root = Math.sqrt(discriminant);
  const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter((value) => value >= -EPSILON).sort((left, right) => left - right);
  const t = candidates[0];
  if (t === undefined) return null;

  return add(origin, multiply(direction, Math.max(0, t)));
}

function rectBoundaryPoints(rect: RoutedNodeRect): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
}

function shapePort(rect: RoutedNodeRect, direction: Point): ShapePort {
  const shape = normalizeFlowchartShape(rect.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  const normalizedDirection = normalize(direction, { x: 1, y: 0 });
  const ports = flowchartPortPoints(shape, rect);
  let best: ShapePort | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const port of ports) {
    const score = dot(port.outward, normalizedDirection) + port.scoreBias;
    if (score <= bestScore) continue;

    bestScore = score;
    best = { point: toPoint(port.point), outward: toPoint(port.outward) };
  }

  return best || { point: rectCenter(rect), outward: normalizedDirection };
}

function shapePortByKey(rect: RoutedNodeRect, key: string): ShapePort | null {
  const shape = normalizeFlowchartShape(rect.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  const port = flowchartPortPoints(shape, rect).find((item) => item.key === key);
  return port ? { point: toPoint(port.point), outward: toPoint(port.outward) } : null;
}

function intersectRectBoundary(rect: RoutedNodeRect, direction: Point): Point {
  const center = rectCenter(rect);
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const scaleX = Math.abs(direction.x) > EPSILON ? halfWidth / Math.abs(direction.x) : Number.POSITIVE_INFINITY;
  const scaleY = Math.abs(direction.y) > EPSILON ? halfHeight / Math.abs(direction.y) : Number.POSITIVE_INFINITY;
  const scale = Math.min(scaleX, scaleY);

  return {
    x: center.x + direction.x * scale,
    y: center.y + direction.y * scale
  };
}

function intersectEllipseBoundary(rect: RoutedNodeRect, direction: Point): Point {
  return ellipseBoundaryPoint(rect, direction);
}

function intersectPolygonBoundary(rect: RoutedNodeRect, points: Point[], direction: Point): Point {
  const center = rectCenter(rect);
  const far = add(center, multiply(direction, Math.max(rect.width, rect.height) * 2));
  let best: Point | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const intersection = lineSegmentIntersection(center, far, start, end);
    if (!intersection) continue;

    const currentDistance = distance(center, intersection);
    if (currentDistance < bestDistance) {
      best = intersection;
      bestDistance = currentDistance;
    }
  }

  return best || intersectRectBoundary(rect, direction);
}

function polygonBoundaryPoints(rect: RoutedNodeRect, shape: FlowchartNodeShape): Point[] {
  return flowchartPolygonPoints(shape, rect).map(toPoint);
}

function toPoint(point: ShapeGeometryPoint): Point {
  return { x: point.x, y: point.y };
}

function lineSegmentIntersection(p1: Point, p2: Point, q1: Point, q2: Point): Point | null {
  const s1 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const s2 = { x: q2.x - q1.x, y: q2.y - q1.y };
  const denominator = -s2.x * s1.y + s1.x * s2.y;
  if (Math.abs(denominator) < EPSILON) return null;

  const s = (-s1.y * (p1.x - q1.x) + s1.x * (p1.y - q1.y)) / denominator;
  const t = (s2.x * (p1.y - q1.y) - s2.y * (p1.x - q1.x)) / denominator;
  if (s < -EPSILON || s > 1 + EPSILON || t < -EPSILON || t > 1 + EPSILON) return null;

  return {
    x: p1.x + t * s1.x,
    y: p1.y + t * s1.y
  };
}

function rectCenter(rect: RoutedNodeRect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function sampleCubic(start: Point, control1: Point, control2: Point, end: Point, segments: number): Point[] {
  const points: Point[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const inverse = 1 - t;
    points.push({
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x + 3 * inverse * t ** 2 * control2.x + t ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y + 3 * inverse * t ** 2 * control2.y + t ** 3 * end.y
    });
  }
  return points;
}

function sampleQuadratic(start: Point, control: Point, end: Point, t: number): Point {
  const inverse = 1 - t;
  return {
    x: inverse ** 2 * start.x + 2 * inverse * t * control.x + t ** 2 * end.x,
    y: inverse ** 2 * start.y + 2 * inverse * t * control.y + t ** 2 * end.y
  };
}

function isMostlyHorizontal(point: Point) {
  return Math.abs(point.x) >= Math.abs(point.y);
}

function isCollinear(a: Point, b: Point, c: Point) {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < EPSILON;
}

function normalize(point: Point, fallback: Point): Point {
  const length = Math.hypot(point.x, point.y);
  if (length < EPSILON) return fallback;

  return {
    x: point.x / length,
    y: point.y / length
  };
}

function perpendicular(point: Point): Point {
  return { x: -point.y, y: point.x };
}

function effectiveLaneOffset(lane: EdgeLaneAssignment | undefined): number {
  if (!lane || lane.laneCount < 2) return 0;
  return lane.laneOffset * lane.directionSign;
}

function canonicalEdgeEndpoints(from: string, to: string) {
  return from <= to ? { from, to } : { from: to, to: from };
}

function add(a: Point, b: Point): Point {
  return {
    x: a.x + b.x,
    y: a.y + b.y
  };
}

function multiply(point: Point, value: number): Point {
  return {
    x: point.x * value,
    y: point.y * value
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function lerp(a: Point, b: Point, ratio: number): Point {
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function flattenPoints(points: Point[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

function unflattenPoints(points: number[]): Point[] {
  const result: Point[] = [];
  for (let index = 0; index < points.length; index += 2) {
    result.push({ x: points[index], y: points[index + 1] });
  }
  return result;
}

function dedupePoints(points: Point[]): Point[] {
  return points.filter((point, index) => index === 0 || distance(points[index - 1], point) > EPSILON);
}
