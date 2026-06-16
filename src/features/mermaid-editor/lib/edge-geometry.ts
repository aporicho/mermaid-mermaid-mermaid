import type { CanvasEdge, EdgeRouting } from "@/features/mermaid-editor/lib/editor-types";

export type EdgeAnchorPolicy = "center-ray" | "side-auto";
export type EdgeTangentPolicy = "radial" | "side-normal";
export type EdgePathKind = "straight" | "cubic-bezier";

export type RoutedNodeRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EdgePathGeometry = {
  points: number[];
  labelPoint: Point;
  start: Point;
  end: Point;
  endTangent: Point;
};

export type EdgeDraftTarget = { kind: "node"; rect: RoutedNodeRect } | { kind: "point"; point: Point };
export type EdgeRetargetSide = "from" | "to";

type Point = {
  x: number;
  y: number;
};

type Side = "top" | "right" | "bottom" | "left";

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

const SOURCE_GAP = 6;
const TARGET_GAP = 10;
const CUBIC_SEGMENTS = 24;
const EPSILON = 0.001;

const routingPresets: Record<EdgeRouting, EdgeRoutingPreset> = {
  straight: {
    anchorPolicy: "center-ray",
    tangentPolicy: "radial",
    pathKind: "straight"
  },
  bezier: {
    anchorPolicy: "side-auto",
    tangentPolicy: "side-normal",
    pathKind: "cubic-bezier"
  }
};

