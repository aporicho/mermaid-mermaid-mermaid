import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";

import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import {
  incrementPerformanceCounter,
  measurePerformance,
  updatePerformanceDiagnostic
} from "@/features/mermaid-editor/lib/editor-performance";

export const CANVAS_COMPOSITOR_SETTLE_MS = 80;
export const CANVAS_COMPOSITOR_MIN_PADDING_PX = 48;
export const CANVAS_COMPOSITOR_MAX_PADDING_PX = 160;
export const CANVAS_COMPOSITOR_COVERAGE_GUARD_PX = 16;

export type CanvasViewportSurface = {
  width: number;
  height: number;
  padding: number;
  viewportWidth: number;
  viewportHeight: number;
};

type AttachedLayers = {
  stage: Konva.Stage;
  backgroundLayer: Konva.Layer | null;
  sceneLayer: Konva.Layer;
  activeLayer: Konva.Layer;
};

export class CanvasViewportCompositor {
  private attached: AttachedLayers | null = null;
  private surface: CanvasViewportSurface = resolveCanvasViewportSurface({ width: 0, height: 0 });
  private liveViewport: ViewportState = { x: 0, y: 0, scale: 1 };
  private baseViewport: ViewportState = { x: 0, y: 0, scale: 1 };
  private requestedBase: ViewportState | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackCommitFrame: number | null = null;
  private activeDrawFrame: number | null = null;
  private navigationActive = false;
  private onBaseViewportChange: (viewport: ViewportState) => void = () => undefined;
  private compositeFrames = 0;
  private sceneDraws = 0;
  private activeDraws = 0;
  private rebases = 0;

  constructor(initialViewport: ViewportState = { x: 0, y: 0, scale: 1 }) {
    this.liveViewport = initialViewport;
    this.baseViewport = initialViewport;
  }

  setBaseViewportListener(listener: (viewport: ViewportState) => void) {
    this.onBaseViewportChange = listener;
  }

  configureSurface(surface: CanvasViewportSurface) {
    const changed = surface.width !== this.surface.width
      || surface.height !== this.surface.height
      || surface.padding !== this.surface.padding;
    this.surface = surface;
    if (changed && this.attached) this.requestRebase(this.liveViewport, "surface");
  }

  attach(layers: AttachedLayers) {
    this.detachCanvasTransforms();
    this.attached = layers;
    this.configureSceneOnlyLayers();
    this.prepareStableTransforms();
    this.applyStageViewport(this.liveViewport);
    this.applyStableComposite(this.liveViewport);
  }

  detach() {
    this.detachCanvasTransforms();
    this.attached = null;
    this.cancelTimers();
  }

  sync(viewport: ViewportState) {
    this.liveViewport = viewport;
    this.baseViewport = viewport;
    this.requestedBase = null;
    this.applyStageViewport(viewport);
    this.applyStableComposite(viewport);
    this.onBaseViewportChange(viewport);
  }

  acceptExternalViewport(viewport: ViewportState) {
    if (!sameViewport(this.liveViewport, viewport)) this.apply(viewport);
  }

  apply(viewport: ViewportState) {
    if (sameViewport(this.liveViewport, viewport)) return;
    this.liveViewport = viewport;
    const attached = this.attached;
    if (!attached) return;
    this.applyStageViewport(viewport);
    this.applyStableComposite(viewport);
    this.scheduleActiveDraw();
    this.compositeFrames += 1;
    incrementPerformanceCounter("canvas-compositor-frame");

    if (!this.compositeCoversViewport(viewport)) this.requestRebase(viewport, "coverage");
    this.scheduleSettle();
    this.publishDiagnostics();
  }

  commitScene(viewport: ViewportState, reason = "react") {
    const attached = this.attached;
    if (!attached) return;
    const liveViewport = this.liveViewport;
    this.applyStageViewport(viewport);
    this.configureSceneOnlyLayers();
    measurePerformance("canvas-compositor-scene-commit", () => {
      attached.backgroundLayer?.drawScene();
      attached.sceneLayer.drawScene();
    }, { reason });
    this.sceneDraws += 1;
    incrementPerformanceCounter("canvas-compositor-scene-draw");
    this.baseViewport = viewport;
    this.requestedBase = null;
    this.applyStageViewport(liveViewport);
    this.applyStableComposite(liveViewport);
    this.scheduleActiveDraw();
    if (this.fallbackCommitFrame !== null) cancelAnimationFrame(this.fallbackCommitFrame);
    this.fallbackCommitFrame = null;
    this.publishDiagnostics();
  }

  invalidateScene(reason = "scene") {
    this.commitScene(this.liveViewport, reason);
  }

