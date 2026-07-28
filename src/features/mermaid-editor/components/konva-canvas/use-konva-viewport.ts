import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject, type WheelEvent as ReactWheelEvent } from "react";
import type { ScreenPointResolver, ScheduledViewport, SafariGestureEvent, ViewportCommandSource } from "@/features/mermaid-editor/components/konva-canvas/types";
import { createWheelIntentTracker } from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import type { CanvasPoint, HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { EdgeRouting, EditorMode, LayoutMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { CanvasViewportCompositor } from "@/features/mermaid-editor/components/konva-canvas/canvas-viewport-compositor";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { commandFromInteractionIntent } from "@/features/mermaid-editor/lib/interaction/commands";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import { createStandardGestureInput, createStandardWheelInput } from "@/features/mermaid-editor/lib/interaction/input";
import { resolveInteractionIntent } from "@/features/mermaid-editor/lib/interaction/intent";
import { useViewportScheduler } from "@/features/mermaid-editor/lib/interaction/viewport-scheduler";
import type { CanvasNodeTextureCacheController } from "@/features/mermaid-editor/components/konva-canvas/canvas-node-texture-cache";

export const CANVAS_VIEWPORT_WHEEL_END_MS = 100;
export const CANVAS_VIEWPORT_COMMIT_DELAY_MS = 180;

type UseKonvaViewportArgs = {
  containerRef: RefObject<HTMLDivElement | null>;
  dimensions: { width: number; height: number };
  viewport: ViewportState;
  graph: MermaidGraph;
  selection: Selection;
  viewFilters: ViewFilters;
  mode: EditorMode;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  hoveredHitTarget: HitTarget;
  interactionState: InteractionState;
  onEditorCommand: (command: EditorCommand) => void;
  onPointerWorldChange?: (point: CanvasPoint) => void;
  invalidateBlankClickIntent: () => void;
  nodeTextureCacheController: CanvasNodeTextureCacheController;
  viewportCompositor: CanvasViewportCompositor;
};

export function useKonvaViewport({
  containerRef,
  dimensions,
  viewport,
  graph,
  selection,
  viewFilters,
  mode,
  edgeRouting,
  layoutMode,
  hoveredHitTarget,
  interactionState,
  onEditorCommand,
  onPointerWorldChange,
  invalidateBlankClickIntent,
  nodeTextureCacheController,
  viewportCompositor
}: UseKonvaViewportArgs) {
  const viewportRef = useRef(viewport);
  const wheelIntentTrackerRef = useRef(createWheelIntentTracker());
  const suppressWheelZoomUntilRef = useRef(0);
  const gestureNavigationRef = useRef<{ viewport: ViewportState; pointer: CanvasPoint } | null>(null);
  const pointerScreenRef = useRef<CanvasPoint | null>(null);
  const wheelEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTextureCacheViewportRef = useRef<ViewportState | null>(null);

  const applyViewportToStage = useCallback((update: ScheduledViewport) => {
    const nextViewport = update.viewport;
    viewportRef.current = nextViewport;
    viewportCompositor.apply(nextViewport);
    const lastTextureCacheViewport = lastTextureCacheViewportRef.current;
    if (!lastTextureCacheViewport || !viewportsMatch(lastTextureCacheViewport, nextViewport)) {
      lastTextureCacheViewportRef.current = nextViewport;
      nodeTextureCacheController.handleViewport(nextViewport);
    }
  }, [nodeTextureCacheController, viewportCompositor]);

  const {
    current: currentScheduledViewport,
    schedule: scheduleScheduledViewport,
    sync: syncScheduledViewport,
    flush: flushScheduledViewport
  } = useViewportScheduler<ScheduledViewport>({
    initialValue: { viewport, source: "api" },
    metricName: "canvas-viewport-visual-latency",
    commitDelayMs: CANVAS_VIEWPORT_COMMIT_DELAY_MS,
    applyVisual: applyViewportToStage,
    commit: (update) => {
      onEditorCommand({ type: "viewport.set", viewport: update.viewport, source: update.source });
    }
  });

  const currentViewport = useCallback(() => currentScheduledViewport().viewport, [currentScheduledViewport]);

  const scheduleViewportChange = useCallback(
    (nextViewport: ViewportState, source: ViewportCommandSource = "wheel") => {
      viewportRef.current = nextViewport;
      scheduleScheduledViewport({ viewport: nextViewport, source });
    },
    [scheduleScheduledViewport]
  );

  const clearWheelEndTimer = useCallback(() => {
    if (wheelEndTimerRef.current !== null) clearTimeout(wheelEndTimerRef.current);
    wheelEndTimerRef.current = null;
  }, []);

  const beginViewportInteraction = useCallback(() => {
    clearWheelEndTimer();
    viewportCompositor.beginNavigation();
  }, [clearWheelEndTimer, viewportCompositor]);

  const finishViewportChange = useCallback((nextViewport: ViewportState, source: ViewportCommandSource = "pointer") => {
    clearWheelEndTimer();
    viewportRef.current = nextViewport;
    flushScheduledViewport({ viewport: nextViewport, source });
    viewportCompositor.endNavigation();
  }, [clearWheelEndTimer, flushScheduledViewport, viewportCompositor]);

  const finishViewportInteraction = useCallback((source: ViewportCommandSource = "pointer") => {
    finishViewportChange(currentViewport(), source);
  }, [currentViewport, finishViewportChange]);

  const screenPointFromClient: ScreenPointResolver = useCallback(
    (clientX, clientY) => {
      const container = containerRef.current;
      if (!container || typeof clientX !== "number" || typeof clientY !== "number") return null;

      const rect = container.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    },
    [containerRef]
  );

  const pointerScreenPoint = useCallback((): CanvasPoint | null => pointerScreenRef.current, []);

  const trackPointerScreenPoint = useCallback((point: CanvasPoint | null) => {
    pointerScreenRef.current = point;
    return point;
  }, []);

  const screenToWorld = useCallback(
    (point: CanvasPoint) => {
      const activeViewport = currentViewport();
      return {
        x: (point.x - activeViewport.x) / activeViewport.scale,
        y: (point.y - activeViewport.y) / activeViewport.scale
      };
    },
    [currentViewport]
  );

  const worldToScreen = useCallback(
    (point: { x: number; y: number }) => {
      const activeViewport = currentViewport();
      return {
        x: activeViewport.x + point.x * activeViewport.scale,
        y: activeViewport.y + point.y * activeViewport.scale
      };
    },
    [currentViewport]
  );

  const pointerWorldPoint = useCallback(() => {
    const pointer = pointerScreenPoint();
    return pointer ? screenToWorld(pointer) : null;
  }, [pointerScreenPoint, screenToWorld]);

  const trackPointerWorldPoint = useCallback(
    (point = pointerWorldPoint()) => {
      if (point) onPointerWorldChange?.(point);
      return point;
    },
    [onPointerWorldChange, pointerWorldPoint]
  );

  const onWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const pointer = screenPointFromClient(event.clientX, event.clientY) || pointerScreenPoint();
      if (!pointer) return;
      trackPointerScreenPoint(pointer);

      const isZoomWheel = !event.shiftKey && Math.abs(event.deltaY) > 0;
      if (isZoomWheel && Date.now() < suppressWheelZoomUntilRef.current) return;

      const wheelInput = createStandardWheelInput({
        pointer,
        canvasSize: dimensions,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        modifiers: {
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey
        },
        timestamp: event.timeStamp,
        interactionKind: interactionState.kind
      });
      const intent = resolveInteractionIntent(
        wheelInput,
        buildInteractionContext({
          graph,
          selection,
          viewport: currentViewport(),
          viewFilters,
          mode,
          workspaceView: "canvas",
          editableKind: "flowchart",
          edgeRouting,
          layoutMode,
          canvasSize: dimensions,
          hitTarget: hoveredHitTarget,
          modifiers: wheelInput.modifiers,
          gestureState: interactionState.kind
        }),
        { wheelIntentTracker: wheelIntentTrackerRef.current }
      );
      const command = commandFromInteractionIntent(intent);

      if (command?.type !== "viewport.set") return;

      invalidateBlankClickIntent();
      beginViewportInteraction();
      scheduleViewportChange(command.viewport, command.source);
      wheelEndTimerRef.current = setTimeout(() => {
        wheelEndTimerRef.current = null;
        finishViewportInteraction(command.source);
      }, CANVAS_VIEWPORT_WHEEL_END_MS);
    },
    [
      currentViewport,
      beginViewportInteraction,
      dimensions,
      edgeRouting,
      graph,
      hoveredHitTarget,
      interactionState.kind,
      invalidateBlankClickIntent,
      finishViewportInteraction,
      layoutMode,
      mode,
      pointerScreenPoint,
      scheduleViewportChange,
      screenPointFromClient,
      trackPointerScreenPoint,
      selection,
      viewFilters
    ]
  );

  useLayoutEffect(() => {
    syncScheduledViewport({ viewport, source: "api" }, { applyVisual: true });
  }, [dimensions.height, dimensions.width, syncScheduledViewport, viewport]);

  useEffect(() => clearWheelEndTimer, [clearWheelEndTimer]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function gesturePoint(event: SafariGestureEvent) {
      return screenPointFromClient(event.clientX, event.clientY) || { x: dimensions.width / 2, y: dimensions.height / 2 };
    }

    function onGestureStart(event: SafariGestureEvent) {
      event.preventDefault();
      suppressWheelZoomUntilRef.current = Date.now() + 350;

      if (interactionState.kind !== "idle") {
        gestureNavigationRef.current = null;
        return;
      }

      invalidateBlankClickIntent();
      beginViewportInteraction();
      gestureNavigationRef.current = {
        viewport: currentViewport(),
        pointer: gesturePoint(event)
      };
    }

    function onGestureChange(event: SafariGestureEvent) {
      event.preventDefault();
      suppressWheelZoomUntilRef.current = Date.now() + 250;

      const start = gestureNavigationRef.current;
      const scale = typeof event.scale === "number" && Number.isFinite(event.scale) ? event.scale : 1;
      if (!start || scale <= 0) return;

      const gestureInput = createStandardGestureInput({
        phase: "change",
        pointer: start.pointer,
        canvasSize: dimensions,
        scale,
        timestamp: event.timeStamp,
        interactionKind: interactionState.kind
      });
      const intent = resolveInteractionIntent(
        gestureInput,
        buildInteractionContext({
          graph,
          selection,
          viewport: start.viewport,
          viewFilters,
          mode,
          workspaceView: "canvas",
          editableKind: "flowchart",
          edgeRouting,
          layoutMode,
          canvasSize: dimensions,
          hitTarget: hoveredHitTarget,
          modifiers: gestureInput.modifiers,
          gestureState: interactionState.kind
        })
      );
      const command = commandFromInteractionIntent(intent);
      if (command?.type === "viewport.set") scheduleViewportChange(command.viewport, command.source);
    }

    function onGestureEnd(event: SafariGestureEvent) {
      event.preventDefault();
      if (gestureNavigationRef.current) finishViewportInteraction("gesture");
      gestureNavigationRef.current = null;
      suppressWheelZoomUntilRef.current = Date.now() + 350;
    }

    container.addEventListener("gesturestart", onGestureStart as EventListener, { passive: false });
    container.addEventListener("gesturechange", onGestureChange as EventListener, { passive: false });
    container.addEventListener("gestureend", onGestureEnd as EventListener, { passive: false });

    return () => {
      container.removeEventListener("gesturestart", onGestureStart as EventListener);
      container.removeEventListener("gesturechange", onGestureChange as EventListener);
      container.removeEventListener("gestureend", onGestureEnd as EventListener);
    };
  }, [beginViewportInteraction, containerRef, currentViewport, dimensions, edgeRouting, finishViewportInteraction, graph, hoveredHitTarget, interactionState.kind, invalidateBlankClickIntent, layoutMode, mode, scheduleViewportChange, screenPointFromClient, selection, viewFilters]);

  return {
    currentViewport,
    scheduleViewportChange,
    beginViewportInteraction,
    finishViewportChange,
    finishViewportInteraction,
    pointerWorldPoint,
    trackPointerWorldPoint,
    screenToWorld,
    worldToScreen,
    pointerScreenPoint,
    trackPointerScreenPoint,
    screenPointFromClient,
    onWheel
  };
}

function viewportsMatch(left: ViewportState, right: ViewportState) {
  return Math.abs(left.x - right.x) < 0.001
    && Math.abs(left.y - right.y) < 0.001
    && Math.abs(left.scale - right.scale) < 0.000001;
}
