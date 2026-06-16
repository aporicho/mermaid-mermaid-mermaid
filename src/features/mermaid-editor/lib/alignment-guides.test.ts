import { describe, expect, it } from "vitest";

import { computeAlignmentSnap, selectionBounds, type AlignmentRect } from "@/features/mermaid-editor/lib/alignment-guides";

const staticRects: AlignmentRect[] = [
  { id: "a", x: 100, y: 120, width: 80, height: 40 },
  { id: "b", x: 280, y: 260, width: 100, height: 60 }
];

describe("alignment guides", () => {
  it("snaps vertical edges within the screen threshold", () => {
    const result = computeAlignmentSnap({ id: "moving", x: 95, y: 20, width: 80, height: 40 }, staticRects, 1);

    expect(result.dx).toBe(5);
    expect(result.dy).toBe(0);
    expect(result.guides).toEqual([{ axis: "x", value: 100, from: 20, to: 160, kind: "edge" }]);
  });

  it("snaps centers when center candidates are closest", () => {
    const result = computeAlignmentSnap({ id: "moving", x: 230, y: 40, width: 100, height: 60 }, staticRects, 1);

    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
    expect(result.guides.some((guide) => guide.axis === "x" && guide.kind === "center" && guide.value === 280)).toBe(true);
  });

  it("does not snap outside the screen threshold", () => {
    const result = computeAlignmentSnap({ id: "moving", x: 92, y: 20, width: 80, height: 40 }, staticRects, 1);

    expect(result.dx).toBe(0);
    expect(result.guides).toHaveLength(0);
  });

  it("keeps screen threshold behavior stable across zoom levels", () => {
    const result = computeAlignmentSnap({ id: "moving", x: 92, y: 20, width: 80, height: 40 }, staticRects, 0.5);

    expect(result.dx).toBe(8);
    expect(result.guides[0].value).toBe(100);
  });

  it("computes selection bounds for multi-node dragging", () => {
    expect(
      selectionBounds([
        { id: "a", x: 10, y: 30, width: 50, height: 20 },
        { id: "b", x: 90, y: 10, width: 30, height: 80 }
      ])
    ).toEqual({ id: "selection", x: 10, y: 10, width: 110, height: 80 });
  });
});
