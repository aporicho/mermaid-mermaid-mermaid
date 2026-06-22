import { describe, expect, it } from "vitest";

import {
  computeEdgeDraftPath,
  computeEdgePath,
  computeEdgePathMap,
  computeEdgeRetargetPath,
  remapEdgePathGeometry,
  resolveParallelEdgeLanes,
  type EdgePathGeometry,
  type RoutedNodeRect
} from "@/features/mermaid-editor/lib/edge-geometry";
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

function expectGeometry(map: Map<string, EdgePathGeometry>, edgeId: string) {
  const geometry = map.get(edgeId);
  if (!geometry) throw new Error(`Expected geometry for ${edgeId}`);
  return geometry;
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

  it("uses pinned endpoint anchors when an edge selects node ports", () => {
    const geometry = edgePath("bezier", defaultNodes(), {
      ...baseEdge,
      fromAnchor: "bottom",
      toAnchor: "top"
    });

    expectPointClose(pointAt(geometry.points, 0), { x: 50, y: 56 });
    expectPointClose(lastPoint(geometry.points), { x: 270, y: -10 });
    expectPointClose(geometry.endTangent, { x: 0, y: 1 });
    expectFinitePoints(geometry.points);
  });

  it("falls back to automatic anchors when a pinned port no longer exists", () => {
    const geometry = edgePath("bezier", defaultNodes(), {
      ...baseEdge,
      fromAnchor: "missing-port",
      toAnchor: "right"
    });

    expectPointClose(pointAt(geometry.points, 0), { x: 106, y: 25 });
    expectPointClose(lastPoint(geometry.points), { x: 330, y: 25 });
    expectPointClose(geometry.endTangent, { x: -1, y: 0 });
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

  it("prefers rectangle midpoint ports for ordinary diagonal bezier directions", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 100, shape: "rect" },
      { id: "b", x: 220, y: 120, width: 100, height: 100, shape: "rect" }
    ]);

    expectPointClose(pointAt(geometry.points, 0), { x: 106, y: 50 });
    expectFinitePoints(geometry.points);
  });

  it("still uses rectangle corner ports near a true diagonal", () => {
    const geometry = edgePath("bezier", [
      { id: "a", x: 0, y: 0, width: 100, height: 100, shape: "rect" },
      { id: "b", x: 220, y: 220, width: 100, height: 100, shape: "rect" }
    ]);

    expectPointClose(pointAt(geometry.points, 0), { x: 104.2426, y: 104.2426 });
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

  it("builds manual mermaid routing with continuous boundary anchors", () => {
    const geometry = edgePath("mermaid", [
      { id: "a", x: 0, y: 0, width: 100, height: 50 },
      { id: "b", x: 220, y: 120, width: 100, height: 50 }
    ]);

    expect(geometry.points.length).toBeGreaterThanOrEqual(8);
    expect(geometry.pathData).toMatch(/^M/);
    expectPointClose(pointAt(geometry.points, 0), { x: 101.1007, y: 52.8731 });
    expectPointClose(lastPoint(geometry.points), { x: 215.3877, y: 115.2115 });
    expectFinitePoints(geometry.points);
  });

  it("builds manual mermaid self loops as path geometry", () => {
    const geometry = edgePath(
      "mermaid",
      [{ id: "a", x: 10, y: 20, width: 100, height: 60 }],
      { ...baseEdge, to: "a" }
    );

    expect(geometry.pathData).toMatch(/^M/);
    expect(geometry.endTangent.x).toBeLessThan(0);
    expectFinitePoints(geometry.points);
  });

  it("remaps dagre route templates onto manual edge endpoints", () => {
    const route = edgePath("mermaid", [
      { id: "a", x: 0, y: 0, width: 100, height: 50 },
      { id: "b", x: 220, y: 0, width: 100, height: 50 }
    ]);
    const manual = edgePath("mermaid", [
      { id: "a", x: 30, y: 80, width: 100, height: 50 },
      { id: "b", x: 260, y: 210, width: 100, height: 50 }
    ]);
    const remapped = remapEdgePathGeometry(route, manual);

    expect(remapped.pathData).toMatch(/^M/);
    expectPointClose(pointAt(remapped.points, 0), manual.start);
    expectPointClose(lastPoint(remapped.points), manual.end);
    expectFinitePoints(remapped.points);
  });

  it("routes orthogonal edges with rounded corner samples", () => {
    const geometry = edgePath("orthogonal", [
      { id: "a", x: 0, y: 0, width: 100, height: 50 },
      { id: "b", x: 220, y: 120, width: 100, height: 50 }
    ]);

    expect(geometry.points.length).toBeGreaterThan(8);
    expectPointClose(pointAt(geometry.points, 0), { x: 106, y: 25 });
    expectPointClose(lastPoint(geometry.points), { x: 210, y: 145 });
    expectPointClose(geometry.endTangent, { x: 1, y: 0 });
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

describe("computeEdgePathMap", () => {
  it("separates same-direction parallel straight edges with stable lanes", () => {
    const edges: CanvasEdge[] = [
      { ...baseEdge, id: "edge-1" },
      { ...baseEdge, id: "edge-2" }
    ];
    const lanes = resolveParallelEdgeLanes(edges, defaultNodes(), { laneSpacing: 20 });
    const map = computeEdgePathMap(edges, defaultNodes(), "straight", { laneSpacing: 20 });
    const first = expectGeometry(map, "edge-1");
    const second = expectGeometry(map, "edge-2");

    expect(lanes.get("edge-1")?.laneIndex).toBe(-0.5);
    expect(lanes.get("edge-2")?.laneIndex).toBe(0.5);
    expect(pointAt(first.points, 0).y).toBeLessThan(pointAt(second.points, 0).y);
    expect(first.labelPoint.y).toBeLessThan(second.labelPoint.y);
  });

  it("puts opposite-direction edges in one undirected lane group", () => {
    const edges: CanvasEdge[] = [
      { ...baseEdge, id: "a-to-b", from: "a", to: "b" },
      { ...baseEdge, id: "b-to-a", from: "b", to: "a" }
    ];
    const lanes = resolveParallelEdgeLanes(edges, defaultNodes(), { laneSpacing: 20 });
    const map = computeEdgePathMap(edges, defaultNodes(), "straight", { laneSpacing: 20 });
    const forward = expectGeometry(map, "a-to-b");
    const backward = expectGeometry(map, "b-to-a");

    expect(lanes.get("a-to-b")?.groupKey).toBe(lanes.get("b-to-a")?.groupKey);
    expect(lanes.get("b-to-a")?.directionSign).toBe(-1);
    expect(forward.labelPoint.y).not.toBeCloseTo(backward.labelPoint.y, 4);
    expect(forward.endTangent.x).toBeGreaterThan(0);
    expect(backward.endTangent.x).toBeLessThan(0);
  });

  it("separates every routing mode for repeated edges", () => {
    const edges: CanvasEdge[] = [
      { ...baseEdge, id: "edge-1" },
      { ...baseEdge, id: "edge-2" },
      { ...baseEdge, id: "edge-3" }
    ];

    for (const routing of ["straight", "bezier", "orthogonal", "mermaid"] as const) {
      const map = computeEdgePathMap(edges, defaultNodes(), routing, { laneSpacing: 20 });
      const labels = edges.map((edge) => expectGeometry(map, edge.id).labelPoint.y);

      expect(new Set(labels.map((value) => value.toFixed(3))).size).toBe(3);
      for (const edge of edges) expectFinitePoints(expectGeometry(map, edge.id).points);
    }
  });

  it("fans out repeated self loops", () => {
    const nodes = [{ id: "a", x: 10, y: 20, width: 100, height: 60 }];
    const edges: CanvasEdge[] = [
      { ...baseEdge, id: "loop-1", to: "a" },
      { ...baseEdge, id: "loop-2", to: "a" },
      { ...baseEdge, id: "loop-3", to: "a" }
    ];
    const map = computeEdgePathMap(edges, nodes, "bezier", { laneSpacing: 20 });
    const starts = edges.map((edge) => expectGeometry(map, edge.id).start.y);

    expect(new Set(starts.map((value) => value.toFixed(3))).size).toBe(3);
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

  it("matches completed orthogonal edge geometry when the draft target is a node", () => {
    const nodes = defaultNodes();
    const draft = computeEdgeDraftPath(nodes[0], { kind: "node", rect: nodes[1] }, "orthogonal");
    const completed = edgePath("orthogonal", nodes);

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
    expectPointClose(pointAt(draft.points, 0), { x: 106, y: 25 });
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
