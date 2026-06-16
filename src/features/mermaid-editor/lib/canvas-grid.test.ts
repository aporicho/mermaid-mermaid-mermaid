import { describe, expect, it } from "vitest";

import { DEFAULT_CANVAS_GRID, firstGridCoordinateAtOrAfter, getCanvasGridRenderPlan, isGridCoordinate } from "@/features/mermaid-editor/lib/canvas-grid";

describe("canvas grid", () => {
  it("finds the first grid coordinate after negative values", () => {
    expect(firstGridCoordinateAtOrAfter(-50, DEFAULT_CANVAS_GRID.minorStep)).toBe(-48);
    expect(firstGridCoordinateAtOrAfter(-48, DEFAULT_CANVAS_GRID.minorStep)).toBe(-48);
    expect(firstGridCoordinateAtOrAfter(-47, DEFAULT_CANVAS_GRID.minorStep)).toBe(-24);
  });

  it("detects grid coordinates from world positions", () => {
    expect(isGridCoordinate(48, DEFAULT_CANVAS_GRID.minorStep)).toBe(true);
    expect(isGridCoordinate(-48, DEFAULT_CANVAS_GRID.minorStep)).toBe(true);
    expect(isGridCoordinate(49, DEFAULT_CANVAS_GRID.minorStep)).toBe(false);
  });

  it("uses minor and major dots near normal zoom", () => {
    const plan = getCanvasGridRenderPlan({ width: 1000, height: 700 }, { x: 0, y: 0, scale: 1 });

    expect(plan.levels.map((level) => level.kind)).toEqual(["minor", "major"]);
    expect(plan.estimatedDotCount).toBeLessThanOrEqual(5200);
  });

  it("drops minor dots when zoomed out", () => {
    const plan = getCanvasGridRenderPlan({ width: 1600, height: 1000 }, { x: 0, y: 0, scale: 0.35 });

    expect(plan.levels.some((level) => level.kind === "minor")).toBe(false);
    expect(plan.estimatedDotCount).toBeLessThanOrEqual(5200);
  });

  it("uses super grid dots at distant zoom", () => {
    const plan = getCanvasGridRenderPlan({ width: 1600, height: 1000 }, { x: 0, y: 0, scale: 0.12 });

    expect(plan.levels).toHaveLength(1);
    expect(plan.levels[0].kind).toBe("super");
    expect(plan.estimatedDotCount).toBeLessThanOrEqual(5200);
  });
});
