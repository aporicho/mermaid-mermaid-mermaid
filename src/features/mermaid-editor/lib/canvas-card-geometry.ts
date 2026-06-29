export type CanvasCardPathPoint = {
  x: number;
  y: number;
};

export const CANVAS_CARD_SUPERELLIPSE_EXPONENT = 5;
export const CANVAS_CARD_CORNER_SEGMENTS = 8;

export function superellipseRectPathPoints(input: { width: number; height: number; radius: number; exponent?: number; segments?: number }): CanvasCardPathPoint[] {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  const radius = Math.max(0, Math.min(input.radius, width / 2, height / 2));
  const exponent = Math.max(2, input.exponent ?? CANVAS_CARD_SUPERELLIPSE_EXPONENT);
  const segments = Math.max(2, Math.floor(input.segments ?? CANVAS_CARD_CORNER_SEGMENTS));

  if (radius <= 0) {
    return closePath([
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ]);
  }

  const points: CanvasCardPathPoint[] = [
    { x: radius, y: 0 },
    { x: width - radius, y: 0 },
    ...superellipseCornerPoints(width - radius, radius, radius, -Math.PI / 2, 0, exponent, segments),
    { x: width, y: height - radius },
    ...superellipseCornerPoints(width - radius, height - radius, radius, 0, Math.PI / 2, exponent, segments),
    { x: radius, y: height },
    ...superellipseCornerPoints(radius, height - radius, radius, Math.PI / 2, Math.PI, exponent, segments),
    { x: 0, y: radius },
    ...superellipseCornerPoints(radius, radius, radius, Math.PI, Math.PI * 1.5, exponent, segments)
  ];

  return closePath(points);
}

function superellipseCornerPoints(cx: number, cy: number, radius: number, startAngle: number, endAngle: number, exponent: number, segments: number) {
  const points: CanvasCardPathPoint[] = [];
  const power = 2 / exponent;
  for (let index = 1; index <= segments; index += 1) {
    const t = startAngle + ((endAngle - startAngle) * index) / segments;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    points.push({
      x: cx + Math.sign(cos) * radius * Math.abs(cos) ** power,
      y: cy + Math.sign(sin) * radius * Math.abs(sin) ** power
    });
  }
  return points;
}

function closePath(points: CanvasCardPathPoint[]) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || (first.x === last.x && first.y === last.y)) return points;
  return [...points, { ...first }];
}
