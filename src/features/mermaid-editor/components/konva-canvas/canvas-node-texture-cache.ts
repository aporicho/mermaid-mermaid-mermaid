import type Konva from "konva";

import {
  incrementPerformanceCounter,
  recordPerformanceMetric,
  updatePerformanceDiagnostic
} from "@/features/mermaid-editor/lib/editor-performance";

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;

export const CANVAS_NODE_TEXTURE_CACHE_LOW_MEMORY_BUDGET_BYTES = 128 * MEBIBYTE;
export const CANVAS_NODE_TEXTURE_CACHE_MEDIUM_MEMORY_BUDGET_BYTES = 256 * MEBIBYTE;
export const CANVAS_NODE_TEXTURE_CACHE_HIGH_MEMORY_BUDGET_BYTES = 512 * MEBIBYTE;
export const CANVAS_NODE_TEXTURE_CACHE_FALLBACK_BUDGET_BYTES = CANVAS_NODE_TEXTURE_CACHE_MEDIUM_MEMORY_BUDGET_BYTES;
export const CANVAS_NODE_TEXTURE_CACHE_MAX_ENTRIES = 1024;
export const CANVAS_NODE_TEXTURE_CACHE_MAX_ENTRY_BYTES = 32 * MEBIBYTE;
export const CANVAS_NODE_TEXTURE_CACHE_SETTLE_MS = 80;
export const CANVAS_NODE_TEXTURE_CACHE_RESOLUTION_HEADROOM = 1.25;
export const CANVAS_NODE_TEXTURE_CACHE_HIT_PIXEL_RATIO = 0.01;

export type CanvasNodeTextureCacheKind = "standard" | "image" | "link-card" | "markdown-document" | "html-document" | "text-document" | "table";

export type CanvasNodeTextureCacheDescriptor = {
  id: string;
  key: string;
  kind: CanvasNodeTextureCacheKind;
  group: Konva.Group;
  enabled: boolean;
  priority: number;
};

export type CanvasNodeTextureCacheSnapshot = {
  entries: number;
  cachedEntries: number;
  bytes: number;
  budgetBytes: number;
  queuedEntries: number;
  viewportActive: boolean;
  interactionActive: boolean;
  liveScale: number;
  settledScale: number;
  byKind: Record<CanvasNodeTextureCacheKind, number>;
  registeredByKind: Record<CanvasNodeTextureCacheKind, number>;
  attachedEntries: number;
  blockedEntries: Record<string, number>;
};

type CacheEntry = CanvasNodeTextureCacheDescriptor & {
  cached: boolean;
  bytes: number;
  builtScale: number;
  maxSharpScale: number;
  lastUsed: number;
  queued: boolean;
  blocked: false | "empty" | "oversize" | "budget" | "error";
};

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: (deadline: IdleDeadlineLike) => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

let configuredBudgetBytes = CANVAS_NODE_TEXTURE_CACHE_FALLBACK_BUDGET_BYTES;
const activeControllers = new Set<CanvasNodeTextureCacheController>();
const cacheKeyObjectIds = new WeakMap<object, number>();
let nextCacheKeyObjectId = 1;

export function canvasStaticCacheKey(...parts: unknown[]) {
  return parts.map((part) => {
    if (part && (typeof part === "object" || typeof part === "function")) {
      const object = part as object;
      let id = cacheKeyObjectIds.get(object);
      if (!id) {
        id = nextCacheKeyObjectId++;
        cacheKeyObjectIds.set(object, id);
      }
      return `@${id}`;
    }
    return String(part ?? "");
  }).join("|");
}

export function resolveCanvasNodeTextureCacheBudget(totalSystemMemoryBytes?: number | null) {
  if (!Number.isFinite(totalSystemMemoryBytes) || !totalSystemMemoryBytes || totalSystemMemoryBytes <= 0) {
    return CANVAS_NODE_TEXTURE_CACHE_FALLBACK_BUDGET_BYTES;
  }
  if (totalSystemMemoryBytes <= 8 * GIBIBYTE) return CANVAS_NODE_TEXTURE_CACHE_LOW_MEMORY_BUDGET_BYTES;
  if (totalSystemMemoryBytes <= 16 * GIBIBYTE) return CANVAS_NODE_TEXTURE_CACHE_MEDIUM_MEMORY_BUDGET_BYTES;
  return CANVAS_NODE_TEXTURE_CACHE_HIGH_MEMORY_BUDGET_BYTES;
}

