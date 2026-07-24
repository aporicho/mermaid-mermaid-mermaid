import { useEffect, useRef, useState } from "react";

import type { CanvasNodePreviewPositions } from "@/features/mermaid-editor/lib/canvas-motion";

type DragPositionMap = Record<string, { x: number; y: number }>;

export function useKonvaDragDraft() {
  const dragRef = useRef<DragPositionMap | null>(null);
  const subgraphDragFrameRef = useRef<DragPositionMap | null>(null);
  const dragFinalPositionsRef = useRef<CanvasNodePreviewPositions | null>(null);
  const dragPreviewFrameRef = useRef<number | null>(null);
  const pendingDragPreviewPositionsRef = useRef<CanvasNodePreviewPositions | null>(null);
  const [dragPreviewPositions, setDragPreviewPositions] = useState<CanvasNodePreviewPositions | null>(null);

  function setDragPreviewPositionsVisual(positions: CanvasNodePreviewPositions | null) {
    pendingDragPreviewPositionsRef.current = null;
    if (dragPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(dragPreviewFrameRef.current);
      dragPreviewFrameRef.current = null;
    }
    setDragPreviewPositions(positions);
  }

  function scheduleDragPreviewPositionsVisual(positions: CanvasNodePreviewPositions) {
    dragFinalPositionsRef.current = positions;
    pendingDragPreviewPositionsRef.current = positions;
    if (dragPreviewFrameRef.current !== null) return;
    dragPreviewFrameRef.current = window.requestAnimationFrame(() => {
      dragPreviewFrameRef.current = null;
      const pending = pendingDragPreviewPositionsRef.current;
      pendingDragPreviewPositionsRef.current = null;
      if (pending) setDragPreviewPositions(pending);
    });
  }

  function clearDragRuntimeState() {
    if (dragPreviewFrameRef.current !== null) window.cancelAnimationFrame(dragPreviewFrameRef.current);
    dragPreviewFrameRef.current = null;
    pendingDragPreviewPositionsRef.current = null;
    dragRef.current = null;
    subgraphDragFrameRef.current = null;
    dragFinalPositionsRef.current = null;
    setDragPreviewPositions(null);
  }

  useEffect(() => {
    return () => {
      if (dragPreviewFrameRef.current !== null) window.cancelAnimationFrame(dragPreviewFrameRef.current);
    };
  }, []);

  return {
    dragRef,
    subgraphDragFrameRef,
    dragFinalPositionsRef,
    dragPreviewPositions,
    setDragPreviewPositionsVisual,
    scheduleDragPreviewPositionsVisual,
    clearDragRuntimeState
  };
}
