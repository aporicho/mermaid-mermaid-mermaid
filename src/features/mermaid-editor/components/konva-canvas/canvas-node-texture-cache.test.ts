import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Konva from "konva";

import {
  CANVAS_NODE_TEXTURE_CACHE_FALLBACK_BUDGET_BYTES,
  CANVAS_NODE_TEXTURE_CACHE_HIGH_MEMORY_BUDGET_BYTES,
  CANVAS_NODE_TEXTURE_CACHE_LOW_MEMORY_BUDGET_BYTES,
  CANVAS_NODE_TEXTURE_CACHE_MEDIUM_MEMORY_BUDGET_BYTES,
  CanvasNodeTextureCacheController,
  estimateKonvaCacheBytes,
  resolveCanvasNodeTextureCacheBudget
} from "@/features/mermaid-editor/components/konva-canvas/canvas-node-texture-cache";

describe("canvas node texture cache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("selects a bounded cache budget from system memory", () => {
    const gib = 1024 ** 3;
    expect(resolveCanvasNodeTextureCacheBudget(null)).toBe(CANVAS_NODE_TEXTURE_CACHE_FALLBACK_BUDGET_BYTES);
    expect(resolveCanvasNodeTextureCacheBudget(8 * gib)).toBe(CANVAS_NODE_TEXTURE_CACHE_LOW_MEMORY_BUDGET_BYTES);
    expect(resolveCanvasNodeTextureCacheBudget(16 * gib)).toBe(CANVAS_NODE_TEXTURE_CACHE_MEDIUM_MEMORY_BUDGET_BYTES);
    expect(resolveCanvasNodeTextureCacheBudget(32 * gib)).toBe(CANVAS_NODE_TEXTURE_CACHE_HIGH_MEMORY_BUDGET_BYTES);
  });

  it("accounts for the retained scene, buffer, and hit canvases", () => {
    expect(estimateKonvaCacheBytes(100, 50, 2, 0.1)).toBe(Math.ceil(100 * 50 * 4 * (8 + 0.01)));
  });

  it("builds one idle cache and falls back to vectors when zoom exceeds its sharp range", () => {
    const group = fakeGroup({ width: 120, height: 80 });
    const controller = new CanvasNodeTextureCacheController({ budgetBytes: 32 * 1024 * 1024, disabled: false });
    controller.configureCanvasPixelRatio(2);
    controller.upsert({
      id: "node:static",
      key: "v1",
      kind: "standard",
      group: group.node,
      enabled: true,
      priority: 1
    });

    vi.advanceTimersByTime(20);
    expect(group.cache).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()).toMatchObject({ cachedEntries: 1, settledScale: 1 });

    controller.handleViewport({ x: 0, y: 0, scale: 1.5 });
    expect(group.clearCache).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()).toMatchObject({ cachedEntries: 0, viewportActive: true, liveScale: 1.5 });

    vi.advanceTimersByTime(100);
    expect(group.cache).toHaveBeenCalledTimes(2);
    expect(controller.snapshot()).toMatchObject({ cachedEntries: 1, viewportActive: false, settledScale: 1.5 });
    controller.destroy();
  });

  it("skips an oversized entry without repeatedly scheduling it", () => {
    const group = fakeGroup({ width: 8_000, height: 8_000 });
    const controller = new CanvasNodeTextureCacheController({ budgetBytes: 512 * 1024 * 1024, disabled: false });
    controller.configureCanvasPixelRatio(2);
    controller.upsert({
      id: "oversized",
      key: "v1",
      kind: "markdown-document",
      group: group.node,
      enabled: true,
      priority: 10
    });

    vi.advanceTimersByTime(1_000);
    expect(group.cache).not.toHaveBeenCalled();
    expect(controller.snapshot()).toMatchObject({ cachedEntries: 0, queuedEntries: 0 });
    controller.destroy();
  });
});

function fakeGroup(rect: { width: number; height: number }) {
  let cached = false;
  const cache = vi.fn(() => { cached = true; });
  const clearCache = vi.fn(() => { cached = false; });
  const node = {
    getStage: () => ({}),
    getClientRect: () => ({ x: 0, y: 0, ...rect }),
    cache,
    clearCache,
    isCached: () => cached,
    getLayer: () => ({ batchDraw: vi.fn() })
  } as unknown as Konva.Group;
  return { node, cache, clearCache };
}
