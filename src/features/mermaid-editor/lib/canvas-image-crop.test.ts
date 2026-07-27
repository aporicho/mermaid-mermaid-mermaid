import { describe, expect, it } from "vitest";

import { coverCanvasImageSourceCrop } from "@/features/mermaid-editor/lib/canvas-image-crop";

describe("canvas image source crop", () => {
  it("center-crops a landscape source without changing its source height", () => {
    expect(coverCanvasImageSourceCrop(2400, 1200, 400, 400)).toEqual({ x: 600, y: 0, width: 1200, height: 1200 });
  });

  it("center-crops a portrait source without changing its source width", () => {
    expect(coverCanvasImageSourceCrop(1080, 1920, 400, 200)).toEqual({ x: 0, y: 690, width: 1080, height: 540 });
  });

  it("uses the complete source when the aspect ratios match", () => {
    expect(coverCanvasImageSourceCrop(1200, 800, 600, 400)).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
  });
});
