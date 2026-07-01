import { useEffect, type RefObject } from "react";

import type { CanvasDocument, CanvasDocumentElement } from "@/features/mermaid-editor/lib/canvas-document";
import type { StandardCanvasInteractionState } from "@/features/mermaid-editor/lib/canvas-interaction-standard";
import type { CanvasDocumentInlineEdit } from "@/features/mermaid-editor/components/canvas-document-editor/types";

type UseCanvasDocumentKeyboardShortcutsArgs = {
  selectedIdsRef: RefObject<string[]>;
  inlineEditRef: RefObject<CanvasDocumentInlineEdit | null>;
  interactionStateRef: RefObject<StandardCanvasInteractionState>;
  connectorStartIdRef: RefObject<string | null>;
  documentRef: RefObject<CanvasDocument>;
  onDeleteSelection: () => void;
  onStartInlineEdit: (element: CanvasDocumentElement) => void;
};

export function useCanvasDocumentKeyboardShortcuts({
  selectedIdsRef,
  inlineEditRef,
  interactionStateRef,
  connectorStartIdRef,
  documentRef,
  onDeleteSelection,
  onStartInlineEdit
}: UseCanvasDocumentKeyboardShortcutsArgs) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      if (inlineEditRef.current) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedIdsRef.current.length) {
        event.preventDefault();
        onDeleteSelection();
        return;
      }
      if (interactionStateRef.current.kind !== "idle" || connectorStartIdRef.current) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "Enter" && event.key !== "F2") return;
      if (selectedIdsRef.current.length !== 1) return;

      const element = documentRef.current.elements.find((item) => item.id === selectedIdsRef.current[0]);
      if (!element || (element.type !== "shape" && element.type !== "card" && element.type !== "text")) return;
      event.preventDefault();
      onStartInlineEdit(element);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    connectorStartIdRef,
    documentRef,
    inlineEditRef,
    interactionStateRef,
    onDeleteSelection,
    onStartInlineEdit,
    selectedIdsRef
  ]);
}
