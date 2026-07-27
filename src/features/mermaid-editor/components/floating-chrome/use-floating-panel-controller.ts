import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import {
  constrainFloatingPanelOffset,
  constrainFloatingPanelFrame,
  defaultFloatingPanelDismissMode,
  floatingPanelHiddenOffset,
  floatingPanelZIndex,
  resizeFloatingPanelFrame,
  shouldDragFloatingPanel,
  type FloatingPanelDismissMode,
  type FloatingPanelKind,
  type FloatingPanelOffset,
  type FloatingPanelPlacement,
  type FloatingPanelResizeHandle,
  type FloatingPanelSize,
  type FloatingPanelWindowState
} from "@/features/mermaid-editor/lib/floating-chrome";

import {
  DEFAULT_WORKSPACE_PANEL_MIN_SIZE,
  DEFAULT_WORKSPACE_PANEL_SIZE
} from "./shared";
import { isDragExcluded } from "./floating-panel-frame";
import { useFloatingPanelFrameState } from "./use-floating-panel-frame-state";
import { useFloatingPanelMotion } from "./use-floating-panel-motion";
import {
  releaseFloatingPanelPointerCapture,
  useFloatingPanelVisualDraft,
  writeFloatingPanelFrame,
  type FloatingPanelDragState,
  type FloatingPanelResizeState
} from "./use-floating-panel-visual-draft";

export type FloatingPanelControllerInput = {
  open: boolean;
  placement: FloatingPanelPlacement;
  kind: FloatingPanelKind;
  dismissMode?: FloatingPanelDismissMode;
  draggable?: boolean;
  resizable?: boolean;
  minSize?: FloatingPanelSize;
  defaultSize?: FloatingPanelSize;
  initialFrameSize?: FloatingPanelSize;
  initialFrameSizeKey?: string;
  fullscreenable?: boolean;
  windowState: FloatingPanelWindowState;
  onWindowStateChange?: (state: FloatingPanelWindowState) => void;
  stackIndex: number;
  onFocusPanel?: () => void;
  resetDragOnOpen: boolean;
  mountStrategy?: "unmount" | "keep-alive";
};

