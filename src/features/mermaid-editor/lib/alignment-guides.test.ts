import { describe, expect, it } from "vitest";

import {
  computeAlignmentSnap,
  computeStatefulAlignmentSnapWithIndex,
  createAlignmentSnapIndex,
  selectionBounds,
  type AlignmentRect
} from "@/features/mermaid-editor/lib/alignment-guides";

const staticRects: AlignmentRect[] = [
  { id: "a", x: 100, y: 120, width: 80, height: 40 },
  { id: "b", x: 280, y: 260, width: 100, height: 60 }
];

describe("alignment guides", () => {
  it("snaps vertical edges within the screen threshold", () => {
    const result = computeAlignmentSnap({ id: "moving", x: 95, y: 20, width: 60, height: 40 }, staticRects, 1);

    expect(result.dx).toBe(5);
    expect(result.dy).toBe(0);
    expect(result.guides).toEqual([{ axis: "x", value: 100, from: 20, to: 160, kind: "edge" }]);
  });

  it("snaps vertical centers to vertical centers", () => {
    const result = computeAlignmentSnap({ id: "moving", x: 278, y: 40, width: 100, height: 60 }, staticRects, 1);

    expect(result.dx).toBe(2);
    expect(result.dy).toBe(0);
    expect(result.guides).toEqual([{ axis: "x", value: 330, from: 40, to: 320, kind: "center" }]);
  });

  it("snaps horizontal centers to horizontal centers", () => {
    const result = computeAlignmentSnap({ id: "moving", x: 20, y: 103, width: 100, height: 80 }, staticRects, 1);

    expect(result.dx).toBe(0);
    expect(result.dy).toBe(-3);
    expect(result.guides).toEqual([{ axis: "y", value: 140, from: 20, to: 180, kind: "center" }]);
  });

  it("does not snap centers to unrelated edges", () => {
    const result = computeAlignmentSnap({ id: "moving", x: 227, y: 40, width: 100, height: 60 }, staticRects, 1);

    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
    expect(result.guides).toHaveLength(0);
  });

  it("does not snap outside the screen threshold", () => {
    const result = computeAlignmentSnap({ id: "moving", x: 92, y: 20, width: 80, height: 40 }, staticRects, 1);

    expect(result.dx).toBe(0);
    expect(result.guides).toHaveLength(0);
  });

  it("keeps an acquired target until the wider release threshold is crossed", () => {
    const target: AlignmentRect = { id: "target", x: 100, y: 0, width: 40, height: 40 };
    const index = createAlignmentSnapIndex([target]);
    const acquired = computeStatefulAlignmentSnapWithIndex({ id: "moving", x: 95, y: 80, width: 40, height: 40 }, index, 1);

    expect(acquired.dx).toBe(5);
    expect(acquired.state.x?.targetRectId).toBe("target");

    const held = computeStatefulAlignmentSnapWithIndex({ id: "moving", x: 91, y: 80, width: 40, height: 40 }, index, 1, acquired.state);
    expect(held.dx).toBe(9);
    expect(held.state.x?.targetRectId).toBe("target");

    const released = computeStatefulAlignmentSnapWithIndex({ id: "moving", x: 89, y: 80, width: 40, height: 40 }, index, 1, held.state);
    expect(released.dx).toBe(0);
    expect(released.state.x).toBeUndefined();
  });

  it("can bypass and clear sticky alignment for a direct manipulation frame", () => {
    const index = createAlignmentSnapIndex([{ id: "target", x: 100, y: 0, width: 40, height: 40 }]);
    const acquired = computeStatefulAlignmentSnapWithIndex({ id: "moving", x: 95, y: 80, width: 40, height: 40 }, index, 1);
    const bypassed = computeStatefulAlignmentSnapWithIndex({ id: "moving", x: 95, y: 80, width: 40, height: 40 }, index, 1, acquired.state, { disabled: true });

    expect(bypassed).toEqual({ dx: 0, dy: 0, guides: [], state: {} });
  });

  it("keeps screen threshold behavior stable across zoom levels", () => {
    const result = computeAlignmentSnap({ id: "moving", x: 92, y: 20, width: 60, height: 40 }, staticRects, 0.5);

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
