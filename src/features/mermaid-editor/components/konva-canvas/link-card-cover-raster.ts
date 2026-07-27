import { canvasPixelRatio } from "@/features/mermaid-editor/lib/canvas-render-quality";
import { incrementPerformanceCounter, recordPerformanceMetric } from "@/features/mermaid-editor/lib/editor-performance";

export const LINK_CARD_COVER_CACHE_BUDGET_BYTES = 96 * 1024 * 1024;
export const LINK_CARD_COVER_CACHE_MAX_ENTRIES = 160;
export const LINK_CARD_COVER_RASTER_CONCURRENCY = 3;

export type LinkCardCoverRasterInput = {
  src: string;
  width: number;
  height: number;
  radius: number;
  devicePixelRatio?: number;
};

export type LinkCardCoverRasterRequest = LinkCardCoverRasterInput & {
  density: number;
  key: string;
};

export type LinkCardCoverRaster = {
  image: ImageBitmap;
  pixelWidth: number;
  pixelHeight: number;
  density: number;
  bytes: number;
};

export type RetainedLinkCardCoverRaster = {
  key: string;
  promise: Promise<LinkCardCoverRaster | null>;
  release: () => void;
};

type RasterFactory = (request: LinkCardCoverRasterRequest) => Promise<LinkCardCoverRaster>;

type CacheEntry = {
  key: string;
  refs: number;
  lastUsed: number;
  state: "pending" | "ready" | "failed";
  discardWhenReady: boolean;
  raster: LinkCardCoverRaster | null;
  promise: Promise<LinkCardCoverRaster | null>;
};

export function resolveLinkCardCoverRasterRequest(input: LinkCardCoverRasterInput): LinkCardCoverRasterRequest {
  const density = canvasPixelRatio(input.devicePixelRatio ?? globalThis.devicePixelRatio);
  const width = positiveDimension(input.width);
  const height = positiveDimension(input.height);
  const radius = Math.max(0, finiteNumber(input.radius, 0));
  const src = input.src.trim();
  return {
    src,
    width,
    height,
    radius,
    density,
    key: JSON.stringify([src, roundKeyNumber(width), roundKeyNumber(height), roundKeyNumber(radius), density])
  };
}

export function linkCardCoverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const safeSourceWidth = positiveDimension(sourceWidth);
  const safeSourceHeight = positiveDimension(sourceHeight);
  const safeTargetWidth = positiveDimension(targetWidth);
  const safeTargetHeight = positiveDimension(targetHeight);
  const sourceAspect = safeSourceWidth / safeSourceHeight;
  const targetAspect = safeTargetWidth / safeTargetHeight;

  if (sourceAspect > targetAspect) {
    const width = safeSourceHeight * targetAspect;
    return { x: (safeSourceWidth - width) / 2, y: 0, width, height: safeSourceHeight };
  }

  const height = safeSourceWidth / targetAspect;
  return { x: 0, y: (safeSourceHeight - height) / 2, width: safeSourceWidth, height };
}

export function linkCardCoverRasterSize(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  requestedDensity: number
) {
  const width = positiveDimension(targetWidth);
  const height = positiveDimension(targetHeight);
  const crop = linkCardCoverCrop(sourceWidth, sourceHeight, width, height);
  const usefulDensity = Math.min(crop.width / width, crop.height / height);
  const density = Math.max(0.01, Math.min(Math.max(0.01, requestedDensity), usefulDensity));
  return {
    crop,
    density,
    pixelWidth: Math.max(1, Math.round(width * density)),
    pixelHeight: Math.max(1, Math.round(height * density))
  };
}

