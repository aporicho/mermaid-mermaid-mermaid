import { useEffect, useRef, useState } from "react";

import {
  normalizeProximityScales,
  proximityScaleMapsEqual
} from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { NodeProximityRuntime } from "@/features/mermaid-editor/components/konva-canvas/types";
import type { CanvasPoint } from "@/features/mermaid-editor/lib/canvas-interaction";
import {
  resolveCanvasProximityScales,
  resolveNextCanvasProximityScales,
  type CanvasProximityScales
} from "@/features/mermaid-editor/lib/canvas-motion";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

type UseKonvaNodeProximityArgs = {
  currentViewport: () => ViewportState;
};

export function useKonvaNodeProximity({ currentViewport }: UseKonvaNodeProximityArgs) {
  const nodeProximityScaleRef = useRef<CanvasProximityScales>({});
  const nodeProximityTargetScaleRef = useRef<CanvasProximityScales>({});
  const nodeProximityFrameRef = useRef<number | null>(null);
  const nodeProximityLastTickAtRef = useRef<number | null>(null);
  const lastProximityPointerScreenRef = useRef<CanvasPoint | null>(null);
  const nodeProximityRuntimeRef = useRef<NodeProximityRuntime>({
    interactive: false,
    frames: [],
    radiusPx: 0,
    maxScale: 1,
    durationMs: 0
  });
  const [nodeProximityScale, setNodeProximityScale] = useState<CanvasProximityScales>({});

  function syncNodeProximityRuntime(runtime: NodeProximityRuntime) {
    nodeProximityRuntimeRef.current = runtime;
  }

  function stopNodeProximityAnimation() {
    if (nodeProximityFrameRef.current === null) return;
    window.cancelAnimationFrame(nodeProximityFrameRef.current);
    nodeProximityFrameRef.current = null;
    nodeProximityLastTickAtRef.current = null;
  }

  function setNodeProximityScalesVisual(scales: CanvasProximityScales) {
    const normalized = normalizeProximityScales(scales);
    if (proximityScaleMapsEqual(nodeProximityScaleRef.current, normalized)) return;
    nodeProximityScaleRef.current = normalized;
    setNodeProximityScale(normalized);
  }

  function resolveNodeProximityTargetScales() {
    const runtime = nodeProximityRuntimeRef.current;
    const pointer = lastProximityPointerScreenRef.current;
    if (!runtime.interactive || !pointer) return {};

    return resolveCanvasProximityScales({
      frames: runtime.frames,
      pointerScreen: pointer,
      viewport: currentViewport(),
      radiusPx: runtime.radiusPx,
      maxScale: runtime.maxScale
    });
  }

  function scheduleNodeProximityAnimation() {
    if (nodeProximityFrameRef.current !== null) return;
    nodeProximityFrameRef.current = window.requestAnimationFrame(stepNodeProximityAnimation);
  }

  function stepNodeProximityAnimation(now: number) {
    const previousTickAt = nodeProximityLastTickAtRef.current ?? now - 16;
    nodeProximityLastTickAtRef.current = now;
    const target = normalizeProximityScales(resolveNodeProximityTargetScales());
    nodeProximityTargetScaleRef.current = target;
    const next = resolveNextCanvasProximityScales({
      current: nodeProximityScaleRef.current,
      target,
      deltaMs: Math.max(0, now - previousTickAt),
      durationMs: nodeProximityRuntimeRef.current.durationMs
    });

    setNodeProximityScalesVisual(next);

    if (Object.keys(next).length === 0 && Object.keys(target).length === 0) {
      nodeProximityFrameRef.current = null;
      nodeProximityLastTickAtRef.current = null;
      return;
    }

    nodeProximityFrameRef.current = window.requestAnimationFrame(stepNodeProximityAnimation);
  }

  function clearNodeProximityScales(immediate = false, options: { preservePointer?: boolean } = {}) {
    if (!options.preservePointer) lastProximityPointerScreenRef.current = null;
    nodeProximityTargetScaleRef.current = {};
    if (immediate) {
      stopNodeProximityAnimation();
      setNodeProximityScalesVisual({});
      return;
    }
    scheduleNodeProximityAnimation();
  }

  function updateNodeProximityScales(pointer: CanvasPoint) {
    lastProximityPointerScreenRef.current = pointer;
    if (!nodeProximityRuntimeRef.current.interactive) {
      clearNodeProximityScales(false, { preservePointer: true });
      return;
    }

    scheduleNodeProximityAnimation();
  }

  function refreshNodeProximityScales() {
    const pointer = lastProximityPointerScreenRef.current;
    if (pointer) updateNodeProximityScales(pointer);
  }

  function setLastProximityPointerScreen(pointer: CanvasPoint | null) {
    lastProximityPointerScreenRef.current = pointer;
  }

  useEffect(() => {
    return () => {
      if (nodeProximityFrameRef.current !== null) window.cancelAnimationFrame(nodeProximityFrameRef.current);
    };
  }, []);

  return {
    nodeProximityScale,
    syncNodeProximityRuntime,
    clearNodeProximityScales,
    updateNodeProximityScales,
    refreshNodeProximityScales,
    setLastProximityPointerScreen
  };
}
