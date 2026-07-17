import { describe, expect, it } from "vitest";

import {
  arrangeNodeRects,
  NODE_ALIGNMENT_OPERATIONS,
  NODE_SPACING_OPERATIONS,
  nodeArrangementLabel,
  type NodeArrangementOperation
} from "@/features/mermaid-editor/lib/node-arrangement";
import type { AlignmentRect } from "@/features/mermaid-editor/lib/alignment-guides";

const rects: AlignmentRect[] = [
  { id: "A", x: 10, y: 30, width: 40, height: 20 },
  { id: "B", x: 90, y: 80, width: 60, height: 40 },
  { id: "C", x: 230, y: 170, width: 80, height: 60 }
];

describe("node arrangement", () => {
  it.each<[NodeArrangementOperation, Record<string, { x: number; y: number }>]>([
    ["align-left", { A: { x: 10, y: 30 }, B: { x: 10, y: 80 }, C: { x: 10, y: 170 } }],
    ["align-horizontal-center", { A: { x: 140, y: 30 }, B: { x: 130, y: 80 }, C: { x: 120, y: 170 } }],
    ["align-right", { A: { x: 270, y: 30 }, B: { x: 250, y: 80 }, C: { x: 230, y: 170 } }],
    ["align-top", { A: { x: 10, y: 30 }, B: { x: 90, y: 30 }, C: { x: 230, y: 30 } }],
    ["align-vertical-center", { A: { x: 10, y: 120 }, B: { x: 90, y: 110 }, C: { x: 230, y: 100 } }],
    ["align-bottom", { A: { x: 10, y: 210 }, B: { x: 90, y: 190 }, C: { x: 230, y: 170 } }]
  ])("applies %s against the selection bounds", (operation, expected) => {
    expect(arrangeNodeRects(rects, operation)).toEqual(expected);
  });

  it("distributes different-width nodes with equal horizontal gaps", () => {
    expect(arrangeNodeRects(rects, "distribute-horizontal-spacing")).toEqual({
      A: { x: 10, y: 30 },
      B: { x: 110, y: 80 },
      C: { x: 230, y: 170 }
    });
  });

  it("distributes different-height nodes with equal vertical gaps", () => {
    expect(arrangeNodeRects(rects, "distribute-vertical-spacing")).toEqual({
      A: { x: 10, y: 30 },
      B: { x: 90, y: 90 },
      C: { x: 230, y: 170 }
    });
  });

  it("leaves fewer than three nodes unchanged for distribution", () => {
    expect(arrangeNodeRects(rects.slice(0, 2), "distribute-horizontal-spacing")).toEqual({
      A: { x: 10, y: 30 },
      B: { x: 90, y: 80 }
    });
  });

  it("does not mutate input geometry and labels every operation", () => {
    const before = structuredClone(rects);
    arrangeNodeRects(rects, "align-left");

    expect(rects).toEqual(before);
    [...NODE_ALIGNMENT_OPERATIONS, ...NODE_SPACING_OPERATIONS].forEach((operation) => {
      expect(nodeArrangementLabel(operation)).toBeTruthy();
    });
  });
});
