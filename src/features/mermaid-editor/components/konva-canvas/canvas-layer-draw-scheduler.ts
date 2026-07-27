import type Konva from "konva";

import { measurePerformance } from "@/features/mermaid-editor/lib/editor-performance";

export const CANVAS_HIT_GRAPH_SETTLE_MS = 80;

const pendingHitDraws = new WeakMap<Konva.Stage, ReturnType<typeof setTimeout>>();

export function drawCanvasViewportScene(stage: Konva.Stage) {
  cancelPendingHitDraw(stage);
  for (const layer of stage.getLayers()) {
    measurePerformance("canvas-layer-scene-draw", () => layer.drawScene(), {
      layer: layer.name() || "unnamed"
    });
  }
  pendingHitDraws.set(stage, setTimeout(() => flushCanvasHitGraph(stage), CANVAS_HIT_GRAPH_SETTLE_MS));
}

export function flushCanvasHitGraph(stage: Konva.Stage | null | undefined) {
  if (!stage) return;
  cancelPendingHitDraw(stage);
  for (const layer of stage.getLayers()) {
    if (!layer.isListening() || !layer.isVisible()) continue;
    measurePerformance("canvas-layer-hit-draw", () => layer.drawHit(), {
      layer: layer.name() || "unnamed"
    });
  }
}

export function cancelCanvasHitGraphDraw(stage: Konva.Stage | null | undefined) {
  if (stage) cancelPendingHitDraw(stage);
}

function cancelPendingHitDraw(stage: Konva.Stage) {
  const pending = pendingHitDraws.get(stage);
  if (pending !== undefined) clearTimeout(pending);
  pendingHitDraws.delete(stage);
}
