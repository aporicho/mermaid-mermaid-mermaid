import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  EDITOR_CHROME_TOKENS,
  EDITOR_CHROME_CLASSES,
  FLOATING_CHROME_PLACEMENTS,
  type FloatingChromePlacement
} from "@/features/mermaid-editor/lib/editor-chrome";
import {
  FLOATING_CHROME_HIDE_DELAY_MS,
  FLOATING_PANEL_EDGE_MARGIN_PX,
  constrainFloatingPanelOffset,
  constrainFloatingPanelFrame,
  defaultFloatingPanelDismissMode,
  floatingPanelHiddenOffset,
  floatingPanelZIndex,
  fitFloatingPanelFrameToViewport,
  maximizedFloatingPanelFrame,
  resizeFloatingPanelFrame,
  restoreFloatingPanelFrame,
  shouldDragFloatingPanel,
  shouldRevealFloatingGroup,
  type FloatingPanelDismissMode,
  type FloatingPanelFrame,
  type FloatingPanelKind,
  type FloatingPanelOffset,
  type FloatingPanelPlacement,
  type FloatingPanelRect,
  type FloatingPanelResizeHandle,
  type FloatingPanelSize,
  type FloatingPanelViewport,
  type FloatingPanelWindowState
} from "@/features/mermaid-editor/lib/floating-chrome";
import { floatingPlacementOffset, panelMotionOffset } from "@/features/mermaid-editor/lib/editor-motion";
import { gsap, useEditorMotion, useGSAP } from "@/features/mermaid-editor/lib/use-gsap-motion";
import { cn } from "@/lib/utils";

type FloatingTooltipSide = "top" | "right" | "bottom" | "left";

const floatingPanelPlacementClass: Record<FloatingPanelPlacement, string> = {
  "top-left": "left-0 top-16 origin-top-left",
  right: "right-0 top-16 origin-top-right",
  "bottom-left": "bottom-16 left-0 origin-bottom-left",
  "left-panel": "bottom-16 left-4 top-16 origin-left",
  "right-panel": "bottom-16 right-4 top-16 origin-right",
  "center-panel": "left-1/2 top-1/2 origin-center",
  "bottom-panel": "bottom-20 left-1/2 origin-bottom"
};

const floatingPanelAnchorClass: Partial<Record<FloatingPanelPlacement, string>> = {
  "center-panel": "-translate-x-1/2 -translate-y-1/2",
  "bottom-panel": "-translate-x-1/2"
};

const floatingPanelSurfaceClass: Record<FloatingPanelKind, string> = {
  popover: "rounded-lg border bg-popover/95 p-2 text-popover-foreground shadow-sm backdrop-blur",
  workspace: "rounded-lg border bg-card/95 text-foreground shadow-sm"
};

const DEFAULT_WORKSPACE_PANEL_SIZE: FloatingPanelSize = { width: 360, height: 640 };
const DEFAULT_WORKSPACE_PANEL_MIN_SIZE: FloatingPanelSize = { width: 320, height: 220 };
const FLOATING_PANEL_RESIZE_HANDLES: FloatingPanelResizeHandle[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

const floatingPanelResizeHandleClass: Record<FloatingPanelResizeHandle, string> = {
  n: "left-3 right-3 -top-1.5 h-3 cursor-ns-resize",
  ne: "-right-2 -top-2 size-4 cursor-nesw-resize",
  e: "-right-1.5 bottom-3 top-3 w-3 cursor-ew-resize",
  se: "-bottom-2 -right-2 size-4 cursor-nwse-resize",
  s: "-bottom-1.5 left-3 right-3 h-3 cursor-ns-resize",
  sw: "-bottom-2 -left-2 size-4 cursor-nesw-resize",
  w: "-left-1.5 bottom-3 top-3 w-3 cursor-ew-resize",
  nw: "-left-2 -top-2 size-4 cursor-nwse-resize"
};

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

export function FloatingChromeLayer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("pointer-events-none absolute inset-0 z-40", className)}>{children}</div>;
}

