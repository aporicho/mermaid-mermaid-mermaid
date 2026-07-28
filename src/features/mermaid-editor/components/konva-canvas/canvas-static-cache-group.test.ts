import { describe, expect, it } from "vitest";

import { canvasStaticCacheKey } from "@/features/mermaid-editor/components/konva-canvas/canvas-node-texture-cache";

describe("canvas static cache key", () => {
  it("keeps stable object identities and separates new theme revisions", () => {
    const theme = { radius: 8 };
    expect(canvasStaticCacheKey("node", theme)).toBe(canvasStaticCacheKey("node", theme));
    expect(canvasStaticCacheKey("node", theme)).not.toBe(canvasStaticCacheKey("node", { radius: 8 }));
  });
});
