import type { FlowchartNodeShape } from "@/features/mermaid-editor/lib/flowchart-shapes";

export type ShapeGeometryPoint = {
  x: number;
  y: number;
};

export type ShapeGeometryRect = ShapeGeometryPoint & {
  width: number;
  height: number;
};

export type ShapeGeometryPort = {
  key: string;
  point: ShapeGeometryPoint;
  outward: ShapeGeometryPoint;
};

export const OPTICAL_WEIGHT_TARGET_AREA_RATIO = Math.PI / 4;

const visibleAreaRatios: Partial<Record<FlowchartNodeShape, number>> = {
  circle: Math.PI / 4,
  "sm-circ": Math.PI / 4,
  "f-circ": Math.PI / 4,
  "dbl-circ": Math.PI / 4,
  "fr-circ": Math.PI / 4,
  "cross-circ": Math.PI / 4,
  diam: 1 / 2,
  hex: (3 * Math.sqrt(3)) / 8,
  tri: Math.sqrt(3) / 4,
  "flip-tri": Math.sqrt(3) / 4
};

export function visibleAreaRatioForShape(shape: FlowchartNodeShape) {
  return visibleAreaRatios[shape] ?? null;
}

export function opticalWeightScaleForShape(shape: FlowchartNodeShape) {
  const areaRatio = visibleAreaRatioForShape(shape);
  if (!areaRatio) return 1;

  return Math.sqrt(OPTICAL_WEIGHT_TARGET_AREA_RATIO / areaRatio);
}

export function isEllipseLikeFlowchartShape(shape: FlowchartNodeShape) {
  return shape === "circle" || shape === "sm-circ" || shape === "f-circ" || shape === "dbl-circ" || shape === "fr-circ" || shape === "cross-circ";
}

export function flowchartPolygonPoints(shape: FlowchartNodeShape, rect: ShapeGeometryRect): ShapeGeometryPoint[] {
  const { x, y, width, height } = rect;

  function point(px: number, py: number): ShapeGeometryPoint {
    return { x: x + width * px, y: y + height * py };
  }

  if (shape === "diam") return [point(0.5, 0), point(1, 0.5), point(0.5, 1), point(0, 0.5)];
  if (shape === "hex") return regularHexagonPoints(rect);
  if (shape === "lean-r") return [point(0.18, 0), point(1, 0), point(0.82, 1), point(0, 1)];
  if (shape === "lean-l") return [point(0, 0), point(0.82, 0), point(1, 1), point(0.18, 1)];
  if (shape === "trap-b") return [point(0.18, 0), point(0.82, 0), point(1, 1), point(0, 1)];
  if (shape === "trap-t") return [point(0, 0), point(1, 0), point(0.82, 1), point(0.18, 1)];
  if (shape === "tri") return regularTrianglePoints(rect, false);
  if (shape === "flip-tri") return regularTrianglePoints(rect, true);
  if (shape === "hourglass") return [point(0, 0), point(1, 0), point(0.58, 0.5), point(1, 1), point(0, 1), point(0.42, 0.5)];
  if (shape === "notch-pent") return [point(0, 0), point(1, 0), point(1, 1), point(0.5, 0.82), point(0, 1)];
  if (shape === "sl-rect") return [point(0.16, 0), point(1, 0), point(0.84, 1), point(0, 1)];
  if (shape === "bow-rect") return [point(0, 0), point(0.78, 0), point(1, 0.5), point(0.78, 1), point(0, 1), point(0.18, 0.5)];
  if (shape === "odd") return [point(0, 0), point(0.86, 0), point(1, 0.5), point(0.86, 1), point(0, 1), point(0.14, 0.5)];
  if (shape === "bang") return [point(0.16, 0), point(0.84, 0), point(1, 0.28), point(0.7, 1), point(0.3, 1), point(0, 0.28)];
  if (shape === "bolt") return [point(0.56, 0), point(0.18, 0.52), point(0.48, 0.52), point(0.36, 1), point(0.82, 0.38), point(0.54, 0.38)];
  if (shape === "notch-rect") return [point(0, 0), point(0.82, 0), point(1, 0.18), point(1, 1), point(0, 1)];

  return [];
}

export function flattenShapePoints(points: ShapeGeometryPoint[]) {
  return points.flatMap((point) => [point.x, point.y]);
}

export function flowchartPortPoints(shape: FlowchartNodeShape, rect: ShapeGeometryRect): ShapeGeometryPort[] {
  const polygon = flowchartPolygonPoints(shape, rect);
  if (polygon.length) return polygonPorts(polygon);
  if (isEllipseLikeFlowchartShape(shape)) return ellipsePorts(rect);

  return rectPorts(rect);
}

