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
  type FloatingPanelFrame,
  type FloatingPanelKind,
  type FloatingPanelOffset,
  type FloatingPanelPlacement,
  type FloatingPanelRect,
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

type FloatingPanelDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffset: FloatingPanelOffset;
  startRect: FloatingPanelRect;
  startFrame?: FloatingPanelFrame;
};

type FloatingPanelResizeState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startFrame: FloatingPanelFrame;
  handle: FloatingPanelResizeHandle;
};

export type FloatingPanelControllerInput = {
  open: boolean;
  placement: FloatingPanelPlacement;
  kind: FloatingPanelKind;
  dismissMode?: FloatingPanelDismissMode;
  draggable?: boolean;
  resizable?: boolean;
  minSize?: FloatingPanelSize;
  defaultSize?: FloatingPanelSize;
  maximizable?: boolean;
  windowState: FloatingPanelWindowState;
  onWindowStateChange?: (state: FloatingPanelWindowState) => void;
  stackIndex: number;
  onFocusPanel?: () => void;
  resetDragOnOpen: boolean;
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
  maximizable,
  windowState,
  onWindowStateChange,
  stackIndex,
  onFocusPanel,
  resetDragOnOpen
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
  const dragStateRef = useRef<FloatingPanelDragState | null>(null);
  const resizeStateRef = useRef<FloatingPanelResizeState | null>(null);
  const hiddenOffset = floatingPanelHiddenOffset(placement);
  const resolvedDismissMode = dismissMode ?? defaultFloatingPanelDismissMode(kind);
  const draggablePanel = shouldDragFloatingPanel(kind, draggable);
  const resizablePanel = kind === "workspace" && (resizable ?? true);
  const maximizablePanel = kind === "workspace" && (maximizable ?? true);
  const framePanel = kind === "workspace" && (resizablePanel || maximizablePanel || Boolean(defaultSize));
  const zIndex = floatingPanelZIndex(kind, stackIndex);
  const { viewport, panelFrame, setPanelFrame, renderedFrame, maximized } = useFloatingPanelFrameState({
    placement,
    resolvedDefaultSize,
    resolvedMinSize,
    framePanel,
    open,
    resetFrameOnOpen: resetDragOnOpen,
    windowState
  });
  const handleExited = useCallback(() => setMounted(false), []);

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
    if (!maximizablePanel || !onWindowStateChange || !open) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || isDragExcluded(target)) return;
    const handle = target.closest("[data-floating-panel-drag-handle]");
    if (!handle || !event.currentTarget.contains(handle)) return;
    onWindowStateChange(windowState === "maximized" ? "normal" : "maximized");
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggablePanel || !open || event.button !== 0 || maximized) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const handle = target.closest("[data-floating-panel-drag-handle]");
    if (!handle || !event.currentTarget.contains(handle) || isDragExcluded(target)) return;

    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
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
      setPanelFrame(
        constrainFloatingPanelFrame({
          frame: {
            ...dragState.startFrame,
            x: dragState.startFrame.x + event.clientX - dragState.startClientX,
            y: dragState.startFrame.y + event.clientY - dragState.startClientY
          },
          viewport,
          minSize: resolvedMinSize
        })
      );
      event.preventDefault();
      return;
    }
    setDragOffset(
      constrainFloatingPanelOffset({
        desired,
        startOffset: dragState.startOffset,
        startRect: dragState.startRect,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      })
    );
    event.preventDefault();
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setDragging(false);
    releasePointerCapture(event);
  }

  function startResize(event: ReactPointerEvent<HTMLDivElement>, handle: FloatingPanelResizeHandle) {
    focusPanel();
    if (!framePanel || !resizablePanel || !open || event.button !== 0 || maximized) return;
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFrame: panelFrame,
      handle
    };
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
    setPanelFrame(
      resizeFloatingPanelFrame({
        startFrame: resizeState.startFrame,
        handle: resizeState.handle,
        delta: {
          x: event.clientX - resizeState.startClientX,
          y: event.clientY - resizeState.startClientY
        },
        viewport,
        minSize: resolvedMinSize
      })
    );
    event.preventDefault();
  }

  function endResize(event: ReactPointerEvent<HTMLDivElement>) {
    const resizeState = resizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    resizeStateRef.current = null;
    setResizing(false);
    releasePointerCapture(event);
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
    maximized,
    resolvedDismissMode,
    pointerDown,
    pointerMove,
    pointerEnd,
    doubleClick,
    focusPanel,
    startResize
  };
}

function releasePointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
  try {
    event.currentTarget.releasePointerCapture(event.pointerId);
  } catch {
    // The browser may release capture before React receives the final event.
  }
}
