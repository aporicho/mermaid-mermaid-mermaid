import type { FlowchartNodeShape } from "@/features/mermaid-editor/lib/editor-types";
import {
  ellipseBoundaryPoint,
  flowchartPolygonPoints,
  flowchartPortPoints,
  isEllipseLikeFlowchartShape,
  type ShapeGeometryPoint
} from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import { DEFAULT_FLOWCHART_NODE_SHAPE, normalizeFlowchartShape } from "@/features/mermaid-editor/lib/flowchart-shapes";
import { EPSILON, type Point, type RoutedNodeRect, type ShapePort } from "@/features/mermaid-editor/lib/edge-geometry/types";
import {
  add,
  distance,
  dot,
  lineSegmentIntersection,
  multiply,
  normalize,
  rectCenter
} from "@/features/mermaid-editor/lib/edge-geometry/vector";

export function intersectShapeBoundary(rect: RoutedNodeRect, direction: Point): Point {
  const shape = normalizeFlowchartShape(rect.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  if (isEllipseLikeFlowchartShape(shape)) return intersectEllipseBoundary(rect, direction);

  const polygon = polygonBoundaryPoints(rect, shape);
  if (polygon.length) return intersectPolygonBoundary(rect, polygon, direction);

  return intersectRectBoundary(rect, direction);
}

export function intersectShapeBoundaryFromRay(rect: RoutedNodeRect, origin: Point, direction: Point): Point {
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

export function shapePort(rect: RoutedNodeRect, direction: Point): ShapePort {
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

export function shapePortByKey(rect: RoutedNodeRect, key: string): ShapePort | null {
  const shape = normalizeFlowchartShape(rect.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  const port = flowchartPortPoints(shape, rect).find((item) => item.key === key);
  return port ? { point: toPoint(port.point), outward: toPoint(port.outward) } : null;
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
