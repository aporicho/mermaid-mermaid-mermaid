import { describe, expect, it } from "vitest";

import {
  buildEdgeLabelGeometry,
  edgeLabelSingleLineText,
  edgeLabelTextWidth,
  type EdgeLabelGeometrySpec
} from "@/features/mermaid-editor/lib/edge-label-geometry";

const spec: EdgeLabelGeometrySpec = {
  minChars: 4,
  maxChars: 10,
  paddingX: 8,
  height: 26,
  measureText: (value) => value.length * 10
};

describe("edge label geometry", () => {
  it("centers the label frame on the edge label point", () => {
    const geometry = buildEdgeLabelGeometry("Hello", { x: 100, y: 50 }, spec);

    expect(geometry.frame).toEqual({ x: 67, y: 37, width: 66, height: 26 });
    expect(geometry.textBox).toEqual({ x: 8, y: 0, width: 50, height: 26 });
  });

  it("uses a minimum text width for short labels and empty edit values", () => {
    expect(edgeLabelTextWidth("A", spec)).toBe(40);
    expect(edgeLabelTextWidth("", spec)).toBe(40);
  });

  it("caps long labels at the configured maximum text width", () => {
    expect(edgeLabelTextWidth("abcdefghijklmnopqrst", spec)).toBe(100);
  });

  it("normalizes line breaks so labels stay single-line", () => {
    expect(edgeLabelSingleLineText("A\nB\r\nC")).toBe("A B C");
  });
});
