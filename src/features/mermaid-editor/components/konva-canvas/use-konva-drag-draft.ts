import { useEffect, useRef } from "react";

import { CanvasDragPreviewStore, type CanvasSubgraphPreviewPositions } from "@/features/mermaid-editor/components/konva-canvas/canvas-drag-preview-store";
import type { CanvasNodePreviewPositions } from "@/features/mermaid-editor/lib/canvas-motion";

type DragPositionMap = Record<string, { x: number; y: number }>;

export function useKonvaDragDraft() {
  const dragRef = useRef<DragPositionMap | null>(null);
  const subgraphDragFrameRef = useRef<DragPositionMap | null>(null);
  const dragFinalPositionsRef = useRef<CanvasNodePreviewPositions | null>(null);
  const committedDragPositionsRef = useRef<CanvasNodePreviewPositions | null>(null);
  const dragPreviewFrameRef = useRef<number | null>(null);
  const pendingDragPreviewRef = useRef<{ nodePositions: CanvasNodePreviewPositions; subgraphPositions: CanvasSubgraphPreviewPositions } | null>(null);
  const dragPreviewStoreRef = useRef<CanvasDragPreviewStore | null>(null);
  dragPreviewStoreRef.current ??= new CanvasDragPreviewStore();
  const dragPreviewStore = dragPreviewStoreRef.current;

  function setDragPreviewPositionsVisual(positions: CanvasNodePreviewPositions | null, subgraphPositions: CanvasSubgraphPreviewPositions = {}) {
    pendingDragPreviewRef.current = null;
    if (dragPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(dragPreviewFrameRef.current);
      dragPreviewFrameRef.current = null;
    }
    dragPreviewStore.publish(positions ? { nodePositions: positions, subgraphPositions } : null);
  }

  function scheduleDragPreviewPositionsVisual(positions: CanvasNodePreviewPositions, subgraphPositions: CanvasSubgraphPreviewPositions = {}) {
    dragFinalPositionsRef.current = positions;
    pendingDragPreviewRef.current = { nodePositions: positions, subgraphPositions };
    if (dragPreviewFrameRef.current !== null) return;
    dragPreviewFrameRef.current = window.requestAnimationFrame(() => {
      dragPreviewFrameRef.current = null;
      const pending = pendingDragPreviewRef.current;
      pendingDragPreviewRef.current = null;
      if (pending) dragPreviewStore.publish(pending);
    });
  }

  function flushScheduledDragPreview() {
    if (dragPreviewFrameRef.current !== null) window.cancelAnimationFrame(dragPreviewFrameRef.current);
    dragPreviewFrameRef.current = null;
    const pending = pendingDragPreviewRef.current;
    pendingDragPreviewRef.current = null;
    if (pending) dragPreviewStore.publish(pending);
  }

  function beginDragRuntimeState() {
    committedDragPositionsRef.current = null;
    setDragPreviewPositionsVisual(null);
    dragFinalPositionsRef.current = null;
  }

  function markDragPositionsCommitted(positions: CanvasNodePreviewPositions) {
    committedDragPositionsRef.current = positions;
  }

  function clearDragRuntimeState() {
    if (dragPreviewFrameRef.current !== null) window.cancelAnimationFrame(dragPreviewFrameRef.current);
    dragPreviewFrameRef.current = null;
    pendingDragPreviewRef.current = null;
    dragRef.current = null;
    subgraphDragFrameRef.current = null;
    dragFinalPositionsRef.current = null;
    dragPreviewStore.publish(null);
  }

  function preserveCommittedDragPreview() {
    if (dragPreviewFrameRef.current !== null) window.cancelAnimationFrame(dragPreviewFrameRef.current);
    dragPreviewFrameRef.current = null;
    pendingDragPreviewRef.current = null;
    dragRef.current = null;
    subgraphDragFrameRef.current = null;
    dragFinalPositionsRef.current = null;
  }

  function releaseCommittedDragPreview() {
    dragPreviewStore.publish(null);
  }

  useEffect(() => {
    return () => {
      if (dragPreviewFrameRef.current !== null) window.cancelAnimationFrame(dragPreviewFrameRef.current);
      committedDragPositionsRef.current = null;
    };
  }, []);

  return {
    dragRef,
    subgraphDragFrameRef,
    dragFinalPositionsRef,
    committedDragPositionsRef,
    dragPreviewStore,
    beginDragRuntimeState,
    markDragPositionsCommitted,
    setDragPreviewPositionsVisual,
    scheduleDragPreviewPositionsVisual,
    flushScheduledDragPreview,
    preserveCommittedDragPreview,
    releaseCommittedDragPreview,
    clearDragRuntimeState
  };
}
