import { describe, expect, it } from "vitest";

import { embeddedBrowserLogicalRect, embeddedBrowserRectKey } from "@/features/mermaid-editor/lib/embedded-browser-rect";

describe("embedded browser rect", () => {
  it("keeps full content size in logical pixels", () => {
    expect(embeddedBrowserLogicalRect({ left: 100, top: 84, width: 920, height: 596 })).toEqual({
      x: 100,
      y: 84,
      width: 920,
      height: 596
    });
  });

  it("allows negative positions so offscreen panels are clipped by the host window", () => {
    expect(embeddedBrowserLogicalRect({ left: -120, top: -18, width: 920, height: 596 })).toEqual({
      x: -120,
      y: -18,
      width: 920,
      height: 596
    });
  });

  it("rounds outward to avoid one pixel gaps", () => {
    expect(embeddedBrowserLogicalRect({ left: 12.8, top: 64.2, width: 519.1, height: 359.4 })).toEqual({
      x: 12,
      y: 64,
      width: 520,
      height: 360
    });
  });

  it("builds a stable sync key", () => {
    expect(embeddedBrowserRectKey({ x: -10, y: 20, width: 520, height: 360 })).toBe("-10:20:520:360");
  });

  it("carries the themed border radius into the native view geometry", () => {
    const rect = embeddedBrowserLogicalRect({ left: 12, top: 64, width: 520, height: 360, borderRadius: 8 });

    expect(rect.borderRadius).toBe(8);
    expect(embeddedBrowserRectKey(rect)).toBe("12:64:520:360:r8");
  });
});
