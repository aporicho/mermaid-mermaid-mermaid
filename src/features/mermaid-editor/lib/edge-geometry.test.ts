import { describe, expect, it } from "vitest";

import { computeEdgeDraftPath, computeEdgePath, computeEdgeRetargetPath, type RoutedNodeRect } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasEdge, EdgeRouting } from "@/features/mermaid-editor/lib/editor-types";

const baseEdge: CanvasEdge = {
  id: "edge-1",
  from: "a",
  to: "b",
  label: "",
  style: "solid"
};

function edgePath(edgeRouting: EdgeRouting, nodes: RoutedNodeRect[] = defaultNodes(), edge: CanvasEdge = baseEdge) {
  const geometry = computeEdgePath(edge, nodes, edgeRouting);
  if (!geometry) throw new Error("Expected geometry");
  return geometry;
}

function defaultNodes(): RoutedNodeRect[] {
  return [
    { id: "a", x: 0, y: 0, width: 100, height: 50 },
    { id: "b", x: 220, y: 0, width: 100, height: 50 }
  ];
}

function pointAt(points: number[], index: number) {
  return {
    x: points[index * 2],
    y: points[index * 2 + 1]
  };
}

function lastPoint(points: number[]) {
  return pointAt(points, points.length / 2 - 1);
}

function expectPointClose(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 4);
  expect(actual.y).toBeCloseTo(expected.y, 4);
}

function expectFinitePoints(points: number[]) {
  for (const point of points) {
    expect(Number.isFinite(point)).toBe(true);
  }
}

describe("computeEdgePath", () => {
  it("uses center-ray anchors for straight edges", () => {
    const geometry = edgePath("straight");

    expectPointClose(pointAt(geometry.points, 0), { x: 106, y: 25 });
    expectPointClose(lastPoint(geometry.points), { x: 210, y: 25 });
    expectPointClose(geometry.labelPoint, { x: 158, y: 25 });
    expectPointClose(geometry.endTangent, { x: 1, y: 0 });
  });

  it("uses shape-aware boundaries for straight edges", () => {
    const geometry = edgePath("straight", [
      { id: "a", x: 0, y: 0, width: 100, height: 100, shape: "diam" },
      { id: "b", x: 220, y: 120, width: 100, height: 100, shape: "rect" }
    ]);

    expect(pointAt(geometry.points, 0).x).toBeLessThan(100);
    expect(pointAt(geometry.points, 0).y).toBeLessThan(80);
    expectFinitePoints(geometry.points);
  });

  it("uses side-normal anchors for horizontal bezier edges", () => {
    const geometry = edgePath("bezier");

    expect(geometry.points).toHaveLength(50);
    expectPointClose(pointAt(geometry.points, 0), { x: 106, y: 25 });
    expectPointClose(lastPoint(geometry.points), { x: 210, y: 25 });
    expectPointClose(geometry.endTangent, { x: 1, y: 0 });
    expectFinitePoints(geometry.points);
  });

  it("uses shape-aware boundaries for bezier edge endpoints", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 100, shape: "diam" },
      { id: "b", x: 220, y: 120, width: 100, height: 100, shape: "rect" }
    ]);

    expect(pointAt(geometry.points, 0).x).toBeLessThan(100);
    expect(pointAt(geometry.points, 0).y).toBeGreaterThan(60);
    expectFinitePoints(geometry.points);
  });

  it("uses polygon vertex ports for cardinal bezier directions", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 100, shape: "diam" },
      { id: "b", x: 220, y: 0, width: 100, height: 100, shape: "rect" }
    ]);

    expectPointClose(pointAt(geometry.points, 0), { x: 106, y: 50 });
    expectPointClose(lastPoint(geometry.points), { x: 210, y: 50 });
    expectFinitePoints(geometry.points);
  });

  it("uses regular hexagon boundaries instead of stretching to the square height", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 100, shape: "hex" },
      { id: "b", x: 0, y: -220, width: 100, height: 100, shape: "rect" }
    ]);

    expectPointClose(pointAt(geometry.points, 0), { x: 50, y: 0.6987 });
    expectFinitePoints(geometry.points);
  });

  it("uses regular triangle boundaries instead of stretching to the square height", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 100, shape: "tri" },
      { id: "b", x: 0, y: -220, width: 100, height: 100, shape: "rect" }
    ]);

    expectPointClose(pointAt(geometry.points, 0), { x: 50, y: 0.6987 });
    expectFinitePoints(geometry.points);
  });

  it("uses regular flipped triangle boundaries", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 100, shape: "flip-tri" },
      { id: "b", x: 0, y: 220, width: 100, height: 100, shape: "rect" }
    ]);

    expectPointClose(pointAt(geometry.points, 0), { x: 50, y: 99.3013 });
    expectFinitePoints(geometry.points);
  });

  it("uses eight fixed ports for circle-like bezier endpoints", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 100, shape: "circle" },
      { id: "b", x: 220, y: 120, width: 100, height: 100, shape: "rect" }
    ]);

    expectPointClose(pointAt(geometry.points, 0), { x: 89.598, y: 89.598 });
    expectFinitePoints(geometry.points);
  });

  it("uses rectangle corner ports for diagonal bezier directions", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 100, shape: "rect" },
      { id: "b", x: 220, y: 120, width: 100, height: 100, shape: "rect" }
    ]);

    expect(pointAt(geometry.points, 0).x).toBeGreaterThan(100);
    expect(pointAt(geometry.points, 0).y).toBeGreaterThan(100);
    expectFinitePoints(geometry.points);
  });

  it("uses side-normal anchors for vertical bezier edges", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 50 },
      { id: "b", x: 0, y: 180, width: 100, height: 50 }
    ]);

    expect(geometry.points).toHaveLength(50);
    expectPointClose(pointAt(geometry.points, 0), { x: 50, y: 56 });
    expectPointClose(lastPoint(geometry.points), { x: 50, y: 170 });
    expectPointClose(geometry.endTangent, { x: 0, y: 1 });
    expectFinitePoints(geometry.points);
  });

  it("keeps bezier edges curved for diagonal node positions", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 50 },
      { id: "b", x: 220, y: 120, width: 100, height: 50 }
    ]);
    const middle = pointAt(geometry.points, Math.floor(geometry.points.length / 4));

    expect(middle.x).toBeGreaterThan(geometry.start.x);
    expect(middle.y).toBeLessThan(lastPoint(geometry.points).y);
    expectFinitePoints(geometry.points);
  });

  it("falls back deterministically for self loops", () => {
    const geometry = edgePath(
      "bezier",
      [{ id: "a", x: 10, y: 20, width: 100, height: 60 }],
      { ...baseEdge, to: "a" }
    );

    expect(pointAt(geometry.points, 0).x).toBeGreaterThan(110);
    expect(lastPoint(geometry.points).x).toBeGreaterThan(110);
    expect(geometry.endTangent.x).toBeLessThan(0);
    expectFinitePoints(geometry.points);
  });
});

