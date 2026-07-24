// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  isEmbeddedBrowserLayerOccluded,
  isEmbeddedBrowserSurfaceOccluded,
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

  it("hides the native surface for an overlapping overlay owned by its window", () => {
    const owner = elementWithRect("div", browserRect);
    owner.dataset.floatingPanelKind = "workspace";
    owner.dataset.overlayScopeId = "workspace:browser";
    owner.style.zIndex = "2";
    const surface = elementWithRect("div", browserRect);
    const overlay = elementWithRect("div", { left: 500, top: 120, right: 760, bottom: 360 });
    overlay.dataset.overlayLayer = "dropdown";
    overlay.dataset.overlayScopeId = "workspace:browser";
    owner.append(surface, overlay);
    document.body.append(owner);

    expect(isEmbeddedBrowserSurfaceOccluded(surface)).toBe(true);
    owner.remove();
  });

  it("keeps the native surface visible below a non-overlapping global overlay", () => {
    const owner = elementWithRect("div", browserRect);
    owner.dataset.floatingPanelKind = "workspace";
    owner.dataset.overlayScopeId = "workspace:browser";
    owner.style.zIndex = "2";
    const surface = elementWithRect("div", browserRect);
    const overlay = elementWithRect("div", { left: 720, top: 100, right: 900, bottom: 300 });
    overlay.dataset.overlayLayer = "dropdown";
    overlay.dataset.overlayScopeId = "application";
    owner.append(surface);
    document.body.append(owner, overlay);

    expect(isEmbeddedBrowserSurfaceOccluded(surface)).toBe(false);
    owner.remove();
    overlay.remove();
  });
});

function elementWithRect(tag: "div", rect: { left: number; top: number; right: number; bottom: number }) {
  const element = document.createElement(tag);
  element.getBoundingClientRect = () => ({
    ...rect,
    x: rect.left,
    y: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    toJSON: () => undefined
  });
  return element;
}
