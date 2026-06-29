"use client";

import { useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import { EditorStatus, editorViewCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

import { cn } from "@/lib/utils";

type MarkdownPanelProps = {
  value: string;
  className?: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
};

export function MarkdownPanel({ value, className, readOnly = false, onChange }: MarkdownPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const blockDragCleanupTimerRef = useRef<number | null>(null);
  const initialValueRef = useRef(value);
  const initialReadOnlyRef = useRef(readOnly);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const crepe = new Crepe({
      root,
      defaultValue: initialValueRef.current
    });
    crepe.setReadonly(initialReadOnlyRef.current);
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current(markdown);
      });
    });
    crepeRef.current = crepe;
    void crepe.create();

    return () => {
      crepeRef.current = null;
      void crepe.destroy();
    };
  }, []);

  useEffect(() => {
    crepeRef.current?.setReadonly(readOnly);
  }, [readOnly]);

  useEffect(() => {
    const currentPanel = panelRef.current;
    if (!currentPanel) return;
    const panelElement: HTMLElement = currentPanel;

    function isBlockHandleEvent(event: DragEvent) {
      return event.target instanceof Element && Boolean(event.target.closest(".milkdown-block-handle"));
    }

    function clearBlockSelection() {
      const crepe = crepeRef.current;

      if (crepe?.editor.status === EditorStatus.Created) {
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const { state } = view;
          if (state.selection instanceof TextSelection) return;

          const anchor = Math.max(0, Math.min(state.selection.from, state.doc.content.size));
          const selection = TextSelection.near(state.doc.resolve(anchor), 1);
          view.dispatch(state.tr.setSelection(selection));
        });
      }

      panelElement.querySelectorAll(".ProseMirror-selectednode").forEach((node) => {
        node.classList.remove("ProseMirror-selectednode");
      });
    }

    function finishBlockDrag() {
      if (blockDragCleanupTimerRef.current != null) {
        window.clearTimeout(blockDragCleanupTimerRef.current);
      }

      panelElement.removeAttribute("data-md-block-dragging");
      blockDragCleanupTimerRef.current = window.setTimeout(() => {
        blockDragCleanupTimerRef.current = null;
        clearBlockSelection();
      }, 0);
    }

    function handleDragStart(event: DragEvent) {
      if (!isBlockHandleEvent(event)) return;

      panelElement.setAttribute("data-md-block-dragging", "true");
    }

    function handleDragOver(event: DragEvent) {
      if (panelElement.getAttribute("data-md-block-dragging") !== "true") return;
      if (!isBlockHandleEvent(event)) return;

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    }

    function handleDragEnd(event: DragEvent) {
      if (!isBlockHandleEvent(event) && panelElement.getAttribute("data-md-block-dragging") !== "true") return;
      finishBlockDrag();
    }

    function handleDrop() {
      if (panelElement.getAttribute("data-md-block-dragging") !== "true") return;
      finishBlockDrag();
    }

    panelElement.addEventListener("dragstart", handleDragStart, true);
    panelElement.addEventListener("dragover", handleDragOver, true);
    panelElement.addEventListener("dragend", handleDragEnd, true);
    panelElement.addEventListener("drop", handleDrop, true);

    return () => {
      panelElement.removeEventListener("dragstart", handleDragStart, true);
      panelElement.removeEventListener("dragover", handleDragOver, true);
      panelElement.removeEventListener("dragend", handleDragEnd, true);
      panelElement.removeEventListener("drop", handleDrop, true);
      if (blockDragCleanupTimerRef.current != null) {
        window.clearTimeout(blockDragCleanupTimerRef.current);
        blockDragCleanupTimerRef.current = null;
      }
    };
  }, []);

  return (
    <section
      ref={panelRef}
      data-floating-panel-drag-exclude
      data-window-drag-exclude
      className={cn("markdown-editor-panel relative z-0 h-full min-h-0 overflow-auto bg-background", className)}
    >
      <div ref={rootRef} className="min-h-full" />
    </section>
  );
}
