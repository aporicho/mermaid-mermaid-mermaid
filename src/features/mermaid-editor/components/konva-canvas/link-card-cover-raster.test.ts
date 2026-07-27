import { describe, expect, it, vi } from "vitest";

import {
  LinkCardCoverRasterCache,
  linkCardCoverCrop,
  linkCardCoverRasterSize,
  resolveLinkCardCoverRasterRequest,
  type LinkCardCoverRaster
} from "@/features/mermaid-editor/components/konva-canvas/link-card-cover-raster";

describe("link card cover raster", () => {
  it("uses one fixed canvas-DPR raster key without viewport scale levels", () => {
    const request = resolveLinkCardCoverRasterRequest({
      src: "mmm-asset://local/?path=cover.jpg",
      width: 204,
      height: 272,
      radius: 4,
      devicePixelRatio: 3
    });

    expect(request.density).toBe(2);
    expect(request.key).toBe(resolveLinkCardCoverRasterRequest({
      src: request.src,
      width: 204,
      height: 272,
      radius: 4,
      devicePixelRatio: 3
    }).key);
  });

  it("center-crops portrait and landscape covers to the card aspect ratio", () => {
    expect(linkCardCoverCrop(1080, 1440, 204, 272)).toEqual({ x: 0, y: 0, width: 1080, height: 1440 });
    expect(linkCardCoverCrop(1422, 1080, 204, 272)).toEqual({
      x: 306,
      y: 0,
      width: 810,
      height: 1080
    });
  });

  it("caps the fixed raster size at the useful source resolution", () => {
    expect(linkCardCoverRasterSize(1080, 1440, 204, 272, 2)).toMatchObject({
      density: 2,
      pixelWidth: 408,
      pixelHeight: 544
    });
    expect(linkCardCoverRasterSize(102, 136, 204, 272, 2)).toMatchObject({
      density: 0.5,
      pixelWidth: 102,
      pixelHeight: 136
    });
  });

  it("deduplicates active requests and keeps the resolved raster for reuse", async () => {
    const close = vi.fn();
    const createRaster = vi.fn(async () => fakeRaster(64, close));
    const cache = new LinkCardCoverRasterCache({ createRaster, budgetBytes: 1024 });
    const input = { src: "cover-a", width: 204, height: 272, radius: 4, devicePixelRatio: 2 };
    const first = cache.retain(input);
    const second = cache.retain(input);

    expect(await first.promise).not.toBeNull();
    expect(await second.promise).not.toBeNull();
    expect(createRaster).toHaveBeenCalledTimes(1);
    first.release();
    second.release();
    expect(cache.snapshot()).toEqual({ entries: 1, bytes: 64, activeEntries: 0 });

    const reused = cache.retain(input);
    expect(await reused.promise).not.toBeNull();
    expect(createRaster).toHaveBeenCalledTimes(1);
    reused.release();
    cache.clear();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("evicts the least-recently-used inactive raster above the byte budget", async () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    const createRaster = vi.fn()
      .mockResolvedValueOnce(fakeRaster(60, closeA))
      .mockResolvedValueOnce(fakeRaster(60, closeB));
    const cache = new LinkCardCoverRasterCache({ createRaster, budgetBytes: 100 });
    const first = cache.retain({ src: "cover-a", width: 20, height: 20, radius: 2, devicePixelRatio: 2 });
    await first.promise;
    first.release();
    const second = cache.retain({ src: "cover-b", width: 20, height: 20, radius: 2, devicePixelRatio: 2 });
    await second.promise;

    expect(cache.snapshot()).toEqual({ entries: 1, bytes: 60, activeEntries: 1 });
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).not.toHaveBeenCalled();
    second.release();
    cache.clear();
  });

  it("disposes a pending raster whose final consumer was released", async () => {
    const close = vi.fn();
    let finish!: (raster: LinkCardCoverRaster) => void;
    const createRaster = vi.fn(() => new Promise<LinkCardCoverRaster>((resolve) => { finish = resolve; }));
    const cache = new LinkCardCoverRasterCache({ createRaster });
    const retained = cache.retain({ src: "cover-a", width: 20, height: 20, radius: 2, devicePixelRatio: 2 });
    retained.release();
    finish(fakeRaster(64, close));

    expect(await retained.promise).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);
    expect(cache.snapshot()).toEqual({ entries: 0, bytes: 0, activeEntries: 0 });
  });
});

function fakeRaster(bytes: number, close: () => void): LinkCardCoverRaster {
  return {
    image: { close } as ImageBitmap,
    pixelWidth: 4,
    pixelHeight: 4,
    density: 2,
    bytes
  };
}
