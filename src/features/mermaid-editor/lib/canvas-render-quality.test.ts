import { describe, expect, it } from "vitest";

import {
  MAX_CANVAS_PIXEL_RATIO,
  MIN_CANVAS_PIXEL_RATIO,
  canvasPixelRatio
} from "@/features/mermaid-editor/lib/canvas-render-quality";

describe("canvas render quality", () => {
  it("supersamples standard displays while capping high-DPI rendering cost", () => {
    expect(canvasPixelRatio(1)).toBe(MIN_CANVAS_PIXEL_RATIO);
    expect(canvasPixelRatio(2.5)).toBe(MAX_CANVAS_PIXEL_RATIO);
  });

  it("caps invalid or extreme ratios to a safe rendering range", () => {
    expect(canvasPixelRatio(Number.NaN)).toBe(MIN_CANVAS_PIXEL_RATIO);
    expect(canvasPixelRatio(8)).toBe(MAX_CANVAS_PIXEL_RATIO);
  });
});