describe("computeEdgeDraftPath", () => {
  it("matches completed straight edge geometry when the draft target is a node", () => {
    const nodes = defaultNodes();
    const draft = computeEdgeDraftPath(nodes[0], { kind: "node", rect: nodes[1] }, "straight");
    const completed = edgePath("straight", nodes);

    expect(draft.points).toEqual(completed.points);
    expect(draft.labelPoint).toEqual(completed.labelPoint);
  });

  it("matches completed bezier edge geometry when the draft target is a node", () => {
    const nodes = defaultNodes();
    const draft = computeEdgeDraftPath(nodes[0], { kind: "node", rect: nodes[1] }, "bezier");
    const completed = edgePath("bezier", nodes);

    expect(draft.points).toEqual(completed.points);
    expect(draft.labelPoint).toEqual(completed.labelPoint);
  });

  it("uses straight routing style when the draft target is a point", () => {
    const draft = computeEdgeDraftPath(defaultNodes()[0], { kind: "point", point: { x: 260, y: 90 } }, "straight");

    expect(draft.points).toHaveLength(4);
    expectPointClose(pointAt(draft.points, 0), { x: 105.7317, y: 42.2503 });
    expectPointClose(lastPoint(draft.points), { x: 260, y: 90 });
    expectFinitePoints(draft.points);
  });

  it("uses bezier routing style when the draft target is a point", () => {
    const draft = computeEdgeDraftPath(defaultNodes()[0], { kind: "point", point: { x: 260, y: 90 } }, "bezier");
    const middle = pointAt(draft.points, Math.floor(draft.points.length / 4));

    expect(draft.points).toHaveLength(50);
    expectPointClose(pointAt(draft.points, 0), { x: 105.3666, y: 52.6833 });
    expectPointClose(lastPoint(draft.points), { x: 260, y: 90 });
    expect(middle.x).toBeGreaterThan(draft.start.x);
    expectFinitePoints(draft.points);
  });
});

describe("computeEdgeRetargetPath", () => {
  it("keeps the source node fixed while retargeting the destination endpoint", () => {
    const nodes = defaultNodes();
    const geometry = computeEdgeRetargetPath(baseEdge, nodes, "to", { kind: "point", point: { x: 260, y: 90 } }, "straight");

    if (!geometry) throw new Error("Expected geometry");

    expectPointClose(pointAt(geometry.points, 0), { x: 105.7317, y: 42.2503 });
    expectPointClose(lastPoint(geometry.points), { x: 260, y: 90 });
  });

  it("keeps the destination node fixed while retargeting the source endpoint", () => {
    const nodes = defaultNodes();
    const geometry = computeEdgeRetargetPath(baseEdge, nodes, "from", { kind: "point", point: { x: 40, y: 90 } }, "straight");

    if (!geometry) throw new Error("Expected geometry");

    expectPointClose(pointAt(geometry.points, 0), { x: 40, y: 90 });
    expectPointClose(lastPoint(geometry.points), { x: 214.2261, y: 40.7622 });
  });

  it("matches completed geometry when retargeting to a node", () => {
    const nodes = [...defaultNodes(), { id: "c", x: 440, y: 0, width: 100, height: 50 }];
    const geometry = computeEdgeRetargetPath(baseEdge, nodes, "to", { kind: "node", rect: nodes[2] }, "bezier");
    const completed = edgePath("bezier", nodes, { ...baseEdge, to: "c" });

    if (!geometry) throw new Error("Expected geometry");

    expect(geometry.points).toEqual(completed.points);
    expect(geometry.labelPoint).toEqual(completed.labelPoint);
  });

  it("previews a self loop when retargeting an endpoint onto the fixed endpoint node", () => {
    const nodes = defaultNodes();
    const geometry = computeEdgeRetargetPath(baseEdge, nodes, "to", { kind: "node", rect: nodes[0] }, "bezier");
    const completed = edgePath("bezier", nodes, { ...baseEdge, to: "a" });

    if (!geometry) throw new Error("Expected geometry");

    expect(geometry.points).toEqual(completed.points);
    expect(geometry.labelPoint).toEqual(completed.labelPoint);
  });
});
