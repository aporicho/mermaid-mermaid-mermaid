import { describe, expect, it } from "vitest";

import { superellipseRectPathPoints } from "@/features/mermaid-editor/lib/canvas-card-geometry";

describe("canvas card geometry", () => {
  it("builds a closed superellipse card path", () => {
    const points = superellipseRectPathPoints({ width: 240, height: 156, radius: 32 });

    expect(points.length).toBeGreaterThan(12);
    expect(points[0]).toEqual(points[points.length - 1]);
  });

  it("clamps card corner radius to half of the smallest side", () => {
    const points = superellipseRectPathPoints({ width: 80, height: 40, radius: 80 });

    expect(points[0]).toEqual({ x: 20, y: 0 });
    expect(points.some((point) => point.x === 80)).toBe(true);
    expect(points.some((point) => point.y === 40)).toBe(true);
  });

  it("keeps the path inside the card bounds", () => {
    const points = superellipseRectPathPoints({ width: 120, height: 72, radius: 24 });

    expect(points.every((point) => point.x >= 0 && point.x <= 120 && point.y >= 0 && point.y <= 72)).toBe(true);
  });
});
