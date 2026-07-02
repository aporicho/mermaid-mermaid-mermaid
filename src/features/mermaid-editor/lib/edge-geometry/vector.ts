import { EPSILON, type Point, type RoutedNodeRect } from "@/features/mermaid-editor/lib/edge-geometry/types";

export function add(a: Point, b: Point): Point {
  return {
    x: a.x + b.x,
    y: a.y + b.y
  };
}

export function multiply(point: Point, value: number): Point {
  return {
    x: point.x * value,
    y: point.y * value
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function lerp(a: Point, b: Point, ratio: number): Point {
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalize(point: Point, fallback: Point): Point {
  const length = Math.hypot(point.x, point.y);
  if (length < EPSILON) return fallback;

  return {
    x: point.x / length,
    y: point.y / length
  };
}

export function perpendicular(point: Point): Point {
  return { x: -point.y, y: point.x };
}

export function rectCenter(rect: RoutedNodeRect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

export function sampleCubic(start: Point, control1: Point, control2: Point, end: Point, segments: number): Point[] {
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

export function sampleQuadratic(start: Point, control: Point, end: Point, t: number): Point {
  const inverse = 1 - t;
  return {
    x: inverse ** 2 * start.x + 2 * inverse * t * control.x + t ** 2 * end.x,
    y: inverse ** 2 * start.y + 2 * inverse * t * control.y + t ** 2 * end.y
  };
}

export function isMostlyHorizontal(point: Point) {
  return Math.abs(point.x) >= Math.abs(point.y);
}

export function isCollinear(a: Point, b: Point, c: Point) {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < EPSILON;
}

export function lineSegmentIntersection(p1: Point, p2: Point, q1: Point, q2: Point): Point | null {
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

export function flattenPoints(points: Point[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

export function unflattenPoints(points: number[]): Point[] {
  const result: Point[] = [];
  for (let index = 0; index < points.length; index += 2) {
    result.push({ x: points[index], y: points[index + 1] });
  }
  return result;
}

export function dedupePoints(points: Point[]): Point[] {
  return points.filter((point, index) => index === 0 || distance(points[index - 1], point) > EPSILON);
}
