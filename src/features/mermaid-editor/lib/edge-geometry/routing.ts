import { curveBasis, line } from "d3-shape";

import type { CanvasEdge, EdgeRouting } from "@/features/mermaid-editor/lib/editor-types";
import { effectiveLaneOffset } from "@/features/mermaid-editor/lib/edge-geometry/lanes";
import {
  intersectShapeBoundary,
  intersectShapeBoundaryFromRay,
  shapePort,
  shapePortByKey
} from "@/features/mermaid-editor/lib/edge-geometry/shape-boundary";
import {
  CUBIC_SEGMENTS,
  EPSILON,
  ORTHOGONAL_CORNER_RADIUS,
  ORTHOGONAL_CORNER_SEGMENTS,
  ORTHOGONAL_STUB,
  SOURCE_GAP,
  TARGET_GAP,
  routingPresets,
  type EdgeAnchors,
  type EdgeDraftTarget,
  type EdgeLaneAssignment,
  type EdgePathGeometry,
  type EdgeRetargetSide,
  type EdgeRoutingOptions,
  type EdgeRoutingPreset,
  type Point,
  type RoutedNodeRect
} from "@/features/mermaid-editor/lib/edge-geometry/types";
import {
  add,
  clamp,
  dedupePoints,
  distance,
  flattenPoints,
  isCollinear,
  isMostlyHorizontal,
  lerp,
  multiply,
  normalize,
  perpendicular,
  rectCenter,
  sampleCubic,
  sampleQuadratic,
  unflattenPoints
} from "@/features/mermaid-editor/lib/edge-geometry/vector";

const basisLine = line<Point>()
  .x((point) => point.x)
  .y((point) => point.y)
  .curve(curveBasis);

export function computeEdgePath(edge: CanvasEdge, nodes: RoutedNodeRect[], edgeRouting: EdgeRouting, options: EdgeRoutingOptions = {}): EdgePathGeometry | null {
  return computeEdgePathFromRectMap(edge, new Map(nodes.map((node) => [node.id, node])), edgeRouting, options);
}

export function computeEdgePathFromRectMap(edge: CanvasEdge, rectById: Map<string, RoutedNodeRect>, edgeRouting: EdgeRouting, options: EdgeRoutingOptions = {}): EdgePathGeometry | null {
  const from = rectById.get(edge.from);
  const to = rectById.get(edge.to);
  if (!from || !to) return null;

  if (from.id === to.id) return edgeRouting === "mermaid" ? routeMermaidSelfLoop(from, options.lane) : routeSelfLoop(from, options.lane);

  return routeBetweenRects(from, to, edgeRouting, options.lane, edge);
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
  const distanceValue = Math.hypot(anchors.end.x - anchors.start.x, anchors.end.y - anchors.start.y);
  const controlDistance = clamp(distanceValue * 0.42, 48, 180);
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
  const distanceValue = Math.hypot(anchors.end.x - anchors.start.x, anchors.end.y - anchors.start.y);
  const controlDistance = clamp(distanceValue * 0.36, 42, 160);
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
