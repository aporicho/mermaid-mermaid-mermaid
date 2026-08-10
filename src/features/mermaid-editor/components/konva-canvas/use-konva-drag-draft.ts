import { useEffect, useRef } from "react";

import { CanvasDragPreviewStore, type CanvasSubgraphPreviewPositions } from "@/features/mermaid-editor/components/konva-canvas/canvas-drag-preview-store";
import type { CanvasNodePreviewPositions } from "@/features/mermaid-editor/lib/canvas-motion";
import type { AlignmentGuide } from "@/features/mermaid-editor/lib/alignment-guides";

type DragPositionMap = Record<string, { x: number; y: number }>;

export function useKonvaDragDraft() {
  const dragRef = useRef<DragPositionMap | null>(null);
  const subgraphDragFrameRef = useRef<DragPositionMap | null>(null);
  const dragFinalPositionsRef = useRef<CanvasNodePreviewPositions | null>(null);
  const committedDragPositionsRef = useRef<CanvasNodePreviewPositions | null>(null);
  const dragPreviewStoreRef = useRef<CanvasDragPreviewStore | null>(null);
  dragPreviewStoreRef.current ??= new CanvasDragPreviewStore();
  const dragPreviewStore = dragPreviewStoreRef.current;

  function setDragPreviewPositionsVisual(positions: CanvasNodePreviewPositions | null, subgraphPositions: CanvasSubgraphPreviewPositions = {}, guides: AlignmentGuide[] = []) {
    dragPreviewStore.publish(positions ? { nodePositions: positions, subgraphPositions, guides } : null);
  }

  function scheduleDragPreviewPositionsVisual(positions: CanvasNodePreviewPositions, subgraphPositions: CanvasSubgraphPreviewPositions = {}, guides: AlignmentGuide[] = [], dropTargetSubgraphId?: string) {
    dragFinalPositionsRef.current = positions;
    // Pointer movement is already coalesced by the canvas pointer scheduler.
    // Publishing here avoids a second RAF that previously made nodes, edges,
    // and guides trail the pointer by one full frame.
    dragPreviewStore.publish({ nodePositions: positions, subgraphPositions, guides, ...(dropTargetSubgraphId ? { dropTargetSubgraphId } : {}) });
  }

  function flushScheduledDragPreview() {}

  function beginDragRuntimeState() {
    committedDragPositionsRef.current = null;
    setDragPreviewPositionsVisual(null);
    dragFinalPositionsRef.current = null;
  }

  function markDragPositionsCommitted(positions: CanvasNodePreviewPositions) {
    committedDragPositionsRef.current = positions;
  }

  function clearDragRuntimeState() {
    dragRef.current = null;
    subgraphDragFrameRef.current = null;
    dragFinalPositionsRef.current = null;
    dragPreviewStore.publish(null);
  }

  function preserveCommittedDragPreview() {
    dragRef.current = null;
    subgraphDragFrameRef.current = null;
    dragFinalPositionsRef.current = null;
  }

  function releaseCommittedDragPreview() {
    dragPreviewStore.publish(null);
  }

  useEffect(() => {
    return () => {
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
