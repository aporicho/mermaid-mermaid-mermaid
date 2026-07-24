import { EPSILON, type Point } from "@/features/mermaid-editor/lib/edge-geometry/types";
import { add, distance, isCollinear, multiply, normalize } from "@/features/mermaid-editor/lib/edge-geometry/vector";

export function cubicPathData(start: Point, control1: Point, control2: Point, end: Point) {
  return `M${numberPair(start)} C${numberPair(control1)} ${numberPair(control2)} ${numberPair(end)}`;
}

export function roundedPolylinePathData(points: Point[], radius: number) {
  if (points.length === 0) return undefined;
  if (points.length === 1) return `M${numberPair(points[0])}`;

  const commands = [`M${numberPair(points[0])}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const turnRadius = Math.min(radius, distance(previous, current) / 2, distance(current, next) / 2);
    if (turnRadius < EPSILON || isCollinear(previous, current, next)) {
      commands.push(`L${numberPair(current)}`);
      continue;
    }

    const before = add(current, multiply(normalize({ x: previous.x - current.x, y: previous.y - current.y }, { x: 0, y: 0 }), turnRadius));
    const after = add(current, multiply(normalize({ x: next.x - current.x, y: next.y - current.y }, { x: 0, y: 0 }), turnRadius));
    commands.push(`L${numberPair(before)}`, `Q${numberPair(current)} ${numberPair(after)}`);
  }
  commands.push(`L${numberPair(points[points.length - 1])}`);
  return commands.join(" ");
}

function numberPair(point: Point) {
  return `${Number(point.x.toFixed(3))},${Number(point.y.toFixed(3))}`;
}
