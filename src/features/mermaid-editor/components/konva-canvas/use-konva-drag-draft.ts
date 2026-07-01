import { useEffect, useRef, useState } from "react";

import type { CanvasNodePreviewPositions } from "@/features/mermaid-editor/lib/canvas-motion";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";

type DragPositionMap = Record<string, { x: number; y: number }>;

type UseKonvaDragDraftArgs = {
  onEditorCommand: (command: EditorCommand) => void;
};

export function useKonvaDragDraft({ onEditorCommand }: UseKonvaDragDraftArgs) {
  const dragRef = useRef<DragPositionMap | null>(null);
  const subgraphDragFrameRef = useRef<DragPositionMap | null>(null);
  const dragDraftGraphRef = useRef<MermaidGraph | null>(null);
  const dragDraftCommandFrameRef = useRef<number | null>(null);
  const pendingDragDraftCommandRef = useRef<{ positions: CanvasNodePreviewPositions; message: string } | null>(null);
  const [dragPreviewPositions, setDragPreviewPositions] = useState<CanvasNodePreviewPositions | null>(null);

  function setDragPreviewPositionsVisual(positions: CanvasNodePreviewPositions | null) {
    setDragPreviewPositions(positions);
  }

  function scheduleDragDraftCommand(positions: CanvasNodePreviewPositions, message: string) {
    pendingDragDraftCommandRef.current = { positions, message };
    if (dragDraftCommandFrameRef.current !== null) return;
    dragDraftCommandFrameRef.current = window.requestAnimationFrame(() => {
      dragDraftCommandFrameRef.current = null;
      const pending = pendingDragDraftCommandRef.current;
      pendingDragDraftCommandRef.current = null;
      if (!pending) return;
      onEditorCommand({ type: "graph.draftNodePositions", positions: pending.positions, message: pending.message, syncSource: false, source: "pointer" });
    });
  }

  function flushDragDraftCommand() {
    if (dragDraftCommandFrameRef.current !== null) {
      window.cancelAnimationFrame(dragDraftCommandFrameRef.current);
      dragDraftCommandFrameRef.current = null;
    }
    const pending = pendingDragDraftCommandRef.current;
    pendingDragDraftCommandRef.current = null;
    if (!pending) return;
    onEditorCommand({ type: "graph.draftNodePositions", positions: pending.positions, message: pending.message, syncSource: false, source: "pointer" });
  }

  function clearPendingDragDraftCommand() {
    pendingDragDraftCommandRef.current = null;
  }

  function clearDragRuntimeState() {
    flushDragDraftCommand();
    dragRef.current = null;
    subgraphDragFrameRef.current = null;
    dragDraftGraphRef.current = null;
    setDragPreviewPositionsVisual(null);
  }

  useEffect(() => {
    return () => {
      if (dragDraftCommandFrameRef.current !== null) window.cancelAnimationFrame(dragDraftCommandFrameRef.current);
    };
  }, []);

  return {
    dragRef,
    subgraphDragFrameRef,
    dragDraftGraphRef,
    dragPreviewPositions,
    setDragPreviewPositionsVisual,
    scheduleDragDraftCommand,
    flushDragDraftCommand,
    clearPendingDragDraftCommand,
    clearDragRuntimeState
  };
}