export function useFloatingPanelController({
  open,
  placement,
  kind,
  dismissMode,
  draggable,
  resizable,
  minSize,
  defaultSize,
  initialFrameSize,
  initialFrameSizeKey,
  fullscreenable,
  windowState,
  onWindowStateChange,
  stackIndex,
  onFocusPanel,
  resetDragOnOpen,
  mountStrategy = "unmount"
}: FloatingPanelControllerInput) {
  const [mounted, setMounted] = useState(open);
  const [dragOffset, setDragOffset] = useState<FloatingPanelOffset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const minWidth = minSize?.width ?? DEFAULT_WORKSPACE_PANEL_MIN_SIZE.width;
  const minHeight = minSize?.height ?? DEFAULT_WORKSPACE_PANEL_MIN_SIZE.height;
  const defaultWidth = defaultSize?.width ?? DEFAULT_WORKSPACE_PANEL_SIZE.width;
  const defaultHeight = defaultSize?.height ?? DEFAULT_WORKSPACE_PANEL_SIZE.height;
  const resolvedMinSize = useMemo<FloatingPanelSize>(
    () => ({ width: minWidth, height: minHeight }),
    [minHeight, minWidth]
  );
  const resolvedDefaultSize = useMemo<FloatingPanelSize>(
    () => ({ width: defaultWidth, height: defaultHeight }),
    [defaultHeight, defaultWidth]
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const userAdjustedFrameRef = useRef(false);
  const previousInitialFrameSizeKeyRef = useRef(initialFrameSizeKey);
  const dragStateRef = useRef<FloatingPanelDragState | null>(null);
  const resizeStateRef = useRef<FloatingPanelResizeState | null>(null);
  const visualDraft = useFloatingPanelVisualDraft(rootRef);
  const hiddenOffset = floatingPanelHiddenOffset(placement);
  const resolvedDismissMode = dismissMode ?? defaultFloatingPanelDismissMode(kind);
  const draggablePanel = shouldDragFloatingPanel(kind, draggable);
  const resizablePanel = kind === "workspace" && (resizable ?? true);
  const fullscreenablePanel = kind === "workspace" && (fullscreenable ?? true);
  const framePanel = kind === "workspace" && (resizablePanel || fullscreenablePanel || Boolean(defaultSize));
  const zIndex = floatingPanelZIndex(kind, stackIndex);
  if (previousInitialFrameSizeKeyRef.current !== initialFrameSizeKey) {
    previousInitialFrameSizeKeyRef.current = initialFrameSizeKey;
    userAdjustedFrameRef.current = false;
  }
  const { viewport, panelFrame, setPanelFrame, renderedFrame, fullscreen } = useFloatingPanelFrameState({
    placement,
    resolvedDefaultSize,
    initialFrameSize: userAdjustedFrameRef.current ? undefined : initialFrameSize,
    initialFrameSizeKey,
    resolvedMinSize,
    framePanel,
    open,
    resetFrameOnOpen: resetDragOnOpen,
    windowState
  });
  const handleExited = useCallback(() => {
    if (mountStrategy === "unmount") setMounted(false);
  }, [mountStrategy]);

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    if (!framePanel && resetDragOnOpen) setDragOffset({ x: 0, y: 0 });
  }, [framePanel, open, resetDragOnOpen]);

  useFloatingPanelMotion({
    surfaceRef,
    mounted,
    open,
    kind,
    placement,
    hiddenOffset,
    onExited: handleExited
  });

  function focusPanel() {
    if (!open) return;
    onFocusPanel?.();
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    focusPanel();
    startDrag(event);
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    moveDrag(event);
    moveResize(event);
  }

  function pointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    endDrag(event);
    endResize(event);
  }

  function doubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!fullscreenablePanel || !onWindowStateChange || !open) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || isDragExcluded(target)) return;
    const handle = target.closest("[data-floating-panel-drag-handle]");
    if (!handle || !event.currentTarget.contains(handle)) return;
    onWindowStateChange(windowState === "fullscreen" ? "normal" : "fullscreen");
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggablePanel || !open || event.button !== 0 || fullscreen) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const handle = target.closest("[data-floating-panel-drag-handle]");
    if (!handle || !event.currentTarget.contains(handle) || isDragExcluded(target)) return;

    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    visualDraft.clear();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffset: dragOffset,
      startFrame: framePanel ? panelFrame : undefined,
      startRect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom
      }
    };
    userAdjustedFrameRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail if the pointer is already released by the platform.
    }
    setDragging(true);
    event.preventDefault();
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const desired = {
      x: dragState.startOffset.x + event.clientX - dragState.startClientX,
      y: dragState.startOffset.y + event.clientY - dragState.startClientY
    };
    if (framePanel && dragState.startFrame) {
      visualDraft.schedule({
        kind: "frame-drag",
        origin: dragState.startFrame,
        frame: constrainFloatingPanelFrame({
          frame: {
            ...dragState.startFrame,
            x: dragState.startFrame.x + event.clientX - dragState.startClientX,
            y: dragState.startFrame.y + event.clientY - dragState.startClientY
          },
          viewport,
          minSize: resolvedMinSize
        })
      });
      event.preventDefault();
      return;
    }
    visualDraft.schedule({
      kind: "offset",
      offset: constrainFloatingPanelOffset({
        desired,
        startOffset: dragState.startOffset,
        startRect: dragState.startRect,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      })
    });
    event.preventDefault();
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const draft = visualDraft.flush();
    if (draft?.kind === "frame-drag") {
      const root = rootRef.current;
      if (root) writeFloatingPanelFrame(root, draft.frame);
      setPanelFrame(draft.frame);
    } else if (draft?.kind === "offset") {
      setDragOffset(draft.offset);
    }
    visualDraft.clear();
    dragStateRef.current = null;
    setDragging(false);
    releaseFloatingPanelPointerCapture(event.currentTarget, event.pointerId);
  }

  function startResize(event: ReactPointerEvent<HTMLDivElement>, handle: FloatingPanelResizeHandle) {
    focusPanel();
    if (!framePanel || !resizablePanel || !open || event.button !== 0 || fullscreen) return;
    visualDraft.clear();
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFrame: panelFrame,
      handle
    };
    userAdjustedFrameRef.current = true;
    try {
      rootRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail if the platform has already transferred capture.
    }
    setResizing(true);
    event.preventDefault();
    event.stopPropagation();
  }

  function moveResize(event: ReactPointerEvent<HTMLDivElement>) {
    const resizeState = resizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    visualDraft.schedule({
      kind: "frame-resize",
      frame: resizeFloatingPanelFrame({
        startFrame: resizeState.startFrame,
        handle: resizeState.handle,
        delta: {
          x: event.clientX - resizeState.startClientX,
          y: event.clientY - resizeState.startClientY
        },
        viewport,
        minSize: resolvedMinSize
      })
    });
    event.preventDefault();
  }

  function endResize(event: ReactPointerEvent<HTMLDivElement>) {
    const resizeState = resizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    const draft = visualDraft.flush();
    if (draft?.kind === "frame-resize") {
      const root = rootRef.current;
      if (root) writeFloatingPanelFrame(root, draft.frame);
      setPanelFrame(draft.frame);
    }
    visualDraft.clear();
    resizeStateRef.current = null;
    setResizing(false);
    releaseFloatingPanelPointerCapture(event.currentTarget, event.pointerId);
  }

  const rootStyle: CSSProperties = framePanel
    ? {
        left: renderedFrame.x,
        top: renderedFrame.y,
        width: renderedFrame.width,
        height: renderedFrame.height,
        zIndex
      }
    : {
        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
        zIndex
      };

  return {
    mounted,
    rootRef,
    surfaceRef,
    rootStyle,
    dragging,
    resizing,
    framePanel,
    resizablePanel,
    fullscreen,
    resolvedDismissMode,
    pointerDown,
    pointerMove,
    pointerEnd,
    doubleClick,
    focusPanel,
    startResize
  };
}
