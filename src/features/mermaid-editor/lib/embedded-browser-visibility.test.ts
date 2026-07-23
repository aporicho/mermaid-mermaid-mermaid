import { describe, expect, it } from "vitest";

import {
  isEmbeddedBrowserLayerOccluded,
  rectanglesOverlap
} from "@/features/mermaid-editor/lib/embedded-browser-visibility";

const browserRect = { left: 100, top: 100, right: 700, bottom: 600 };

describe("embedded browser visibility", () => {
  it("keeps side-by-side floating windows visible", () => {
    expect(isEmbeddedBrowserLayerOccluded({
      rect: browserRect,
      zIndex: 52,
      higherLayers: [{ rect: { left: 720, top: 100, right: 1200, bottom: 600 }, zIndex: 60 }]
    })).toBe(false);
  });

  it("hides a native browser below an overlapping higher panel", () => {
    expect(isEmbeddedBrowserLayerOccluded({
      rect: browserRect,
      zIndex: 52,
      higherLayers: [{ rect: { left: 640, top: 80, right: 1000, bottom: 500 }, zIndex: 60 }]
    })).toBe(true);
  });

  it("does not hide a browser for an overlapping lower panel", () => {
    expect(isEmbeddedBrowserLayerOccluded({
      rect: browserRect,
      zIndex: 60,
      higherLayers: [{ rect: { left: 640, top: 80, right: 1000, bottom: 500 }, zIndex: 52 }]
    })).toBe(false);
  });

  it("treats touching edges as non-overlapping", () => {
    expect(rectanglesOverlap(browserRect, { left: 700, top: 100, right: 900, bottom: 600 })).toBe(false);
  });
});
