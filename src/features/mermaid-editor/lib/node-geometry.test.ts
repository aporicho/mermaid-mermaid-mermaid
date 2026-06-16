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

describe("node geometry", () => {
  it("builds frame and text box from the same measured text width", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.frame).toEqual({ x: 100, y: 80, width: 70, height: 36 });
    expect(geometry.textBox).toEqual({ x: 10, y: 8, width: 50, height: 20 });
    expect(geometry.routedRect).toEqual({ id: "node-a", x: 100, y: 80, width: 70, height: 36 });
  });

  it("keeps anchor points in local node coordinates", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.anchorsLocal).toEqual([
      { key: "top", x: 35, y: 0 },
      { key: "right", x: 70, y: 18 },
      { key: "bottom", x: 35, y: 36 },
      { key: "left", x: 0, y: 18 }
    ]);
  });

  it("derives world anchors from frame position plus local anchors", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.anchorsWorld).toEqual([
      { key: "top", x: 135, y: 80 },
      { key: "right", x: 170, y: 98 },
      { key: "bottom", x: 135, y: 116 },
      { key: "left", x: 100, y: 98 }
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

  it("caps wrapped text height at the configured maximum line count", () => {
    const geometry = buildNodeGeometry({ ...node, label: "abcdefghijklmnopqrstuvwxyz" }, spec);

    expect(geometry.textBox.height).toBe(60);
    expect(geometry.frame.height).toBe(76);
  });
});
