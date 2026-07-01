import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import type { ScreenPointResolver, ScheduledViewport, SafariGestureEvent, ViewportCommandSource } from "@/features/mermaid-editor/components/konva-canvas/types";
import { createWheelIntentTracker } from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import type { CanvasPoint, HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { EdgeRouting, EditorMode, LayoutMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { commandFromInteractionIntent } from "@/features/mermaid-editor/lib/interaction/commands";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import { createStandardGestureInput, createStandardWheelInput } from "@/features/mermaid-editor/lib/interaction/input";
import { resolveInteractionIntent } from "@/features/mermaid-editor/lib/interaction/intent";
import { useViewportScheduler } from "@/features/mermaid-editor/lib/interaction/viewport-scheduler";

type UseKonvaViewportArgs = {
  containerRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<Konva.Stage | null>;
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
};

export function useKonvaViewport({
  containerRef,
  stageRef,
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
  invalidateBlankClickIntent
}: UseKonvaViewportArgs) {
  const viewportRef = useRef(viewport);
  const wheelIntentTrackerRef = useRef(createWheelIntentTracker());
  const suppressWheelZoomUntilRef = useRef(0);
  const gestureNavigationRef = useRef<{ viewport: ViewportState; pointer: CanvasPoint } | null>(null);

  const applyViewportToStage = useCallback((update: ScheduledViewport) => {
    const nextViewport = update.viewport;
    const stage = stageRef.current;
    viewportRef.current = nextViewport;

    if (!stage) return;
    stage.position({ x: nextViewport.x, y: nextViewport.y });
    stage.scale({ x: nextViewport.scale, y: nextViewport.scale });
    stage.batchDraw();
  }, [stageRef]);

  const {
    current: currentScheduledViewport,
    schedule: scheduleScheduledViewport,
    sync: syncScheduledViewport
  } = useViewportScheduler<ScheduledViewport>({
    initialValue: { viewport, source: "api" },
    metricName: "canvas-viewport-visual-latency",
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

  const pointerScreenPoint = useCallback((): CanvasPoint | null => stageRef.current?.getPointerPosition() || null, [stageRef]);

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
    (event: KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const pointer = pointerScreenPoint() || screenPointFromClient(event.evt.clientX, event.evt.clientY);
      if (!pointer) return;

      const isZoomWheel = !event.evt.shiftKey && Math.abs(event.evt.deltaY) > 0;
      if (isZoomWheel && Date.now() < suppressWheelZoomUntilRef.current) return;

      const wheelInput = createStandardWheelInput({
        pointer,
        canvasSize: dimensions,
        deltaX: event.evt.deltaX,
        deltaY: event.evt.deltaY,
        deltaMode: event.evt.deltaMode,
        modifiers: {
          ctrlKey: event.evt.ctrlKey,
          metaKey: event.evt.metaKey,
          shiftKey: event.evt.shiftKey,
          altKey: event.evt.altKey
        },
        timestamp: event.evt.timeStamp,
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
      scheduleViewportChange(command.viewport, command.source);
    },
    [
      currentViewport,
      dimensions,
      edgeRouting,
      graph,
      hoveredHitTarget,
      interactionState.kind,
      invalidateBlankClickIntent,
      layoutMode,
      mode,
      pointerScreenPoint,
      scheduleViewportChange,
      screenPointFromClient,
      selection,
      viewFilters
    ]
  );

  useLayoutEffect(() => {
    syncScheduledViewport({ viewport, source: "api" }, { applyVisual: true });
  }, [dimensions.height, dimensions.width, syncScheduledViewport, viewport]);

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
  }, [containerRef, currentViewport, dimensions, edgeRouting, graph, hoveredHitTarget, interactionState.kind, invalidateBlankClickIntent, layoutMode, mode, scheduleViewportChange, screenPointFromClient, selection, viewFilters]);

  return {
    currentViewport,
    scheduleViewportChange,
    pointerWorldPoint,
    trackPointerWorldPoint,
    screenToWorld,
    worldToScreen,
    pointerScreenPoint,
    screenPointFromClient,
    onWheel
  };
}