export function FloatingChromeSlot({
  placement,
  pinned = false,
  className,
  hotZoneClassName,
  contentClassName,
  children
}: {
  placement: FloatingChromePlacement;
  pinned?: boolean;
  className?: string;
  hotZoneClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [interactable, setInteractable] = useState(pinned);
  const hideTimerRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const motion = useEditorMotion();
  const placementSpec = FLOATING_CHROME_PLACEMENTS[placement];
  const visible = shouldRevealFloatingGroup({ hovered, focusWithin, pinned });
  const hiddenOffset = floatingPlacementOffset(placement, motion.distance.chrome);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  useGSAP(
    () => {
      const element = contentRef.current;
      if (!element) return;

      if (visible) {
        setInteractable(true);
        gsap.to(element, {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          duration: motion.duration.fast,
          ease: motion.ease.standard,
          overwrite: "auto"
        });
        gsap.fromTo(
          element.querySelectorAll("[data-floating-chrome-button]"),
          { autoAlpha: motion.reduced ? 1 : 0.9, scale: motion.reduced ? 1 : 0.96 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: motion.duration.fast,
            ease: motion.ease.emphasized,
            stagger: motion.stagger.button,
            overwrite: "auto"
          }
        );
        return;
      }

      gsap.to(element, {
        autoAlpha: 0,
        x: hiddenOffset.x,
        y: hiddenOffset.y,
        scale: motion.reduced ? 1 : 0.98,
        duration: motion.duration.fast,
        ease: motion.ease.exit,
        overwrite: "auto",
        onComplete: () => setInteractable(false)
      });
    },
    {
      dependencies: [
        hiddenOffset.x,
        hiddenOffset.y,
        motion.duration.fast,
        motion.ease.emphasized,
        motion.ease.exit,
        motion.ease.standard,
        motion.reduced,
        motion.stagger.button,
        visible
      ],
      scope: contentRef
    }
  );

  function clearHideTimer() {
    if (!hideTimerRef.current) return;
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }

  function show() {
    clearHideTimer();
    setHovered(true);
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setHovered(false);
      hideTimerRef.current = null;
    }, FLOATING_CHROME_HIDE_DELAY_MS);
  }

  function blur(event: React.FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setFocusWithin(false);
  }

  return (
    <div className={cn("pointer-events-auto absolute", placementSpec.rootClassName, className)}>
      <div
        className={cn("flex", placementSpec.hotZoneClassName, hotZoneClassName)}
        onPointerEnter={show}
        onPointerLeave={scheduleHide}
        onFocus={() => setFocusWithin(true)}
        onBlur={blur}
      >
        <div
          ref={contentRef}
          className={cn(
            "will-change-transform",
            interactable ? "pointer-events-auto" : "pointer-events-none",
            contentClassName
          )}
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? undefined : `translate(${hiddenOffset.x}px, ${hiddenOffset.y}px) scale(${motion.reduced ? 1 : 0.98})`
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function MotionPresence({
  present,
  variant,
  className,
  children
}: {
  present: boolean;
  variant: "left" | "right" | "bottom" | "top" | "workspace";
  className?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(present);
  const ref = useRef<HTMLDivElement | null>(null);
  const motion = useEditorMotion();
  const offset = panelMotionOffset(variant, variant === "workspace" ? motion.distance.viewport : motion.distance.panel);

  useEffect(() => {
    if (present) setMounted(true);
  }, [present]);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element || !mounted) return;

      if (present) {
        gsap.fromTo(
          element,
          {
            autoAlpha: motion.reduced ? 1 : 0,
            x: offset.x,
            y: offset.y,
            scale: motion.reduced ? 1 : 0.985
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: variant === "workspace" ? motion.duration.base : motion.duration.slow,
            ease: motion.ease.standard,
            overwrite: "auto",
            onComplete: () => {
              if (variant === "workspace") {
                gsap.set(element, { clearProps: "transform" });
              }
            }
          }
        );
        return;
      }

      gsap.to(element, {
        autoAlpha: 0,
        x: offset.x,
        y: offset.y,
        scale: motion.reduced ? 1 : 0.985,
        duration: motion.duration.base,
        ease: motion.ease.exit,
        overwrite: "auto",
        onComplete: () => setMounted(false)
      });
    },
    {
      dependencies: [
        mounted,
        motion.duration.base,
        motion.duration.slow,
        motion.ease.exit,
        motion.ease.standard,
        motion.reduced,
        offset.x,
        offset.y,
        present,
        variant
      ],
      scope: ref
    }
  );

  if (!mounted) return null;

  return (
    <div ref={ref} className={className} style={{ opacity: present ? 1 : 0 }}>
      {children}
    </div>
  );
}