export function computeEdgePath(edge: CanvasEdge, nodes: RoutedNodeRect[], edgeRouting: EdgeRouting): EdgePathGeometry | null {
  const from = nodes.find((node) => node.id === edge.from);
  const to = nodes.find((node) => node.id === edge.to);
  if (!from || !to) return null;

  if (from.id === to.id) return routeSelfLoop(from);

  return routeBetweenRects(from, to, edgeRouting);
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

function routeBetweenRects(from: RoutedNodeRect, to: RoutedNodeRect, edgeRouting: EdgeRouting): EdgePathGeometry {
  const preset = routingPresets[edgeRouting];
  const anchors = preset.anchorPolicy === "center-ray" ? computeCenterRayAnchors(from, to) : computeSideAnchors(from, to);

  if (preset.pathKind === "cubic-bezier") return routeCubicBezier(anchors);

  return buildGeometry([anchors.start, anchors.end], anchors.start, anchors.end, anchors.endTangent);
}

function routeToPoint(from: RoutedNodeRect, point: Point, edgeRouting: EdgeRouting): EdgePathGeometry {
  const preset = routingPresets[edgeRouting];
  const anchors = preset.anchorPolicy === "center-ray" ? computeCenterRayPointAnchors(from, point) : computeSidePointAnchors(from, point);

  if (preset.pathKind === "cubic-bezier") return routeCubicBezier(anchors);

  return buildGeometry([anchors.start, anchors.end], anchors.start, anchors.end, anchors.endTangent);
}

function routeFromPointToRect(point: Point, to: RoutedNodeRect, edgeRouting: EdgeRouting): EdgePathGeometry {
  const reversed = routeToPoint(to, point, edgeRouting);
  const points = unflattenPoints(reversed.points).reverse();

  return buildGeometry(points, reversed.end, reversed.start, multiply(reversed.endTangent, -1));
}

function computeCenterRayAnchors(from: RoutedNodeRect, to: RoutedNodeRect): EdgeAnchors {
  const fromCenter = rectCenter(from);
  const toCenter = rectCenter(to);
  const direction = normalize({ x: toCenter.x - fromCenter.x, y: toCenter.y - fromCenter.y }, { x: 1, y: 0 });
  const start = add(intersectRectBoundary(from, direction), multiply(direction, SOURCE_GAP));
  const end = add(intersectRectBoundary(to, multiply(direction, -1)), multiply(direction, -TARGET_GAP));

  return {
    start,
    end,
    sourceTangent: direction,
    endTangent: direction
  };
}

function computeCenterRayPointAnchors(from: RoutedNodeRect, point: Point): EdgeAnchors {
  const fromCenter = rectCenter(from);
  const direction = normalize({ x: point.x - fromCenter.x, y: point.y - fromCenter.y }, { x: 1, y: 0 });
  const start = add(intersectRectBoundary(from, direction), multiply(direction, SOURCE_GAP));

  return {
    start,
    end: point,
    sourceTangent: direction,
    endTangent: direction
  };
}

function computeSideAnchors(from: RoutedNodeRect, to: RoutedNodeRect): EdgeAnchors {
  const fromCenter = rectCenter(from);
  const toCenter = rectCenter(to);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const sourceSide = sideForDelta(dx, dy);
  const targetSide: Side = oppositeSide(sourceSide);
  const sourceTangent = sideNormal(sourceSide);
  const endTangent = sourceTangent;
  const start = add(sidePoint(from, sourceSide), multiply(sourceTangent, SOURCE_GAP));
  const end = add(sidePoint(to, targetSide), multiply(endTangent, -TARGET_GAP));

  return {
    start,
    end,
    sourceTangent,
    endTangent
  };
}

function computeSidePointAnchors(from: RoutedNodeRect, point: Point): EdgeAnchors {
  const fromCenter = rectCenter(from);
  const dx = point.x - fromCenter.x;
  const dy = point.y - fromCenter.y;
  const sourceSide = sideForDelta(dx, dy);
  const sourceTangent = sideNormal(sourceSide);
  const start = add(sidePoint(from, sourceSide), multiply(sourceTangent, SOURCE_GAP));

  return {
    start,
    end: point,
    sourceTangent,
    endTangent: sourceTangent
  };
}

function sideForDelta(dx: number, dy: number): Side {
  const useHorizontal = Math.abs(dx) >= Math.abs(dy);
  return useHorizontal ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "bottom" : "top";
}

function routeCubicBezier(anchors: EdgeAnchors): EdgePathGeometry {
  const distance = Math.hypot(anchors.end.x - anchors.start.x, anchors.end.y - anchors.start.y);
  const controlDistance = clamp(distance * 0.42, 48, 180);
  const control1 = add(anchors.start, multiply(anchors.sourceTangent, controlDistance));
  const control2 = add(anchors.end, multiply(anchors.endTangent, -controlDistance));
  const sampled = sampleCubic(anchors.start, control1, control2, anchors.end, CUBIC_SEGMENTS);

  return buildGeometry(sampled, anchors.start, anchors.end, anchors.endTangent);
}

function routeSelfLoop(node: RoutedNodeRect): EdgePathGeometry {
  const right = node.x + node.width;
  const upperY = node.y + node.height * 0.35;
  const lowerY = node.y + node.height * 0.65;
  const start = { x: right + SOURCE_GAP, y: upperY };
  const end = { x: right + TARGET_GAP, y: lowerY };
  const control1 = { x: right + 84, y: upperY };
  const control2 = { x: right + 84, y: lowerY };
  const endTangent = normalize({ x: end.x - control2.x, y: end.y - control2.y }, { x: -1, y: 0 });

  return buildGeometry(sampleCubic(start, control1, control2, end, CUBIC_SEGMENTS), start, end, endTangent);
}

function buildGeometry(points: Point[], start: Point, end: Point, endTangent: Point): EdgePathGeometry {
  const safePoints = dedupePoints(points);
  const labelPoint = pointAtHalfLength(safePoints);

  return {
    points: flattenPoints(safePoints),
    labelPoint,
    start,
    end,
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

function rectCenter(rect: RoutedNodeRect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function sidePoint(rect: RoutedNodeRect, side: Side): Point {
  if (side === "top") return { x: rect.x + rect.width / 2, y: rect.y };
  if (side === "right") return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  if (side === "bottom") return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  return { x: rect.x, y: rect.y + rect.height / 2 };
}

function sideNormal(side: Side): Point {
  if (side === "top") return { x: 0, y: -1 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "bottom") return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

function oppositeSide(side: Side): Side {
  if (side === "top") return "bottom";
  if (side === "right") return "left";
  if (side === "bottom") return "top";
  return "right";
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

function normalize(point: Point, fallback: Point): Point {
  const length = Math.hypot(point.x, point.y);
  if (length < EPSILON) return fallback;

  return {
    x: point.x / length,
    y: point.y / length
  };
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
