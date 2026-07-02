import { describe, expect, it } from "vitest";

import { buildNodeGeometry, nodeIntersectsRect, pointInsideNodeFrame, type NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";

const spec: NodeGeometrySpec = {
  minChars: 4,
  maxChars: 12,
  paddingX: 10,
  paddingY: 8,
  lineHeight: 20,
  maxLines: 3,
  measureText: (value) => value.length * 10
};

const node: CanvasNode = {
  id: "node-a",
  label: "Hello",
  x: 100,
  y: 80,
  fill: "#ffffff"
};

function expectPointClose(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 4);
  expect(actual.y).toBeCloseTo(expected.y, 4);
}

describe("node geometry", () => {
  it("builds frame and text box from the same measured text width", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.frame).toEqual({ x: 100, y: 80, width: 70, height: 36 });
    expect(geometry.textBox).toEqual({ x: 10, y: 8, width: 50, height: 20 });
    expect(geometry.routedRect).toEqual({ id: "node-a", x: 100, y: 80, width: 70, height: 36, shape: "rect" });
  });

  it("keeps anchor points in local node coordinates", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.anchorsLocal).toEqual([
      { key: "top", kind: "edge-midpoint", x: 35, y: 0 },
      { key: "top-right", kind: "corner", x: 70, y: 0 },
      { key: "right", kind: "edge-midpoint", x: 70, y: 18 },
      { key: "bottom-right", kind: "corner", x: 70, y: 36 },
      { key: "bottom", kind: "edge-midpoint", x: 35, y: 36 },
      { key: "bottom-left", kind: "corner", x: 0, y: 36 },
      { key: "left", kind: "edge-midpoint", x: 0, y: 18 },
      { key: "top-left", kind: "corner", x: 0, y: 0 }
    ]);
  });

  it("derives world anchors from frame position plus local anchors", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.anchorsWorld).toEqual([
      { key: "top", kind: "edge-midpoint", x: 135, y: 80 },
      { key: "top-right", kind: "corner", x: 170, y: 80 },
      { key: "right", kind: "edge-midpoint", x: 170, y: 98 },
      { key: "bottom-right", kind: "corner", x: 170, y: 116 },
      { key: "bottom", kind: "edge-midpoint", x: 135, y: 116 },
      { key: "bottom-left", kind: "corner", x: 100, y: 116 },
      { key: "left", kind: "edge-midpoint", x: 100, y: 98 },
      { key: "top-left", kind: "corner", x: 100, y: 80 }
    ]);
  });

  it("uses the node frame as the alignment rect without anchor radius", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.alignmentRect).toEqual({ id: "node-a", x: 100, y: 80, width: 70, height: 36 });
  });

  it("uses the same frame for hit testing and marquee intersection", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(pointInsideNodeFrame({ x: 120, y: 90 }, geometry)).toBe(true);
    expect(pointInsideNodeFrame({ x: 99, y: 90 }, geometry)).toBe(false);
    expect(nodeIntersectsRect(geometry, { x: 70, y: 50, width: 20, height: 20 })).toBe(false);
    expect(nodeIntersectsRect(geometry, { x: 90, y: 70, width: 30, height: 30 })).toBe(true);
  });

  it("builds image node geometry from only the image size", () => {
    const geometry = buildNodeGeometry(
      {
        ...node,
        label: "Logo",
        asset: {
          kind: "image",
          src: "assets/logo.png",
          width: 120,
          height: 80,
          preserveAspectRatio: true,
          labelPosition: "bottom"
        }
      },
      spec
    );

    expect(geometry.frame).toEqual({ x: 100, y: 80, width: 120, height: 80 });
    expect(geometry.imageBox).toEqual({ x: 0, y: 0, width: 120, height: 80 });
    expect(geometry.textBox).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(geometry.routedRect).toEqual({ id: "node-a", x: 100, y: 80, width: 120, height: 80, shape: "rect" });
    expect(geometry.anchorsWorld).toEqual([
      { key: "top", kind: "edge-midpoint", x: 160, y: 80 },
      { key: "top-right", kind: "corner", x: 220, y: 80 },
      { key: "right", kind: "edge-midpoint", x: 220, y: 120 },
      { key: "bottom-right", kind: "corner", x: 220, y: 160 },
      { key: "bottom", kind: "edge-midpoint", x: 160, y: 160 },
      { key: "bottom-left", kind: "corner", x: 100, y: 160 },
      { key: "left", kind: "edge-midpoint", x: 100, y: 120 },
      { key: "top-left", kind: "corner", x: 100, y: 80 }
    ]);
  });

  it("caps wrapped text height at the configured maximum line count", () => {
    const geometry = buildNodeGeometry({ ...node, label: "abcdefghijklmnopqrstuvwxyz" }, spec);

    expect(geometry.textBox.height).toBe(60);
    expect(geometry.frame.height).toBe(76);
  });

  it("keeps circle-like nodes in an equal aspect frame", () => {
    const geometry = buildNodeGeometry({ ...node, shape: "circle" }, spec);

    expect(geometry.frame.width).toBe(74);
    expect(geometry.frame.height).toBe(74);
    expect(geometry.textBox).toEqual({ x: 12, y: 27, width: 50, height: 20 });
    expect(geometry.anchorsLocal.map((anchor) => anchor.key)).toEqual(["right", "bottom-right", "bottom", "bottom-left", "left", "top-left", "top", "top-right"]);
    expectPointClose(geometry.anchorsLocal[1], { x: 63.163, y: 63.163 });
    expectPointClose(geometry.anchorsLocal[5], { x: 10.837, y: 10.837 });
  });

  it("sizes diamond nodes as a square with enough room for centered text", () => {
    const geometry = buildNodeGeometry({ ...node, shape: "diam" }, spec);

    expect(geometry.frame.width).toBe(106);
    expect(geometry.frame.height).toBe(106);
    expect(geometry.textBox).toEqual({ x: 28, y: 43, width: 50, height: 20 });
  });

  it("optically balances regular polygon nodes in an equal aspect frame", () => {
    const geometry = buildNodeGeometry({ ...node, shape: "hex" }, spec);

    expect(geometry.frame.width).toBe(77);
    expect(geometry.frame.height).toBe(77);
    expect(geometry.textBox).toEqual({ x: 13.5, y: 28.5, width: 50, height: 20 });
  });

  it("gives equilateral triangles extra optical weight", () => {
    const geometry = buildNodeGeometry({ ...node, shape: "tri" }, spec);

    expect(geometry.frame.width).toBe(95);
    expect(geometry.frame.height).toBe(95);
    expect(geometry.textBox).toEqual({ x: 22.5, y: 37.5, width: 50, height: 20 });
  });
});
