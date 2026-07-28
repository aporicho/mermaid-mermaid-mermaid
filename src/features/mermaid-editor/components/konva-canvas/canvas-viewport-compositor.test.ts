import type Konva from "konva";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CanvasViewportCompositor,
  canvasCompositeCoversViewport,
  resolveCanvasCompositeTransform,
  resolveCanvasViewportSurface
} from "@/features/mermaid-editor/components/konva-canvas/canvas-viewport-compositor";

describe("canvas viewport compositor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps three padded scene canvases within the previous four-layer pixel budget", () => {
    const viewport = { width: 1920, height: 1080 };
    const surface = resolveCanvasViewportSurface(viewport);
    expect(3 * surface.width * surface.height).toBeLessThanOrEqual(4 * viewport.width * viewport.height);
    expect(surface.padding).toBeGreaterThan(0);
  });

  it("maps a stable layer from its base viewport to the live viewport", () => {
    const base = { x: 40, y: 20, scale: 1 };
    const live = { x: 80, y: 55, scale: 2 };
    const transform = resolveCanvasCompositeTransform(base, live, 100);
    const world = { x: 140, y: 90 };
    const basePixel = { x: 100 + base.x + world.x * base.scale, y: 100 + base.y + world.y * base.scale };
    expect(basePixel.x * transform.ratio + transform.translateX).toBeCloseTo(100 + live.x + world.x * live.scale);
    expect(basePixel.y * transform.ratio + transform.translateY).toBeCloseTo(100 + live.y + world.y * live.scale);
  });

  it("requests a rebase once a composite moves outside padded coverage", () => {
    const surface = resolveCanvasViewportSurface({ width: 1200, height: 800 });
    const base = { x: 0, y: 0, scale: 1 };
    expect(canvasCompositeCoversViewport(base, { x: 20, y: 0, scale: 1 }, surface)).toBe(true);
    expect(canvasCompositeCoversViewport(base, { x: surface.padding + 40, y: 0, scale: 1 }, surface)).toBe(false);
  });

  it("keeps stable canvases promoted while committing a new base viewport", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const background = fakeLayer();
    const scene = fakeLayer();
    const active = fakeLayer();
    const stage = {
      position: vi.fn(),
      scale: vi.fn()
    } as unknown as Konva.Stage;
    const compositor = new CanvasViewportCompositor({ x: 0, y: 0, scale: 1 });

    compositor.configureSurface(resolveCanvasViewportSurface({ width: 1200, height: 800 }));
    compositor.attach({
      stage,
      backgroundLayer: background.layer,
      sceneLayer: scene.layer,
      activeLayer: active.layer
    });
    compositor.beginNavigation();
    compositor.apply({ x: 36, y: 24, scale: 1 });
    compositor.commitScene({ x: 36, y: 24, scale: 1 }, "test");

    for (const stable of [background, scene]) {
      expect(stable.style.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
      expect(stable.style.transformOrigin).toBe("0 0");
      expect(stable.style.willChange).toBe("transform");
      expect(stable.transformWrites).not.toContain("");
    }

    compositor.detach();
    expect(background.transformWrites.at(-1)).toBe("");
    expect(scene.transformWrites.at(-1)).toBe("");
  });

  it("draws the active layer in the same task as a live viewport transform", () => {
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      animationFrames.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => animationFrames.delete(id)));
    const background = fakeLayer();
    const scene = fakeLayer();
    const active = fakeLayer();
    const compositor = new CanvasViewportCompositor({ x: 0, y: 0, scale: 1 });

    compositor.configureSurface(resolveCanvasViewportSurface({ width: 1200, height: 800 }));
    compositor.attach({
      stage: { position: vi.fn(), scale: vi.fn() } as unknown as Konva.Stage,
      backgroundLayer: background.layer,
      sceneLayer: scene.layer,
      activeLayer: active.layer
    });
    compositor.beginNavigation();
    compositor.apply({ x: 20, y: 12, scale: 1.1 });

    expect(scene.style.transform).not.toBe("matrix(1, 0, 0, 1, 0, 0)");
    expect(active.layer.drawScene).toHaveBeenCalledTimes(1);
    expect(animationFrames.size).toBe(0);
  });

  it("coalesces scene invalidations until navigation ends", () => {
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      animationFrames.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => animationFrames.delete(id)));
    const background = fakeLayer();
    const scene = fakeLayer();
    const active = fakeLayer();
    const compositor = new CanvasViewportCompositor({ x: 0, y: 0, scale: 1 });
    compositor.configureSurface(resolveCanvasViewportSurface({ width: 1200, height: 800 }));
    compositor.attach({
      stage: { position: vi.fn(), scale: vi.fn() } as unknown as Konva.Stage,
      backgroundLayer: background.layer,
      sceneLayer: scene.layer,
      activeLayer: active.layer
    });

    compositor.beginNavigation();
    compositor.invalidateScene("image-decode");
    compositor.invalidateScene("texture-cache");
    expect(scene.layer.drawScene).not.toHaveBeenCalled();
    compositor.endNavigation();
    expect(animationFrames.size).toBe(1);
    runAllAnimationFrames(animationFrames);

    expect(background.layer.drawScene).toHaveBeenCalledTimes(1);
    expect(scene.layer.drawScene).toHaveBeenCalledTimes(1);
  });

  it("holds a composited guard until a rebase has redrawn every layer", () => {
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      animationFrames.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => animationFrames.delete(id)));
    const background = fakeLayer();
    const scene = fakeLayer();
    const active = fakeLayer();
    const context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn()
    };
    const guard = {
      width: 0,
      height: 0,
      hidden: true,
      style: { width: "", height: "", display: "none" },
      getContext: vi.fn(() => context)
    } as unknown as HTMLCanvasElement;
    const compositor = new CanvasViewportCompositor({ x: 0, y: 0, scale: 1 });
    const nextViewport = { x: 40, y: 25, scale: 1.2 };
    compositor.configureSurface(resolveCanvasViewportSurface({ width: 1200, height: 800 }));
    compositor.attach({
      stage: { position: vi.fn(), scale: vi.fn() } as unknown as Konva.Stage,
      backgroundLayer: background.layer,
      sceneLayer: scene.layer,
      activeLayer: active.layer,
      rebaseGuardCanvas: guard
    });
    compositor.beginNavigation();
    compositor.apply(nextViewport);
    compositor.commitScene(nextViewport, "test-rebase");

    expect(guard.hidden).toBe(false);
    expect(context.drawImage).toHaveBeenCalledTimes(3);
    expect(scene.layer.drawScene).toHaveBeenCalledTimes(1);
    expect(active.layer.drawScene).toHaveBeenCalledTimes(2);
    runAllAnimationFrames(animationFrames);
    expect(guard.hidden).toBe(true);
  });

  it("lets the React scene commit win before the interaction-end fallback", () => {
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      animationFrames.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => animationFrames.delete(id)));
    const background = fakeLayer();
    const scene = fakeLayer();
    const active = fakeLayer();
    const stage = {
      position: vi.fn(),
      scale: vi.fn()
    } as unknown as Konva.Stage;
    const compositor = new CanvasViewportCompositor({ x: 0, y: 0, scale: 1 });
    const finalViewport = { x: -140, y: -90, scale: 1.8 };

    compositor.configureSurface(resolveCanvasViewportSurface({ width: 1200, height: 800 }));
    compositor.attach({
      stage,
      backgroundLayer: background.layer,
      sceneLayer: scene.layer,
      activeLayer: active.layer
    });
    compositor.beginNavigation();
    compositor.apply(finalViewport);
    compositor.endNavigation();

    runNextAnimationFrame(animationFrames);
    expect(scene.layer.drawScene).not.toHaveBeenCalled();

    compositor.commitScene(finalViewport, "react");
    runAllAnimationFrames(animationFrames);

    expect(background.layer.drawScene).toHaveBeenCalledTimes(1);
    expect(scene.layer.drawScene).toHaveBeenCalledTimes(1);
  });
});

function runNextAnimationFrame(frames: Map<number, FrameRequestCallback>) {
  const next = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
  if (!next) return;
  frames.delete(next[0]);
  next[1](performance.now());
}

function runAllAnimationFrames(frames: Map<number, FrameRequestCallback>) {
  while (frames.size > 0) runNextAnimationFrame(frames);
}

function fakeLayer() {
  let transform = "";
  const transformWrites: string[] = [];
  const style = {
    get transform() {
      return transform;
    },
    set transform(value: string) {
      transform = value;
      transformWrites.push(value);
    },
    transformOrigin: "",
    willChange: ""
  };
  const canvas = { style, width: 1600, height: 1000 };
  const layer = {
    listening: vi.fn(),
    getHitCanvas: () => ({ setSize: vi.fn() }),
    getNativeCanvasElement: () => canvas,
    drawScene: vi.fn()
  } as unknown as Konva.Layer;
  return { layer, style, transformWrites };
}
