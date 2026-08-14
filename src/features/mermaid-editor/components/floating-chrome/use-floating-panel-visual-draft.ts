import { useCallback, useEffect, useRef, type RefObject } from "react";

import type {
  FloatingPanelFrame,
  FloatingPanelOffset,
  FloatingPanelResizeHandle
} from "@/features/mermaid-editor/lib/floating-chrome";

export type FloatingPanelResizeState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startFrame: FloatingPanelFrame;
  handle: FloatingPanelResizeHandle;
};

export type FloatingPanelVisualDraft =
  | { kind: "frame-drag"; frame: FloatingPanelFrame; origin: FloatingPanelFrame }
  | { kind: "frame-resize"; frame: FloatingPanelFrame }
  | { kind: "offset"; offset: FloatingPanelOffset };

export function useFloatingPanelVisualDraft(rootRef: RefObject<HTMLDivElement | null>) {
  const latestRef = useRef<FloatingPanelVisualDraft | null>(null);
  const pendingRef = useRef<FloatingPanelVisualDraft | null>(null);
  const frameRequestRef = useRef<number | null>(null);

  const apply = useCallback((draft: FloatingPanelVisualDraft) => {
    const element = rootRef.current;
    if (!element) return;
    if (draft.kind === "offset") {
      element.style.transform = translate(draft.offset.x, draft.offset.y);
      return;
    }
    if (draft.kind === "frame-drag") {
      element.style.transform = translate(
        draft.frame.x - draft.origin.x,
        draft.frame.y - draft.origin.y
      );
      return;
    }
    writeFloatingPanelFrame(element, draft.frame);
  }, [rootRef]);

  const flush = useCallback(() => {
    if (frameRequestRef.current !== null) {
      window.cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = null;
    }
    const draft = pendingRef.current ?? latestRef.current;
    pendingRef.current = null;
    if (draft) apply(draft);
    return draft;
  }, [apply]);

  const clear = useCallback(() => {
    if (frameRequestRef.current !== null) window.cancelAnimationFrame(frameRequestRef.current);
    frameRequestRef.current = null;
    pendingRef.current = null;
    latestRef.current = null;
  }, []);

  const schedule = useCallback((draft: FloatingPanelVisualDraft) => {
    latestRef.current = draft;
    pendingRef.current = draft;
    if (frameRequestRef.current !== null) return;
    frameRequestRef.current = window.requestAnimationFrame(() => {
      frameRequestRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) apply(pending);
    });
  }, [apply]);

  useEffect(() => clear, [clear]);

  return { clear, flush, schedule };
}

export type FloatingPanelVisualDraftController = ReturnType<typeof useFloatingPanelVisualDraft>;

export function writeFloatingPanelFrame(element: HTMLElement, frame: FloatingPanelFrame) {
  element.style.left = `${frame.x}px`;
  element.style.top = `${frame.y}px`;
  element.style.width = `${frame.width}px`;
  element.style.height = `${frame.height}px`;
  element.style.transform = "";
}

export function releaseFloatingPanelPointerCapture(element: HTMLElement, pointerId: number) {
  if (typeof element.hasPointerCapture !== "function" || !element.hasPointerCapture(pointerId)) return;
  try {
    element.releasePointerCapture(pointerId);
  } catch {
    // The browser may release capture before React receives the final event.
  }
}

function translate(x: number, y: number) {
  return `translate3d(${x}px, ${y}px, 0)`;
}
