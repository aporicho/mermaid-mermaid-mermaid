import { incrementPerformanceCounter, recordPerformanceMetric } from "@/features/mermaid-editor/lib/editor-performance";

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;

export const CANVAS_IMAGE_CACHE_LOW_MEMORY_BUDGET_BYTES = 256 * MEBIBYTE;
export const CANVAS_IMAGE_CACHE_MEDIUM_MEMORY_BUDGET_BYTES = 512 * MEBIBYTE;
export const CANVAS_IMAGE_CACHE_HIGH_MEMORY_BUDGET_BYTES = 1024 * MEBIBYTE;
export const CANVAS_IMAGE_CACHE_FALLBACK_BUDGET_BYTES = CANVAS_IMAGE_CACHE_MEDIUM_MEMORY_BUDGET_BYTES;
export const CANVAS_IMAGE_CACHE_MAX_ENTRIES = 512;

type CacheEntry = {
  key: string;
  refs: number;
  lastUsed: number;
  state: "pending" | "ready" | "failed";
  image: HTMLImageElement | null;
  bytes: number;
  promise: Promise<HTMLImageElement | null>;
};

export type RetainedDecodedCanvasImage = {
  key: string;
  promise: Promise<HTMLImageElement | null>;
  release: () => void;
};

type ImageLoader = (src: string) => Promise<HTMLImageElement>;

export function resolveCanvasImageCacheBudget(totalSystemMemoryBytes?: number | null) {
  if (!Number.isFinite(totalSystemMemoryBytes) || !totalSystemMemoryBytes || totalSystemMemoryBytes <= 0) {
    return CANVAS_IMAGE_CACHE_FALLBACK_BUDGET_BYTES;
  }
  if (totalSystemMemoryBytes <= 8 * GIBIBYTE) return CANVAS_IMAGE_CACHE_LOW_MEMORY_BUDGET_BYTES;
  if (totalSystemMemoryBytes <= 16 * GIBIBYTE) return CANVAS_IMAGE_CACHE_MEDIUM_MEMORY_BUDGET_BYTES;
  return CANVAS_IMAGE_CACHE_HIGH_MEMORY_BUDGET_BYTES;
}

export class DecodedCanvasImageCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly loadImage: ImageLoader;
  private budgetBytes: number;
  private totalBytes = 0;
  private clock = 0;

  constructor(options: {
    budgetBytes?: number;
    maxEntries?: number;
    loadImage?: ImageLoader;
  } = {}) {
    this.budgetBytes = Math.max(0, options.budgetBytes ?? CANVAS_IMAGE_CACHE_FALLBACK_BUDGET_BYTES);
    this.maxEntries = Math.max(1, options.maxEntries ?? CANVAS_IMAGE_CACHE_MAX_ENTRIES);
    this.loadImage = options.loadImage ?? loadDecodedImage;
  }

  retain(source: string): RetainedDecodedCanvasImage {
    const key = source.trim();
    if (!key) return { key, promise: Promise.resolve(null), release: () => undefined };

    let entry = this.entries.get(key);
    if (entry) {
      entry.refs += 1;
      entry.lastUsed = ++this.clock;
      incrementPerformanceCounter("canvas-image-cache-hit");
      return retainedEntry(entry, () => this.release(entry!));
    }

    incrementPerformanceCounter("canvas-image-cache-miss");
    entry = {
      key,
      refs: 1,
      lastUsed: ++this.clock,
      state: "pending",
      image: null,
      bytes: 0,
      promise: Promise.resolve(null)
    };
    const pendingEntry = entry;
    const startedAt = now();
    pendingEntry.promise = this.loadImage(key).then((image) => {
      if (this.entries.get(key) !== pendingEntry) return null;
      pendingEntry.state = "ready";
      pendingEntry.image = image;
      pendingEntry.bytes = decodedImageBytes(image);
      this.totalBytes += pendingEntry.bytes;
      recordPerformanceMetric("canvas-image-decode", now() - startedAt, {
        source: key.startsWith("mmm-asset:") ? "local" : "external",
        width: image.naturalWidth,
        height: image.naturalHeight,
        bytes: pendingEntry.bytes
      });
      this.evictUnusedEntries();
      return image;
    }).catch(() => {
      pendingEntry.state = "failed";
      incrementPerformanceCounter("canvas-image-cache-load-error");
      if (pendingEntry.refs === 0) this.entries.delete(key);
      return null;
    });
    this.entries.set(key, pendingEntry);
    this.evictUnusedEntries();
    return retainedEntry(pendingEntry, () => this.release(pendingEntry));
  }

  peek(source: string) {
    const entry = this.entries.get(source.trim());
    if (!entry?.image || entry.state !== "ready") return null;
    entry.lastUsed = ++this.clock;
    return entry.image;
  }

  configureBudget(budgetBytes: number) {
    this.budgetBytes = Math.max(0, budgetBytes);
    this.evictUnusedEntries();
  }

  clearUnused() {
    for (const entry of oldestUnusedEntries(this.entries)) this.remove(entry);
  }

  snapshot() {
    return {
      entries: this.entries.size,
      bytes: this.totalBytes,
      budgetBytes: this.budgetBytes,
      activeEntries: [...this.entries.values()].filter((entry) => entry.refs > 0).length
    };
  }

  private release(entry: CacheEntry) {
    if (entry.refs <= 0) return;
    entry.refs -= 1;
    entry.lastUsed = ++this.clock;
    if (entry.refs === 0 && entry.state === "failed") this.entries.delete(entry.key);
    this.evictUnusedEntries();
  }

  private evictUnusedEntries() {
    for (const entry of oldestUnusedEntries(this.entries)) {
      if (this.totalBytes <= this.budgetBytes && this.entries.size <= this.maxEntries) break;
      this.remove(entry);
      incrementPerformanceCounter("canvas-image-cache-eviction");
    }
  }

  private remove(entry: CacheEntry) {
    if (entry.refs > 0 || this.entries.get(entry.key) !== entry) return;
    this.entries.delete(entry.key);
    this.totalBytes = Math.max(0, this.totalBytes - entry.bytes);
  }
}