export function configureCanvasNodeTextureCacheForSystemMemory(totalSystemMemoryBytes?: number | null) {
  configuredBudgetBytes = resolveCanvasNodeTextureCacheBudget(totalSystemMemoryBytes);
  for (const controller of activeControllers) controller.configureBudget(configuredBudgetBytes);
  return configuredBudgetBytes;
}

export class CanvasNodeTextureCacheController {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly disabled: boolean;
  private readonly usesConfiguredBudget: boolean;
  private budgetBytes: number;
  private totalBytes = 0;
  private clock = 0;
  private idleHandle: number | ReturnType<typeof setTimeout> | null = null;
  private settleHandle: ReturnType<typeof setTimeout> | null = null;
  private viewportActive = false;
  private interactionActive = false;
  private liveScale = 1;
  private settledScale = 1;
  private canvasPixelRatio = 1;
  private destroyed = false;
  private active = false;
  private onVisualInvalidated: (layer: Konva.Layer | null, reason: string) => void = () => undefined;
  private readonly pendingVisualInvalidations = new Map<Konva.Layer | null, Set<string>>();

  constructor(options: { budgetBytes?: number; disabled?: boolean } = {}) {
    this.usesConfiguredBudget = options.budgetBytes === undefined;
    this.budgetBytes = Math.max(0, options.budgetBytes ?? configuredBudgetBytes);
    this.disabled = options.disabled ?? textureCacheDisabledByQuery();
  }

  activate() {
    if (this.destroyed) {
      this.destroyed = false;
      this.viewportActive = false;
      this.interactionActive = false;
      this.settledScale = this.liveScale;
    }
    if (this.active) return;
    this.active = true;
    if (this.usesConfiguredBudget) this.budgetBytes = configuredBudgetBytes;
    activeControllers.add(this);
  }

  setVisualInvalidationListener(listener: (layer: Konva.Layer | null, reason: string) => void) {
    this.onVisualInvalidated = listener;
  }

  configureCanvasPixelRatio(pixelRatio: number) {
    const next = finitePositive(pixelRatio, 1);
    if (next === this.canvasPixelRatio) return;
    this.canvasPixelRatio = next;
    this.invalidateAll("pixel-ratio");
  }

  configureBudget(budgetBytes: number) {
    this.budgetBytes = Math.max(0, budgetBytes);
    this.resetBlockedEntries();
    this.evictUntilWithinBudget();
    this.scheduleBuilds();
    this.publishSnapshot();
  }

  setInteractionActive(active: boolean) {
    if (this.interactionActive === active) return;
    this.interactionActive = active;
    if (active) this.cancelIdleBuild();
    else this.scheduleBuilds();
    this.publishSnapshot();
  }

  handleViewport(viewport: { x: number; y: number; scale: number }) {
    this.activate();
    const scale = finitePositive(viewport.scale, this.liveScale);
    this.liveScale = scale;
    this.viewportActive = true;
    this.cancelIdleBuild();

    if (this.settleHandle !== null) clearTimeout(this.settleHandle);
    this.settleHandle = setTimeout(() => {
      this.settleHandle = null;
      this.viewportActive = false;
      const settledScaleChanged = Math.abs(this.settledScale - this.liveScale) > 1e-6;
      this.settledScale = this.liveScale;
      if (settledScaleChanged) {
        this.resetBlockedEntries();
      }
      this.scheduleBuilds();
      this.publishSnapshot();
    }, CANVAS_NODE_TEXTURE_CACHE_SETTLE_MS);
    this.publishSnapshot();
  }

