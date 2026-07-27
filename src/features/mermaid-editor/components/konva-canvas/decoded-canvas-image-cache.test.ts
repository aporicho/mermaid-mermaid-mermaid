import { describe, expect, it, vi } from "vitest";

import {
  CANVAS_IMAGE_CACHE_FALLBACK_BUDGET_BYTES,
  CANVAS_IMAGE_CACHE_HIGH_MEMORY_BUDGET_BYTES,
  CANVAS_IMAGE_CACHE_LOW_MEMORY_BUDGET_BYTES,
  CANVAS_IMAGE_CACHE_MEDIUM_MEMORY_BUDGET_BYTES,
  DecodedCanvasImageCache,
  resolveCanvasImageCacheBudget
} from "@/features/mermaid-editor/components/konva-canvas/decoded-canvas-image-cache";

describe("decoded canvas image cache", () => {
  it("uses a larger adaptive budget for higher-memory devices", () => {
    const gibibyte = 1024 ** 3;
    expect(resolveCanvasImageCacheBudget(null)).toBe(CANVAS_IMAGE_CACHE_FALLBACK_BUDGET_BYTES);
    expect(resolveCanvasImageCacheBudget(8 * gibibyte)).toBe(CANVAS_IMAGE_CACHE_LOW_MEMORY_BUDGET_BYTES);
    expect(resolveCanvasImageCacheBudget(12 * gibibyte)).toBe(CANVAS_IMAGE_CACHE_MEDIUM_MEMORY_BUDGET_BYTES);
    expect(resolveCanvasImageCacheBudget(32 * gibibyte)).toBe(CANVAS_IMAGE_CACHE_HIGH_MEMORY_BUDGET_BYTES);
  });

  it("deduplicates concurrent full-resolution decodes and reuses the decoded image", async () => {
    const loadImage = vi.fn(async () => fakeImage(20, 30));
    const cache = new DecodedCanvasImageCache({ loadImage, budgetBytes: 10_000 });
    const first = cache.retain("cover-a");
    const second = cache.retain("cover-a");

    const image = await first.promise;
    expect(await second.promise).toBe(image);
    expect(loadImage).toHaveBeenCalledTimes(1);
    expect(cache.peek("cover-a")).toBe(image);
    first.release();
    second.release();
    expect(cache.snapshot()).toMatchObject({ entries: 1, bytes: 2_400, activeEntries: 0 });

    const reused = cache.retain("cover-a");
    expect(await reused.promise).toBe(image);
    expect(loadImage).toHaveBeenCalledTimes(1);
    reused.release();
  });

  it("evicts the least-recently-used inactive image while protecting active images", async () => {
    const loadImage = vi.fn(async () => fakeImage(4, 4));
    const cache = new DecodedCanvasImageCache({ loadImage, budgetBytes: 100 });
    const first = cache.retain("cover-a");
    await first.promise;
    first.release();

    const second = cache.retain("cover-b");
    const secondImage = await second.promise;
    expect(cache.peek("cover-a")).toBeNull();
    expect(cache.peek("cover-b")).toBe(secondImage);
    expect(cache.snapshot()).toMatchObject({ entries: 1, bytes: 64, activeEntries: 1 });
    second.release();
  });

  it("allows active images to exceed the budget and evicts them only after release", async () => {
    const cache = new DecodedCanvasImageCache({ loadImage: async () => fakeImage(4, 4), budgetBytes: 1 });
    const retained = cache.retain("active-cover");
    await retained.promise;
    expect(cache.snapshot()).toMatchObject({ entries: 1, bytes: 64, activeEntries: 1 });
    retained.release();
    expect(cache.snapshot()).toMatchObject({ entries: 0, bytes: 0, activeEntries: 0 });
  });

  it("keeps an inactive pending decode for later reuse", async () => {
    let finish!: (image: HTMLImageElement) => void;
    const loadImage = vi.fn(() => new Promise<HTMLImageElement>((resolve) => { finish = resolve; }));
    const cache = new DecodedCanvasImageCache({ loadImage, budgetBytes: 10_000 });
    const retained = cache.retain("pending-cover");
    retained.release();
    const image = fakeImage(8, 8);
    finish(image);

    expect(await retained.promise).toBe(image);
    expect(cache.peek("pending-cover")).toBe(image);
    expect(cache.snapshot()).toMatchObject({ entries: 1, activeEntries: 0 });
  });

  it("retries failed decodes after the final consumer releases", async () => {
    const image = fakeImage(8, 8);
    const loadImage = vi.fn().mockRejectedValueOnce(new Error("failed")).mockResolvedValueOnce(image);
    const cache = new DecodedCanvasImageCache({ loadImage });
    const failed = cache.retain("retry-cover");
    expect(await failed.promise).toBeNull();
    failed.release();
    const retried = cache.retain("retry-cover");
    expect(await retried.promise).toBe(image);
    expect(loadImage).toHaveBeenCalledTimes(2);
    retried.release();
  });

  it("treats revisioned asset URLs as distinct source versions", async () => {
    const loadImage = vi.fn(async () => fakeImage(2, 2));
    const cache = new DecodedCanvasImageCache({ loadImage });
    const first = cache.retain("mmm-asset://local/cover.jpg?revision=1");
    const second = cache.retain("mmm-asset://local/cover.jpg?revision=2");
    await Promise.all([first.promise, second.promise]);
    expect(loadImage).toHaveBeenCalledTimes(2);
    first.release();
    second.release();
  });

  it("applies a smaller configured budget to inactive entries", async () => {
    const cache = new DecodedCanvasImageCache({ loadImage: async () => fakeImage(4, 4), budgetBytes: 1_000 });
    const retained = cache.retain("cover-a");
    await retained.promise;
    retained.release();
    cache.configureBudget(1);
    expect(cache.snapshot()).toMatchObject({ entries: 0, bytes: 0, budgetBytes: 1 });
  });
});

function fakeImage(width: number, height: number) {
  return { naturalWidth: width, naturalHeight: height } as HTMLImageElement;
}