export const decodedCanvasImageCache = new DecodedCanvasImageCache();

export function configureDecodedCanvasImageCacheForSystemMemory(totalSystemMemoryBytes?: number | null) {
  const budgetBytes = resolveCanvasImageCacheBudget(totalSystemMemoryBytes);
  decodedCanvasImageCache.configureBudget(budgetBytes);
  return budgetBytes;
}

function retainedEntry(entry: CacheEntry, releaseEntry: () => void): RetainedDecodedCanvasImage {
  let released = false;
  return {
    key: entry.key,
    promise: entry.promise,
    release() {
      if (released) return;
      released = true;
      releaseEntry();
    }
  };
}

function oldestUnusedEntries(entries: Map<string, CacheEntry>) {
  return [...entries.values()]
    .filter((entry) => entry.refs === 0 && entry.state !== "pending")
    .sort((left, right) => left.lastUsed - right.lastUsed);
}

function decodedImageBytes(image: HTMLImageElement) {
  return Math.max(1, image.naturalWidth) * Math.max(1, image.naturalHeight) * 4;
}

async function loadDecodedImage(src: string) {
  if (typeof window === "undefined") throw new Error("Image decoding is unavailable outside the renderer.");
  const image = new window.Image();
  image.decoding = "async";
  if (shouldUseAnonymousImageCrossOrigin(src)) image.crossOrigin = "anonymous";

  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => {
      void decodeLoadedImage(image).then(() => {
        image.onload = null;
        image.onerror = null;
        resolve(image);
      });
    };
    image.onerror = () => {
      image.onload = null;
      image.onerror = null;
      reject(new Error(`Unable to load canvas image: ${src}`));
    };
    image.src = src;
  });
}

async function decodeLoadedImage(image: HTMLImageElement) {
  if (typeof image.decode !== "function") return;
  try {
    await image.decode();
  } catch {
    // A completed image is still drawable when decode() is unavailable for its format or origin.
  }
}

function shouldUseAnonymousImageCrossOrigin(src: string) {
  if (!/^https?:\/\//i.test(src)) return false;
  try {
    const url = new URL(src);
    if (isXiaohongshuImageHost(url.hostname)) return false;
    return url.hostname !== "asset.localhost" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

function isXiaohongshuImageHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (host.endsWith(".xhscdn.com") && (host.startsWith("sns-img") || host.startsWith("sns-webpic"))) || host === "ci.xiaohongshu.com" || host.endsWith(".ci.xiaohongshu.com");
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}
