import { describe, expect, it } from "vitest";

import {
  flowchartPolygonPoints,
  flowchartPortPoints,
  opticalWeightScaleForShape,
  RECT_CORNER_SCORE_PENALTY,
  RECT_EDGE_MIDPOINT_SCORE_BONUS,
  visibleAreaRatioForShape
} from "@/features/mermaid-editor/lib/flowchart-shape-geometry";

function expectPointClose(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 4);
  expect(actual.y).toBeCloseTo(expected.y, 4);
}

describe("flowchart shape geometry", () => {
  it("uses circle area as the optical weight target", () => {
    expect(visibleAreaRatioForShape("circle")).toBeCloseTo(Math.PI / 4, 6);
    expect(opticalWeightScaleForShape("circle")).toBeCloseTo(1, 6);
    expect(opticalWeightScaleForShape("diam")).toBeGreaterThan(1);
    expect(opticalWeightScaleForShape("tri")).toBeGreaterThan(opticalWeightScaleForShape("hex"));
  });

  it("returns a flat-top regular hexagon inside the frame", () => {
    const points = flowchartPolygonPoints("hex", { x: 0, y: 0, width: 100, height: 100 });

    expect(points).toHaveLength(6);
    expectPointClose(points[0], { x: 25, y: 6.6987 });
    expectPointClose(points[2], { x: 100, y: 50 });
    expectPointClose(points[4], { x: 25, y: 93.3013 });
  });

  it("returns equilateral triangle points inside the frame", () => {
    const points = flowchartPolygonPoints("tri", { x: 0, y: 0, width: 100, height: 100 });

    expect(points).toHaveLength(3);
    expectPointClose(points[0], { x: 50, y: 6.6987 });
    expectPointClose(points[1], { x: 100, y: 93.3013 });
    expectPointClose(points[2], { x: 0, y: 93.3013 });
  });

  it("returns edge and vertex ports for polygon shapes", () => {
    const ports = flowchartPortPoints("diam", { x: 0, y: 0, width: 100, height: 100 });

    expect(ports).toHaveLength(8);
    expect(ports.map((port) => port.key)).toEqual(["edge-0", "vertex-0", "edge-1", "vertex-1", "edge-2", "vertex-2", "edge-3", "vertex-3"]);
    expectPointClose(ports[0].point, { x: 75, y: 25 });
    expectPointClose(ports[1].point, { x: 50, y: 0 });
  });

  it("returns eight ports for circle-like shapes", () => {
    const ports = flowchartPortPoints("circle", { x: 0, y: 0, width: 100, height: 100 });

    expect(ports.map((port) => port.key)).toEqual(["right", "bottom-right", "bottom", "bottom-left", "left", "top-left", "top", "top-right"]);
    expect(ports.map((port) => port.kind)).toEqual(["ellipse-cardinal", "ellipse-diagonal", "ellipse-cardinal", "ellipse-diagonal", "ellipse-cardinal", "ellipse-diagonal", "ellipse-cardinal", "ellipse-diagonal"]);
    expectPointClose(ports[1].point, { x: 85.3553, y: 85.3553 });
    expectPointClose(ports[5].point, { x: 14.6447, y: 14.6447 });
  });

  it("marks rectangle midpoint ports as primary and corner ports as secondary", () => {
    const ports = flowchartPortPoints("rect", { x: 0, y: 0, width: 100, height: 80 });

    expect(ports.map((port) => port.kind)).toEqual(["edge-midpoint", "corner", "edge-midpoint", "corner", "edge-midpoint", "corner", "edge-midpoint", "corner"]);
    expect(ports[0].scoreBias).toBe(RECT_EDGE_MIDPOINT_SCORE_BONUS);
    expect(ports[1].scoreBias).toBe(-RECT_CORNER_SCORE_PENALTY);
  });
});