function polygonPorts(points: ShapeGeometryPoint[]): ShapeGeometryPort[] {
  const center = polygonCenter(points);
  const ports: ShapeGeometryPort[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const edge = { x: end.x - start.x, y: end.y - start.y };
    const outward = normalize({ x: edge.y, y: -edge.x }, { x: 1, y: 0 });

    ports.push({
      key: `edge-${index}`,
      point: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
      },
      outward
    });
    ports.push({
      key: `vertex-${index}`,
      point: start,
      outward: normalize({ x: start.x - center.x, y: start.y - center.y }, outward)
    });
  }

  return ports;
}

function ellipsePorts(rect: ShapeGeometryRect): ShapeGeometryPort[] {
  return [
    { key: "right", outward: { x: 1, y: 0 } },
    { key: "bottom-right", outward: normalize({ x: 1, y: 1 }, { x: 1, y: 0 }) },
    { key: "bottom", outward: { x: 0, y: 1 } },
    { key: "bottom-left", outward: normalize({ x: -1, y: 1 }, { x: -1, y: 0 }) },
    { key: "left", outward: { x: -1, y: 0 } },
    { key: "top-left", outward: normalize({ x: -1, y: -1 }, { x: -1, y: 0 }) },
    { key: "top", outward: { x: 0, y: -1 } },
    { key: "top-right", outward: normalize({ x: 1, y: -1 }, { x: 1, y: 0 }) }
  ].map((port) => ({
    ...port,
    point: ellipseBoundaryPoint(rect, port.outward)
  }));
}

function rectPorts(rect: ShapeGeometryRect): ShapeGeometryPort[] {
  const center = rectCenter(rect);
  const candidates = [
    { key: "top", point: { x: rect.x + rect.width / 2, y: rect.y } },
    { key: "top-right", point: { x: rect.x + rect.width, y: rect.y } },
    { key: "right", point: { x: rect.x + rect.width, y: rect.y + rect.height / 2 } },
    { key: "bottom-right", point: { x: rect.x + rect.width, y: rect.y + rect.height } },
    { key: "bottom", point: { x: rect.x + rect.width / 2, y: rect.y + rect.height } },
    { key: "bottom-left", point: { x: rect.x, y: rect.y + rect.height } },
    { key: "left", point: { x: rect.x, y: rect.y + rect.height / 2 } },
    { key: "top-left", point: { x: rect.x, y: rect.y } }
  ];

  return candidates.map((candidate) => ({
    ...candidate,
    outward: normalize({ x: candidate.point.x - center.x, y: candidate.point.y - center.y }, { x: 1, y: 0 })
  }));
}

export function ellipseBoundaryPoint(rect: ShapeGeometryRect, direction: ShapeGeometryPoint): ShapeGeometryPoint {
  const center = rectCenter(rect);
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  const scale = 1 / Math.sqrt((direction.x * direction.x) / (rx * rx) + (direction.y * direction.y) / (ry * ry));

  return {
    x: center.x + direction.x * scale,
    y: center.y + direction.y * scale
  };
}

function regularHexagonPoints(rect: ShapeGeometryRect): ShapeGeometryPoint[] {
  const side = Math.min(rect.width / 2, rect.height / Math.sqrt(3));
  const halfSide = side / 2;
  const halfHeight = (Math.sqrt(3) * side) / 2;
  const center = rectCenter(rect);

  return [
    { x: center.x - halfSide, y: center.y - halfHeight },
    { x: center.x + halfSide, y: center.y - halfHeight },
    { x: center.x + side, y: center.y },
    { x: center.x + halfSide, y: center.y + halfHeight },
    { x: center.x - halfSide, y: center.y + halfHeight },
    { x: center.x - side, y: center.y }
  ];
}

function regularTrianglePoints(rect: ShapeGeometryRect, flipped: boolean): ShapeGeometryPoint[] {
  const side = Math.min(rect.width, (rect.height * 2) / Math.sqrt(3));
  const triangleHeight = (Math.sqrt(3) * side) / 2;
  const center = rectCenter(rect);
  const leftX = center.x - side / 2;
  const rightX = center.x + side / 2;
  const topY = center.y - triangleHeight / 2;
  const bottomY = center.y + triangleHeight / 2;

  if (flipped) {
    return [
      { x: leftX, y: topY },
      { x: rightX, y: topY },
      { x: center.x, y: bottomY }
    ];
  }

  return [
    { x: center.x, y: topY },
    { x: rightX, y: bottomY },
    { x: leftX, y: bottomY }
  ];
}

function polygonCenter(points: ShapeGeometryPoint[]): ShapeGeometryPoint {
  return {
    x: points.reduce((total, point) => total + point.x, 0) / points.length,
    y: points.reduce((total, point) => total + point.y, 0) / points.length
  };
}

function rectCenter(rect: ShapeGeometryRect): ShapeGeometryPoint {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function normalize(point: ShapeGeometryPoint, fallback: ShapeGeometryPoint): ShapeGeometryPoint {
  const length = Math.hypot(point.x, point.y);
  if (length === 0) return fallback;

  return {
    x: point.x / length,
    y: point.y / length
  };
}