  scheduleActiveDraw() {
    if (this.activeDrawFrame !== null) return;
    this.activeDrawFrame = requestAnimationFrame(() => {
      this.activeDrawFrame = null;
      const activeLayer = this.attached?.activeLayer;
      if (!activeLayer) return;
      measurePerformance("canvas-compositor-active-draw", () => activeLayer.drawScene());
      this.activeDraws += 1;
      incrementPerformanceCounter("canvas-compositor-active-draw");
      this.publishDiagnostics();
    });
  }

  flushActiveDraw() {
    if (this.activeDrawFrame !== null) cancelAnimationFrame(this.activeDrawFrame);
    this.activeDrawFrame = null;
    const activeLayer = this.attached?.activeLayer;
    if (!activeLayer) return;
    measurePerformance("canvas-compositor-active-draw", () => activeLayer.drawScene(), { reason: "flush" });
    this.activeDraws += 1;
    incrementPerformanceCounter("canvas-compositor-active-draw");
    this.publishDiagnostics();
  }

  beginNavigation() {
    if (this.navigationActive) return;
    this.navigationActive = true;
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = null;
  }

  endNavigation() {
    this.navigationActive = false;
    this.flushActiveDraw();
    if (!sameViewport(this.baseViewport, this.liveViewport)) this.requestRebase(this.liveViewport, "interaction-end");
  }

  currentViewport() {
    return this.liveViewport;
  }

  private requestRebase(viewport: ViewportState, reason: string) {
    if (this.requestedBase && sameViewport(this.requestedBase, viewport)) return;
    this.requestedBase = viewport;
    this.rebases += 1;
    incrementPerformanceCounter(`canvas-compositor-rebase-${reason}`);
    this.onBaseViewportChange(viewport);

    if (this.fallbackCommitFrame !== null) cancelAnimationFrame(this.fallbackCommitFrame);
    const deferFallback = reason === "interaction-end" || reason === "settle";
    this.fallbackCommitFrame = requestAnimationFrame(() => {
      this.fallbackCommitFrame = null;
      if (!this.requestedBase || !sameViewport(this.requestedBase, viewport)) return;

      // A completed gesture also updates React's render viewport. Give that
      // layout commit the next paint opportunity so the stable scene is not
      // drawn once by the fallback and immediately drawn again by React.
      if (deferFallback) {
        this.fallbackCommitFrame = requestAnimationFrame(() => {
          this.fallbackCommitFrame = null;
          if (this.requestedBase && sameViewport(this.requestedBase, viewport)) {
            this.commitScene(viewport, `${reason}-fallback`);
          }
        });
        return;
      }

      this.commitScene(viewport, `${reason}-fallback`);
    });
  }

  private scheduleSettle() {
    if (this.navigationActive) return;
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      if (!sameViewport(this.baseViewport, this.liveViewport)) this.requestRebase(this.liveViewport, "settle");
    }, CANVAS_COMPOSITOR_SETTLE_MS);
  }

  private applyStageViewport(viewport: ViewportState) {
    const stage = this.attached?.stage;
    if (!stage) return;
    stage.position({ x: this.surface.padding + viewport.x, y: this.surface.padding + viewport.y });
    stage.scale({ x: viewport.scale, y: viewport.scale });
  }

  private applyStableComposite(viewport: ViewportState) {
    const { cssTransform: transform } = resolveCanvasCompositeTransform(this.baseViewport, viewport, this.surface.padding);
    for (const layer of this.stableLayers()) {
      const canvas = layer.getNativeCanvasElement();
      canvas.style.transformOrigin = "0 0";
      canvas.style.transform = transform;
      canvas.style.willChange = "transform";
    }
  }

  private compositeCoversViewport(viewport: ViewportState) {
    return canvasCompositeCoversViewport(this.baseViewport, viewport, this.surface);
  }

  private configureSceneOnlyLayers() {
    for (const layer of this.allLayers()) {
      layer.listening(false);
      layer.getHitCanvas().setSize(1, 1);
    }
  }

  private prepareStableTransforms() {
    for (const layer of this.stableLayers()) {
      const canvas = layer.getNativeCanvasElement();
      canvas.style.transformOrigin = "0 0";
      canvas.style.transform = "matrix(1, 0, 0, 1, 0, 0)";
      canvas.style.willChange = "transform";
    }
  }

  private clearStableTransforms() {
    for (const layer of this.stableLayers()) {
      const canvas = layer.getNativeCanvasElement();
      canvas.style.transform = "";
      canvas.style.transformOrigin = "";
      canvas.style.willChange = "";
    }
  }

  private detachCanvasTransforms() {
    this.clearStableTransforms();
  }

  private stableLayers() {
    const attached = this.attached;
    return attached ? [attached.backgroundLayer, attached.sceneLayer].filter((layer): layer is Konva.Layer => Boolean(layer)) : [];
  }

  private allLayers() {
    const attached = this.attached;
    return attached ? [attached.backgroundLayer, attached.sceneLayer, attached.activeLayer].filter((layer): layer is Konva.Layer => Boolean(layer)) : [];
  }

  private cancelTimers() {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    if (this.fallbackCommitFrame !== null) cancelAnimationFrame(this.fallbackCommitFrame);
    if (this.activeDrawFrame !== null) cancelAnimationFrame(this.activeDrawFrame);
    this.settleTimer = null;
    this.fallbackCommitFrame = null;
    this.activeDrawFrame = null;
  }

  private publishDiagnostics() {
    updatePerformanceDiagnostic("canvasCompositor", {
      compositeFrames: this.compositeFrames,
      sceneDraws: this.sceneDraws,
      activeDraws: this.activeDraws,
      rebases: this.rebases,
      padding: this.surface.padding,
      surfaceWidth: this.surface.width,
      surfaceHeight: this.surface.height,
      layerCount: this.allLayers().length,
      hitBufferPixels: this.allLayers().length,
      baseViewport: this.baseViewport,
      liveViewport: this.liveViewport,
      navigationActive: this.navigationActive
    });
  }
}

