import { useCallback, useEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type RefObject, type SetStateAction } from "react";

import {
  constrainFloatingPanelFrame,
  constrainFloatingPanelOffset,
  type FloatingPanelFrame,
  type FloatingPanelOffset,
  type FloatingPanelSize,
  type FloatingPanelViewport
} from "@/features/mermaid-editor/lib/floating-chrome";

import { isDragExcluded } from "./floating-panel-frame";
import { blurAllowedFloatingPanelDragControl, useFloatingPanelClickSuppression } from "./use-floating-panel-click-suppression";
import {
  releaseFloatingPanelPointerCapture,
  writeFloatingPanelFrame,
  type FloatingPanelVisualDraftController
} from "./use-floating-panel-visual-draft";

export const FLOATING_PANEL_DRAG_THRESHOLD_PX = 4;
export const FLOATING_PANEL_TOUCH_DRAG_THRESHOLD_PX = 8;

type FloatingPanelPendingDrag = {
  pointerId: number;
  pointerType: string;
  allowedControl: HTMLElement | null;
  activated: boolean;
  startClientX: number;
  startClientY: number;
  startOffset: FloatingPanelOffset;
  startFrame?: FloatingPanelFrame;
  startRect: { left: number; top: number; right: number; bottom: number };
};

export function useFloatingPanelDrag({
  open,
  draggable,
  fullscreen,
  framePanel,
  rootRef,
  surfaceRef,
  dragOffset,
  setDragOffset,
  panelFrame,
  setPanelFrame,
  viewport,
  minSize,
  visualDraft,
  onActivate,
  onCommit,
  onCancel
}: {
  open: boolean;
  draggable: boolean;
  fullscreen: boolean;
  framePanel: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  dragOffset: FloatingPanelOffset;
  setDragOffset: Dispatch<SetStateAction<FloatingPanelOffset>>;
  panelFrame: FloatingPanelFrame;
  setPanelFrame: Dispatch<SetStateAction<FloatingPanelFrame>>;
  viewport: FloatingPanelViewport;
  minSize: FloatingPanelSize;
  visualDraft: FloatingPanelVisualDraftController;
  onActivate: () => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const pendingRef = useRef<FloatingPanelPendingDrag | null>(null);
  const clickSuppression = useFloatingPanelClickSuppression();
  const { clear: clearVisualDraft, flush: flushVisualDraft, schedule: scheduleVisualDraft } = visualDraft;
  const restoreStartVisual = useCallback((pending: FloatingPanelPendingDrag) => {
    const root = rootRef.current;
    if (!root || !pending.activated) return;
    if (framePanel && pending.startFrame) {
      writeFloatingPanelFrame(root, pending.startFrame);
      return;
    }
    root.style.transform = `translate3d(${pending.startOffset.x}px, ${pending.startOffset.y}px, 0)`;
  }, [framePanel, rootRef]);

  const reset = useCallback((event?: ReactPointerEvent<HTMLDivElement>, restore = false) => {
    const pending = pendingRef.current;
    if (!pending || (event && pending.pointerId !== event.pointerId)) return;
    clearVisualDraft();
    if (restore && pending.activated) {
      restoreStartVisual(pending);
      onCancel();
    }
    pendingRef.current = null;
    setDragging(false);
    if (event) releaseFloatingPanelPointerCapture(event.currentTarget, event.pointerId);
  }, [clearVisualDraft, onCancel, restoreStartVisual]);

  useEffect(() => {
    if (open && draggable && !fullscreen) return;
    reset(undefined, true);
  }, [draggable, fullscreen, open, reset]);

  useEffect(() => () => {
    clearVisualDraft();
    pendingRef.current = null;
  }, [clearVisualDraft]);

  useEffect(() => {
    const cancelUncapturedGesture = () => reset(undefined, true);
    window.addEventListener("pointerup", cancelUncapturedGesture);
    window.addEventListener("pointercancel", cancelUncapturedGesture);
    window.addEventListener("blur", cancelUncapturedGesture);
    return () => {
      window.removeEventListener("pointerup", cancelUncapturedGesture);
      window.removeEventListener("pointercancel", cancelUncapturedGesture);
      window.removeEventListener("blur", cancelUncapturedGesture);
    };
  }, [reset]);

  function start(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggable || !open || event.button !== 0 || fullscreen) return;
    clickSuppression.clear();
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const handle = target.closest("[data-floating-panel-drag-handle]");
    if (!handle || !event.currentTarget.contains(handle) || isDragExcluded(target)) return;

    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    clearVisualDraft();
    pendingRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType || "mouse",
      allowedControl: target.closest<HTMLElement>("[data-window-titlebar-drag-allow]"),
      activated: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffset: dragOffset,
      startFrame: framePanel ? panelFrame : undefined,
      startRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    };
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const pending = pendingRef.current;
    if (!pending || pending.pointerId !== event.pointerId) return;
    const delta = {
      x: event.clientX - pending.startClientX,
      y: event.clientY - pending.startClientY
    };
    if (!pending.activated) {
      const threshold = pending.pointerType === "touch"
        ? FLOATING_PANEL_TOUCH_DRAG_THRESHOLD_PX
        : FLOATING_PANEL_DRAG_THRESHOLD_PX;
      if (delta.x * delta.x + delta.y * delta.y < threshold * threshold) return;
      pending.activated = true;
      blurAllowedFloatingPanelDragControl(pending.allowedControl);
      onActivate();
      setDragging(true);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail if the platform has already released the pointer.
      }
    }

    if (framePanel && pending.startFrame) {
      scheduleVisualDraft({
        kind: "frame-drag",
        origin: pending.startFrame,
        frame: constrainFloatingPanelFrame({
          frame: {
            ...pending.startFrame,
            x: pending.startFrame.x + delta.x,
            y: pending.startFrame.y + delta.y
          },
          viewport,
          minSize
        })
      });
    } else {
      const desired = { x: pending.startOffset.x + delta.x, y: pending.startOffset.y + delta.y };
      scheduleVisualDraft({
        kind: "offset",
        offset: constrainFloatingPanelOffset({
          desired,
          startOffset: pending.startOffset,
          startRect: pending.startRect,
          viewport: { width: window.innerWidth, height: window.innerHeight }
        })
      });
    }
    event.preventDefault();
  }

  function end(event: ReactPointerEvent<HTMLDivElement>) {
    const pending = pendingRef.current;
    if (!pending || pending.pointerId !== event.pointerId) return;
    if (pending.activated) {
      clickSuppression.arm();
      const draft = flushVisualDraft();
      if (draft?.kind === "frame-drag") {
        const root = rootRef.current;
        if (root) writeFloatingPanelFrame(root, draft.frame);
        setPanelFrame(draft.frame);
      } else if (draft?.kind === "offset") {
        setDragOffset(draft.offset);
      }
      onCommit();
    }
    reset(event);
  }

  function cancel(event: ReactPointerEvent<HTMLDivElement>) {
    reset(event, true);
  }

  return { dragging, start, move, end, cancel, lostPointerCapture: cancel, clickCapture: clickSuppression.capture };
}