  upsert(descriptor: CanvasNodeTextureCacheDescriptor) {
    this.activate();
    const existing = this.entries.get(descriptor.id);
    if (existing && existing.group === descriptor.group && existing.key === descriptor.key) {
      existing.enabled = descriptor.enabled;
      existing.priority = descriptor.priority;
      existing.kind = descriptor.kind;
      existing.lastUsed = ++this.clock;
      if (!descriptor.enabled && existing.cached) this.clearEntry(existing, "disabled");
      this.scheduleBuilds();
      return;
    }

    if (existing) this.removeEntry(existing, "invalidated");
    const entry: CacheEntry = {
      ...descriptor,
      cached: false,
      bytes: 0,
      builtScale: 0,
      maxSharpScale: 0,
      lastUsed: ++this.clock,
      queued: false,
      blocked: false
    };
    this.entries.set(entry.id, entry);
    incrementPerformanceCounter("canvas-node-texture-cache-miss");
    this.scheduleBuilds();
    this.publishSnapshot();
  }

  unregister(id: string, group: Konva.Group) {
    const entry = this.entries.get(id);
    if (!entry || entry.group !== group) return;
    this.removeEntry(entry, "unmounted");
    this.scheduleBuilds();
    this.publishSnapshot();
  }

  invalidateAll(reason = "invalidated") {
    for (const entry of this.entries.values()) this.clearEntry(entry, reason);
    this.scheduleBuilds();
    this.publishSnapshot();
  }