export function useCanvasViewportCompositor(viewport: ViewportState, dimensions: { width: number; height: number }) {
  const [renderViewport, setRenderViewport] = useState(viewport);
  const controllerRef = useRef<CanvasViewportCompositor | null>(null);
  controllerRef.current ??= new CanvasViewportCompositor(viewport);
  const controller = controllerRef.current;
  const surface = useMemo(
    () => resolveCanvasViewportSurface({ width: dimensions.width, height: dimensions.height }),
    [dimensions.height, dimensions.width]
  );

  useLayoutEffect(() => {
    controller.setBaseViewportListener((next) => setRenderViewport((current) => sameViewport(current, next) ? current : next));
    controller.configureSurface(surface);
  }, [controller, surface]);

  useLayoutEffect(() => {
    controller.acceptExternalViewport(viewport);
    setRenderViewport((current) => sameViewport(current, viewport) ? current : viewport);
  }, [controller, viewport]);

  useEffect(() => () => controller.detach(), [controller]);

  return { controller, renderViewport, surface };
}

export function resolveCanvasViewportSurface(dimensions: { width: number; height: number }): CanvasViewportSurface {
  const width = Math.max(0, Math.round(dimensions.width));
  const height = Math.max(0, Math.round(dimensions.height));
  if (width === 0 || height === 0) return { width, height, padding: 0, viewportWidth: width, viewportHeight: height };
  const sum = width + height;
  const budgetPadding = Math.floor((-sum + Math.sqrt(sum * sum + (4 * width * height) / 3)) / 4);
  const padding = Math.max(0, Math.min(CANVAS_COMPOSITOR_MAX_PADDING_PX, budgetPadding >= CANVAS_COMPOSITOR_MIN_PADDING_PX ? budgetPadding : Math.max(0, budgetPadding)));
  return {
    width: width + padding * 2,
    height: height + padding * 2,
    padding,
    viewportWidth: width,
    viewportHeight: height
  };
}

export function resolveCanvasCompositeTransform(base: ViewportState, live: ViewportState, padding: number) {
  const ratio = live.scale / Math.max(0.0001, base.scale);
  const translateX = padding + live.x - ratio * (padding + base.x);
  const translateY = padding + live.y - ratio * (padding + base.y);
  return {
    ratio,
    translateX,
    translateY,
    cssTransform: `matrix(${ratio}, 0, 0, ${ratio}, ${translateX}, ${translateY})`
  };
}

export function canvasCompositeCoversViewport(base: ViewportState, live: ViewportState, surface: CanvasViewportSurface) {
  const { ratio, translateX, translateY } = resolveCanvasCompositeTransform(base, live, surface.padding);
  const left = -surface.padding + translateX;
  const top = -surface.padding + translateY;
  const right = left + surface.width * ratio;
  const bottom = top + surface.height * ratio;
  const guard = CANVAS_COMPOSITOR_COVERAGE_GUARD_PX;
  return left <= -guard && top <= -guard
    && right >= surface.viewportWidth + guard && bottom >= surface.viewportHeight + guard;
}

function sameViewport(left: ViewportState, right: ViewportState) {
  return Math.abs(left.x - right.x) < 0.001
    && Math.abs(left.y - right.y) < 0.001
    && Math.abs(left.scale - right.scale) < 0.000001;
}
