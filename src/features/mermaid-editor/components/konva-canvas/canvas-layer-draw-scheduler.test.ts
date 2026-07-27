import type Konva from "konva";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CANVAS_HIT_GRAPH_SETTLE_MS,
  drawCanvasViewportScene,
  flushCanvasHitGraph
} from "@/features/mermaid-editor/components/konva-canvas/canvas-layer-draw-scheduler";

describe("canvas layer draw scheduler", () => {
  afterEach(() => vi.useRealTimers());

  it("draws scene canvases immediately and defers listening hit canvases", () => {
    vi.useFakeTimers();
    const visualLayer = fakeLayer("visual", false);
    const interactionLayer = fakeLayer("interaction", true);
    const stage = { getLayers: () => [visualLayer, interactionLayer] } as unknown as Konva.Stage;

    drawCanvasViewportScene(stage);
    expect(visualLayer.drawScene).toHaveBeenCalledOnce();
    expect(interactionLayer.drawScene).toHaveBeenCalledOnce();
    expect(interactionLayer.drawHit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(CANVAS_HIT_GRAPH_SETTLE_MS);
    expect(visualLayer.drawHit).not.toHaveBeenCalled();
    expect(interactionLayer.drawHit).toHaveBeenCalledOnce();
  });

  it("flushes a pending hit draw before pointer interaction", () => {
    vi.useFakeTimers();
    const interactionLayer = fakeLayer("interaction", true);
    const stage = { getLayers: () => [interactionLayer] } as unknown as Konva.Stage;

    drawCanvasViewportScene(stage);
    flushCanvasHitGraph(stage);
    expect(interactionLayer.drawHit).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(interactionLayer.drawHit).toHaveBeenCalledOnce();
  });
});

function fakeLayer(name: string, listening: boolean) {
  return {
    name: () => name,
    isListening: () => listening,
    isVisible: () => true,
    drawScene: vi.fn(),
    drawHit: vi.fn()
  };
}