  snapshot(): CanvasNodeTextureCacheSnapshot {
    const byKind = emptyKindCounts();
    const registeredByKind = emptyKindCounts();
    const blockedEntries: Record<string, number> = {};
    let cachedEntries = 0;
    let queuedEntries = 0;
    let attachedEntries = 0;
    for (const entry of this.entries.values()) {
      registeredByKind[entry.kind] += 1;
      if (entry.group.getStage()) attachedEntries += 1;
      if (entry.cached) {
        cachedEntries += 1;
        byKind[entry.kind] += 1;
      }
      if (entry.queued) queuedEntries += 1;
      if (entry.blocked) blockedEntries[entry.blocked] = (blockedEntries[entry.blocked] || 0) + 1;
    }
    return {
      entries: this.entries.size,
      cachedEntries,
      bytes: this.totalBytes,
      budgetBytes: this.budgetBytes,
      queuedEntries,
      viewportActive: this.viewportActive,
      interactionActive: this.interactionActive,
      liveScale: this.liveScale,
      settledScale: this.settledScale,
      byKind,
      registeredByKind,
      attachedEntries,
      blockedEntries
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelIdleBuild();
    if (this.settleHandle !== null) clearTimeout(this.settleHandle);
    this.settleHandle = null;
    for (const entry of [...this.entries.values()]) this.removeEntry(entry, "destroyed");
    this.active = false;
    activeControllers.delete(this);
    this.pendingVisualInvalidations.clear();
    this.publishSnapshot();
  }

  private scheduleBuilds() {
    if (this.disabled || this.destroyed || this.viewportActive || this.interactionActive || this.idleHandle !== null) return;
    const next = this.nextBuildEntry();
    if (!next) {
      this.flushVisualInvalidations();
      return;
    }
    next.queued = true;
    this.idleHandle = scheduleIdle((deadline) => {
      this.idleHandle = null;
      next.queued = false;
      if (!this.viewportActive && !this.interactionActive && !this.destroyed) this.buildEntry(next, deadline);
      this.scheduleBuilds();
    });
  }

  private nextBuildEntry() {
    return [...this.entries.values()]
      .filter((entry) => entry.enabled && this.entryNeedsBuild(entry) && !entry.queued && entry.group.getStage())
      .filter((entry) => !entry.blocked)
      .sort((left, right) => right.priority - left.priority || right.lastUsed - left.lastUsed)[0];
  }

  private buildEntry(entry: CacheEntry, _deadline: IdleDeadlineLike) {
    if (this.entries.get(entry.id) !== entry || !entry.enabled || !this.entryNeedsBuild(entry) || !entry.group.getStage()) return;
    const rect = entry.group.getClientRect({ skipTransform: true });
    if (!validCacheRect(rect)) {
      entry.blocked = "empty";
      incrementPerformanceCounter("canvas-node-texture-cache-skip-empty");
      return;
    }

    const pixelRatio = this.canvasPixelRatio * this.settledScale * CANVAS_NODE_TEXTURE_CACHE_RESOLUTION_HEADROOM;
    const bytes = estimateKonvaCacheBytes(rect.width, rect.height, pixelRatio, CANVAS_NODE_TEXTURE_CACHE_HIT_PIXEL_RATIO);
    const previousBytes = entry.cached ? entry.bytes : 0;
    if (bytes > CANVAS_NODE_TEXTURE_CACHE_MAX_ENTRY_BYTES) {
      entry.blocked = "oversize";
      incrementPerformanceCounter("canvas-node-texture-cache-skip-oversize");
      return;
    }

    this.evictFor(Math.max(0, bytes - previousBytes), entry.id);
    const nextEntryCount = this.cachedEntryCount() + (entry.cached ? 0 : 1);
    if (this.totalBytes - previousBytes + bytes > this.budgetBytes || nextEntryCount > CANVAS_NODE_TEXTURE_CACHE_MAX_ENTRIES) {
      entry.blocked = "budget";
      incrementPerformanceCounter("canvas-node-texture-cache-skip-budget");
      return;
    }

    const startedAt = now();
    try {
      if (entry.cached) entry.group.clearCache();
      entry.group.cache({
        x: Math.floor(rect.x),
        y: Math.floor(rect.y),
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        pixelRatio,
        hitCanvasPixelRatio: CANVAS_NODE_TEXTURE_CACHE_HIT_PIXEL_RATIO,
        imageSmoothingEnabled: true
      });
      compactCachedHitSurface(entry.group);
      entry.cached = true;
      entry.blocked = false;
      entry.bytes = bytes;
      entry.builtScale = this.settledScale;
      entry.maxSharpScale = this.settledScale * CANVAS_NODE_TEXTURE_CACHE_RESOLUTION_HEADROOM;
      entry.lastUsed = ++this.clock;
      this.totalBytes = Math.max(0, this.totalBytes - previousBytes) + bytes;
      incrementPerformanceCounter("canvas-node-texture-cache-build");
      recordPerformanceMetric("canvas-node-texture-cache-build", now() - startedAt, {
        kind: entry.kind,
        bytes,
        pixelRatio
      });
      this.queueVisualInvalidation(entry.group.getLayer(), `texture-cache-build-${entry.kind}`);
    } catch {
      entry.group.clearCache();
      this.totalBytes = Math.max(0, this.totalBytes - previousBytes);
      entry.cached = false;
      entry.bytes = 0;
      entry.builtScale = 0;
      entry.maxSharpScale = 0;
      entry.blocked = "error";
      incrementPerformanceCounter("canvas-node-texture-cache-build-error");
      this.queueVisualInvalidation(entry.group.getLayer(), `texture-cache-build-error-${entry.kind}`);
    }
    this.publishSnapshot();
  }

  private evictFor(bytes: number, protectedId: string) {
    const candidates = [...this.entries.values()]
      .filter((entry) => entry.cached && entry.id !== protectedId)
      .sort((left, right) => left.lastUsed - right.lastUsed);
    for (const entry of candidates) {
      if (this.totalBytes + bytes <= this.budgetBytes && this.cachedEntryCount() < CANVAS_NODE_TEXTURE_CACHE_MAX_ENTRIES) break;
      this.clearEntry(entry, "evicted");
    }
  }

  private evictUntilWithinBudget() {
    const candidates = [...this.entries.values()]
      .filter((entry) => entry.cached)
      .sort((left, right) => left.lastUsed - right.lastUsed);
    for (const entry of candidates) {
      if (this.totalBytes <= this.budgetBytes && this.cachedEntryCount() <= CANVAS_NODE_TEXTURE_CACHE_MAX_ENTRIES) break;
      this.clearEntry(entry, "evicted");
    }
  }

  private cachedEntryCount() {
    let count = 0;
    for (const entry of this.entries.values()) if (entry.cached) count += 1;
    return count;
  }

  private entryNeedsBuild(entry: CacheEntry) {
    return !entry.cached || this.settledScale > entry.maxSharpScale + 1e-6;
  }

  private clearEntry(entry: CacheEntry, reason: string) {
    if (!entry.cached) return;
    entry.group.clearCache();
    this.totalBytes = Math.max(0, this.totalBytes - entry.bytes);
    entry.cached = false;
    entry.bytes = 0;
    entry.builtScale = 0;
    entry.maxSharpScale = 0;
    if (reason === "evicted") incrementPerformanceCounter("canvas-node-texture-cache-eviction");
    else incrementPerformanceCounter(`canvas-node-texture-cache-clear-${reason}`);
    this.queueVisualInvalidation(entry.group.getLayer(), `texture-cache-clear-${reason}`);
  }

  private removeEntry(entry: CacheEntry, reason: string) {
    this.clearEntry(entry, reason);
    this.entries.delete(entry.id);
  }

  private cancelIdleBuild() {
    if (this.idleHandle === null) return;
    cancelIdle(this.idleHandle);
    this.idleHandle = null;
    for (const entry of this.entries.values()) entry.queued = false;
  }

  private resetBlockedEntries() {
    for (const entry of this.entries.values()) entry.blocked = false;
  }

  private queueVisualInvalidation(layer: Konva.Layer | null, reason: string) {
    const reasons = this.pendingVisualInvalidations.get(layer) ?? new Set<string>();
    reasons.add(reason);
    this.pendingVisualInvalidations.set(layer, reasons);
  }

  private flushVisualInvalidations() {
    if (this.viewportActive || this.interactionActive || this.destroyed) return;
    for (const [layer, reasons] of this.pendingVisualInvalidations) {
      this.onVisualInvalidated(layer, [...reasons].join("+"));
    }
    this.pendingVisualInvalidations.clear();
  }

  private publishSnapshot() {
    updatePerformanceDiagnostic("canvasNodeTextureCache", this.snapshot());
  }
}

export function estimateKonvaCacheBytes(width: number, height: number, pixelRatio: number, hitPixelRatio: number) {
  const pixels = Math.max(1, Math.ceil(width)) * Math.max(1, Math.ceil(height));
  return Math.ceil(pixels * 4 * (pixelRatio * pixelRatio * 2 + hitPixelRatio * hitPixelRatio));
}

function validCacheRect(rect: { x: number; y: number; width: number; height: number }) {
  return Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0;
}

function compactCachedHitSurface(group: Konva.Group) {
  type CachedCanvas = { hit?: { setSize: (width: number, height: number) => void } };
  const internal = group as Konva.Group & { _cache?: Map<string, CachedCanvas> };
  internal._cache?.get("canvas")?.hit?.setSize(1, 1);
}

function scheduleIdle(callback: (deadline: IdleDeadlineLike) => void) {
  const idleWindow = typeof window === "undefined" ? undefined : window as IdleWindow;
  if (idleWindow?.requestIdleCallback) return idleWindow.requestIdleCallback(callback, { timeout: 240 });
  return setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 16);
}

function cancelIdle(handle: number | ReturnType<typeof setTimeout>) {
  const idleWindow = typeof window === "undefined" ? undefined : window as IdleWindow;
  if (idleWindow?.cancelIdleCallback && typeof handle === "number") idleWindow.cancelIdleCallback(handle);
  else clearTimeout(handle);
}

function finitePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function emptyKindCounts(): Record<CanvasNodeTextureCacheKind, number> {
  return {
    standard: 0,
    image: 0,
    "link-card": 0,
    "markdown-document": 0,
    "html-document": 0,
    "text-document": 0,
    table: 0
  };
}

function textureCacheDisabledByQuery() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("canvasNodeTextureCache") === "off";
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}