export function FloatingPanel({
  open,
  placement,
  kind = "popover",
  dismissMode,
  draggable,
  resizable,
  minSize,
  defaultSize,
  maximizable,
  windowState = "normal",
  onWindowStateChange,
  panelId,
  active = false,
  stackIndex = 0,
  onFocusPanel,
  resetDragOnOpen = true,
  frameClassName,
  className,
  children
}: {
  open: boolean;
  placement: FloatingPanelPlacement;
  kind?: FloatingPanelKind;
  dismissMode?: FloatingPanelDismissMode;
  draggable?: boolean;
  resizable?: boolean;
  minSize?: FloatingPanelSize;
  defaultSize?: FloatingPanelSize;
  maximizable?: boolean;
  windowState?: FloatingPanelWindowState;
  onWindowStateChange?: (state: FloatingPanelWindowState) => void;
  panelId?: string;
  active?: boolean;
  stackIndex?: number;
  onFocusPanel?: () => void;
  resetDragOnOpen?: boolean;
  frameClassName?: string;
  className?: string;
  children: ReactNode;
}) {
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
  const [viewport, setViewport] = useState<FloatingPanelViewport>(() => currentFloatingPanelViewport());
  const [panelFrame, setPanelFrame] = useState<FloatingPanelFrame>(() =>
    initialFloatingPanelFrame({
      placement,
      size: resolvedDefaultSize,
      minSize: resolvedMinSize,
      viewport: currentFloatingPanelViewport()
    })
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<FloatingPanelDragState | null>(null);
  const resizeStateRef = useRef<FloatingPanelResizeState | null>(null);
  const normalFrameRef = useRef<FloatingPanelFrame | null>(null);
  const previousWindowStateRef = useRef<FloatingPanelWindowState>(windowState);
  const motion = useEditorMotion();
  const hiddenOffset = floatingPanelHiddenOffset(placement);
  const resolvedDismissMode = dismissMode ?? defaultFloatingPanelDismissMode(kind);
  const draggablePanel = shouldDragFloatingPanel(kind, draggable);
  const resizablePanel = kind === "workspace" && (resizable ?? true);
  const maximizablePanel = kind === "workspace" && (maximizable ?? true);
  const framePanel = kind === "workspace" && (resizablePanel || maximizablePanel || Boolean(defaultSize));
  const maximized = framePanel && windowState === "maximized";
  const zIndex = floatingPanelZIndex(kind, stackIndex);
  const renderedFrame = maximized ? maximizedFloatingPanelFrame({ viewport }) : panelFrame;

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    if (!framePanel && resetDragOnOpen) setDragOffset({ x: 0, y: 0 });
    if (framePanel && resetDragOnOpen) {
      setPanelFrame(
        initialFloatingPanelFrame({
          placement,
          size: resolvedDefaultSize,
          minSize: resolvedMinSize,
          viewport: currentFloatingPanelViewport()
        })
      );
    }
  }, [framePanel, open, placement, resetDragOnOpen, resolvedDefaultSize, resolvedMinSize]);

  useEffect(() => {
    function updateViewport() {
      const nextViewport = currentFloatingPanelViewport();
      setViewport(nextViewport);
      if (!framePanel) return;
      setPanelFrame((current) =>
        restoreFloatingPanelFrame({
          frame: current,
          viewport: nextViewport,
          minSize: resolvedMinSize
        })
      );
    }

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, [framePanel, resolvedMinSize]);

  useEffect(() => {
    if (!framePanel || !open) {
      previousWindowStateRef.current = windowState;
      return;
    }
    const previousWindowState = previousWindowStateRef.current;
    if (windowState === "maximized" && previousWindowState !== "maximized") {
      normalFrameRef.current = panelFrame;
    }
    if (windowState === "normal" && previousWindowState === "maximized" && normalFrameRef.current) {
      setPanelFrame(
        restoreFloatingPanelFrame({
          frame: normalFrameRef.current,
          viewport,
          minSize: resolvedMinSize
        })
      );
      normalFrameRef.current = null;
    }
    previousWindowStateRef.current = windowState;
  }, [framePanel, open, panelFrame, resolvedMinSize, viewport, windowState]);

  useGSAP(
    () => {
      const element = surfaceRef.current;
      if (!element || !mounted) return;
      const items = element.querySelectorAll("[data-floating-action-item]");

      if (open) {
        gsap.fromTo(
          element,
          {
            autoAlpha: motion.reduced ? 1 : 0,
            x: motion.reduced ? 0 : hiddenOffset.x,
            y: motion.reduced ? 0 : hiddenOffset.y,
            scale: motion.reduced ? 1 : 0.94
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: motion.duration.base,
            ease: motion.ease.emphasized,
            overwrite: "auto",
            onComplete: () => {
              if (kind === "workspace") {
                gsap.set(element, { clearProps: "transform" });
              }
            }
          }
        );
        if (items.length) {
          gsap.fromTo(
            items,
            { autoAlpha: motion.reduced ? 1 : 0, y: motion.reduced ? 0 : 4 },
            {
              autoAlpha: 1,
              y: 0,
              duration: motion.duration.fast,
              delay: motion.reduced ? 0 : motion.duration.fast * 0.35,
              ease: motion.ease.standard,
              stagger: motion.stagger.list,
              overwrite: "auto"
            }
          );
        }
        return;
      }

      gsap.to(element, {
        autoAlpha: 0,
        x: motion.reduced ? 0 : hiddenOffset.x,
        y: motion.reduced ? 0 : hiddenOffset.y,
        scale: motion.reduced ? 1 : 0.98,
        duration: motion.duration.fast,
        ease: motion.ease.exit,
        overwrite: "auto",
        onComplete: () => setMounted(false)
      });
    },
    {
      dependencies: [
        hiddenOffset.x,
        hiddenOffset.y,
        mounted,
        motion.duration.base,
        motion.duration.fast,
        motion.ease.emphasized,
        motion.ease.exit,
        motion.ease.standard,
        motion.reduced,
        motion.stagger.list,
        open,
        kind,
        placement
      ],
      scope: surfaceRef
    }
  );

  if (!mounted) return null;

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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may release capture before React receives the final event.
      }
    }
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may release capture before React receives the final event.
      }
    }
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

  return (
    <div
      ref={rootRef}
      className={cn(
        "pointer-events-auto absolute",
        !framePanel && "will-change-transform",
        !framePanel && floatingPanelPlacementClass[placement],
        !open && "pointer-events-none",
        (dragging || resizing) && "select-none",
        !framePanel && frameClassName
      )}
      style={rootStyle}
      onPointerDownCapture={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerEnd}
      onPointerCancel={pointerEnd}
      onDoubleClickCapture={doubleClick}
      onFocusCapture={focusPanel}
      data-floating-panel-kind={kind}
      data-floating-panel-id={panelId}
      data-floating-panel-active={active ? "true" : "false"}
      data-floating-panel-dismiss-mode={resolvedDismissMode}
      data-floating-panel-window-state={windowState}
    >
      <div className={cn(framePanel && "h-full w-full", !framePanel && floatingPanelAnchorClass[placement])}>
        <div
          ref={surfaceRef}
          className={cn(
            "relative",
            kind !== "workspace" && "will-change-transform",
            floatingPanelSurfaceClass[kind],
            framePanel && "h-full w-full",
            kind === "workspace" && "shadow-lg",
            kind === "workspace" && active && "border-foreground/20 shadow-xl ring-1 ring-foreground/10",
            kind === "workspace" && !active && "border-border/80 shadow-sm",
            open ? "pointer-events-auto" : "pointer-events-none",
            className
          )}
          style={{ opacity: open ? 1 : 0 }}
        >
          {children}
          {framePanel && resizablePanel && !maximized ? (
            <div aria-hidden data-floating-panel-drag-exclude>
              {FLOATING_PANEL_RESIZE_HANDLES.map((handle) => (
                <div
                  key={handle}
                  className={cn("absolute z-40 touch-none", floatingPanelResizeHandleClass[handle])}
                  data-floating-panel-resize-handle={handle}
                  onPointerDown={(event) => startResize(event, handle)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function currentFloatingPanelViewport(): FloatingPanelViewport {
  if (typeof window === "undefined") return { width: 1024, height: 768 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function initialFloatingPanelFrame({
  placement,
  size,
  minSize,
  viewport
}: {
  placement: FloatingPanelPlacement;
  size: FloatingPanelSize;
  minSize: FloatingPanelSize;
  viewport: FloatingPanelViewport;
}): FloatingPanelFrame {
  const margin = viewport.margin ?? FLOATING_PANEL_EDGE_MARGIN_PX;
  const width = Math.min(Math.max(size.width, minSize.width), Math.max(1, viewport.width - margin * 2));
  const height = Math.min(Math.max(size.height, minSize.height), Math.max(1, viewport.height - margin * 2));
  let x = margin;
  let y = margin;

  if (placement === "left-panel") {
    x = EDITOR_CHROME_TOKENS.sidePanelGapPx;
    y = EDITOR_CHROME_TOKENS.sidePanelTopBottomPx;
  } else if (placement === "right-panel") {
    x = viewport.width - EDITOR_CHROME_TOKENS.sidePanelGapPx - width;
    y = EDITOR_CHROME_TOKENS.sidePanelTopBottomPx;
  } else if (placement === "bottom-panel") {
    x = (viewport.width - width) / 2;
    y = viewport.height - 80 - height;
  } else if (placement === "center-panel") {
    x = (viewport.width - width) / 2;
    y = Math.max(EDITOR_CHROME_TOKENS.sidePanelTopBottomPx, (viewport.height - height) / 2);
  } else if (placement === "right") {
    x = viewport.width - margin - width;
    y = EDITOR_CHROME_TOKENS.sidePanelTopBottomPx;
  } else if (placement === "bottom-left") {
    x = margin;
    y = viewport.height - margin - height;
  }

  return fitFloatingPanelFrameToViewport({
    frame: { x, y, width, height },
    viewport,
    minSize
  });
}

function isDragExcluded(target: Element) {
  return Boolean(
    target.closest(
      "button,a,input,textarea,select,[contenteditable='true'],[role='button'],[data-floating-panel-drag-exclude]"
    )
  );
}

export function FloatingButtonCluster({
  orientation = "horizontal",
  className,
  children
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(EDITOR_CHROME_CLASSES.floatingButtonCluster, orientation === "vertical" && "flex-col", className)}>
      {children}
    </div>
  );
}

export function FloatingIconButton({
  label,
  tooltipSide = "bottom",
  active = false,
  danger = false,
  dirty = false,
  badgeCount,
  className,
  children,
  ...buttonProps
}: Omit<ButtonProps, "size" | "variant"> & {
  label: string;
  tooltipSide?: FloatingTooltipSide;
  active?: boolean;
  danger?: boolean;
  dirty?: boolean;
  badgeCount?: number;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant={active ? "default" : "outline"}
          className={cn(
            EDITOR_CHROME_CLASSES.floatingIconButton,
            active ? EDITOR_CHROME_CLASSES.floatingIconActive : EDITOR_CHROME_CLASSES.floatingIconInactive,
            danger && EDITOR_CHROME_CLASSES.floatingIconDanger,
            dirty && "border-primary/45 text-primary hover:text-primary",
            className
          )}
          aria-label={label}
          data-floating-chrome-button
          {...buttonProps}
        >
          {children}
          {dirty ? <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" aria-hidden /> : null}
          {badgeCount && badgeCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none text-background">
              {badgeCount}
            </span>
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}