export class LinkCardCoverRasterCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly queue: RasterTaskQueue;
  private readonly budgetBytes: number;
  private readonly maxEntries: number;
  private readonly createRaster: RasterFactory;
  private totalBytes = 0;
  private clock = 0;

  constructor(options: {
    budgetBytes?: number;
    maxEntries?: number;
    concurrency?: number;
    createRaster?: RasterFactory;
  } = {}) {
    this.budgetBytes = Math.max(0, options.budgetBytes ?? LINK_CARD_COVER_CACHE_BUDGET_BYTES);
    this.maxEntries = Math.max(1, options.maxEntries ?? LINK_CARD_COVER_CACHE_MAX_ENTRIES);
    this.queue = new RasterTaskQueue(options.concurrency ?? LINK_CARD_COVER_RASTER_CONCURRENCY);
    this.createRaster = options.createRaster ?? rasterizeLinkCardCover;
  }

  retain(input: LinkCardCoverRasterInput | LinkCardCoverRasterRequest): RetainedLinkCardCoverRaster {
    const request = "key" in input ? input : resolveLinkCardCoverRasterRequest(input);
    let entry = this.entries.get(request.key);
    if (entry) {
      entry.refs += 1;
      entry.lastUsed = ++this.clock;
      incrementPerformanceCounter("canvas-link-cover-cache-hit");
      return retainedEntry(entry, () => this.release(entry!));
    }

    incrementPerformanceCounter("canvas-link-cover-cache-miss");
    entry = {
      key: request.key,
      refs: 1,
      lastUsed: ++this.clock,
      state: "pending",
      discardWhenReady: false,
      raster: null,
      promise: Promise.resolve(null)
    };
    const pendingEntry = entry;
    pendingEntry.promise = this.queue.schedule(async () => {
      if (pendingEntry.discardWhenReady) return null;
      const startedAt = now();
      try {
        const raster = await this.createRaster(request);
        recordPerformanceMetric("canvas-link-cover-rasterize", now() - startedAt, {
          source: request.src.startsWith("mmm-asset:") ? "local" : "external",
          targetPixels: raster.pixelWidth * raster.pixelHeight,
          density: raster.density
        });
        if (pendingEntry.discardWhenReady || this.entries.get(pendingEntry.key) !== pendingEntry) {
          disposeRaster(raster);
          return null;
        }
        pendingEntry.state = "ready";
        pendingEntry.raster = raster;
        this.totalBytes += raster.bytes;
        this.evictUnusedEntries();
        return raster;
      } catch {
        incrementPerformanceCounter("canvas-link-cover-cache-fallback");
        pendingEntry.state = "failed";
        if (pendingEntry.refs === 0) this.entries.delete(pendingEntry.key);
        return null;
      }
    });
    this.entries.set(request.key, pendingEntry);
    this.evictUnusedEntries();
    return retainedEntry(pendingEntry, () => this.release(pendingEntry));
  }

  clear() {
    for (const entry of this.entries.values()) {
      entry.discardWhenReady = true;
      if (entry.raster) disposeRaster(entry.raster);
    }
    this.entries.clear();
    this.totalBytes = 0;
  }

  snapshot() {
    return {
      entries: this.entries.size,
      bytes: this.totalBytes,
      activeEntries: [...this.entries.values()].filter((entry) => entry.refs > 0).length
    };
  }

  private release(entry: CacheEntry) {
    if (entry.refs <= 0) return;
    entry.refs -= 1;
    entry.lastUsed = ++this.clock;
    if (entry.refs === 0 && entry.state === "pending") {
      entry.discardWhenReady = true;
      this.entries.delete(entry.key);
      return;
    }
    if (entry.refs === 0 && entry.state === "failed") {
      this.entries.delete(entry.key);
      return;
    }
    this.evictUnusedEntries();
  }

  private evictUnusedEntries() {
    const unused = () => [...this.entries.values()]
      .filter((entry) => entry.refs === 0 && entry.state !== "pending")
      .sort((left, right) => left.lastUsed - right.lastUsed);

    for (const entry of unused()) {
      if (this.totalBytes <= this.budgetBytes && this.entries.size <= this.maxEntries) break;
      this.entries.delete(entry.key);
      if (entry.raster) {
        this.totalBytes = Math.max(0, this.totalBytes - entry.raster.bytes);
        disposeRaster(entry.raster);
      }
      incrementPerformanceCounter("canvas-link-cover-cache-eviction");
    }
  }
}

async function rasterizeLinkCardCover(request: LinkCardCoverRasterRequest): Promise<LinkCardCoverRaster> {
  if (typeof fetch !== "function" || typeof createImageBitmap !== "function") {
    throw new Error("ImageBitmap rasterization is unavailable.");
  }

  const response = await fetch(request.src);
  if (!response.ok) throw new Error(`Cover request failed with ${response.status}.`);
  const decoded = await createImageBitmap(await response.blob());

  try {
    const { crop, density, pixelWidth, pixelHeight } = linkCardCoverRasterSize(
      decoded.width,
      decoded.height,
      request.width,
      request.height,
      request.density
    );
    const canvas = createRasterCanvas(pixelWidth, pixelHeight);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D raster context is unavailable.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const radiusScale = Math.min(pixelWidth / request.width, pixelHeight / request.height);
    roundedRectPath(context, 0, 0, pixelWidth, pixelHeight, request.radius * radiusScale);
    context.clip();
    context.drawImage(
      decoded,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      pixelWidth,
      pixelHeight
    );

    const image = await rasterCanvasImage(canvas);
    return {
      image,
      pixelWidth,
      pixelHeight,
      density,
      bytes: pixelWidth * pixelHeight * 4
    };
  } finally {
    decoded.close();
  }
}

function createRasterCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document === "undefined") throw new Error("Canvas rasterization is unavailable.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function rasterCanvasImage(canvas: OffscreenCanvas | HTMLCanvasElement) {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) return canvas.transferToImageBitmap();
  const image = await createImageBitmap(canvas);
  canvas.width = 0;
  canvas.height = 0;
  return image;
}

function roundedRectPath(
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(Math.max(0, radius), width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.arcTo(x + width, y, x + width, y + r, r);
  context.lineTo(x + width, y + height - r);
  context.arcTo(x + width, y + height, x + width - r, y + height, r);
  context.lineTo(x + r, y + height);
  context.arcTo(x, y + height, x, y + height - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

function retainedEntry(entry: CacheEntry, release: () => void): RetainedLinkCardCoverRaster {
  let released = false;
  return {
    key: entry.key,
    promise: entry.promise,
    release() {
      if (released) return;
      released = true;
      release();
    }
  };
}

function disposeRaster(raster: LinkCardCoverRaster) {
  raster.image.close();
}

class RasterTaskQueue {
  private active = 0;
  private readonly pending: Array<() => void> = [];
  private readonly concurrency: number;

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, Math.floor(concurrency));
  }

  schedule<T>(task: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        this.active += 1;
        void task().then(resolve, reject).finally(() => {
          this.active -= 1;
          this.pending.shift()?.();
        });
      };
      if (this.active < this.concurrency) run();
      else this.pending.push(run);
    });
  }
}

export const linkCardCoverRasterCache = new LinkCardCoverRasterCache();

function positiveDimension(value: number) {
  return Math.max(1, finiteNumber(value, 1));
}

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function roundKeyNumber(value: number) {
  return Math.round(value * 1000) / 1000;
}

function now() {
  return globalThis.performance?.now() ?? Date.now();
}
