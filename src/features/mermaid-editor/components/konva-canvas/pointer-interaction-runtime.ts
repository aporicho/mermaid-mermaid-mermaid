import { useEffect, useRef } from "react";
import type { KonvaEventObject } from "konva/lib/Node";

import type { KonvaCanvasStageProps } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage";
import type { CanvasPoint, HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import { modifiersFromEvent, type InteractionModifiers, type StandardPointerInput } from "@/features/mermaid-editor/lib/interaction/input";

export type KonvaCanvasPointerStageProps = Pick<
  KonvaCanvasStageProps,
  | "nodeContextMenu"
  | "onCanvasPointerDown"
  | "onCanvasPointerMove"
  | "onCanvasPointerUp"
  | "onCanvasPointerLeave"
  | "onCanvasPointerTracking"
  | "onCanvasClick"
  | "onCanvasTap"
  | "onCanvasDoubleClick"
  | "onStartNodeDrag"
  | "onStartSubgraphDrag"
  | "onNodeContextMenu"
  | "onCloseNodeContextMenu"
>;

export type PointerMoveSnapshot = {
  hit: HitTarget;
  pointer: CanvasPoint;
  world: CanvasPoint;
  button: number;
  modifiers: InteractionModifiers;
  timestamp: number;
};

export function useLatestPointerMoveFrame(onFlush: (snapshot: PointerMoveSnapshot) => void) {
  const onFlushRef = useRef(onFlush);
  const pendingRef = useRef<PointerMoveSnapshot | null>(null);
  const frameRef = useRef<number | null>(null);
  onFlushRef.current = onFlush;

  function flush() {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) onFlushRef.current(pending);
  }

  function cancel() {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pendingRef.current = null;
  }

  function schedule(snapshot: PointerMoveSnapshot) {
    pendingRef.current = snapshot;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      flush();
    });
  }

  function flushScheduled() {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    flush();
  }

  useEffect(() => cancel, []);

  return { schedule, flushScheduled, cancel };
}

export function pointerInputFromMoveSnapshot(snapshot: PointerMoveSnapshot): StandardPointerInput {
  return {
    kind: "pointer",
    entry: "web-ui",
    phase: "move",
    pointerId: 0,
    button: snapshot.button,
    screen: snapshot.pointer,
    world: snapshot.world,
    hit: snapshot.hit,
    modifiers: snapshot.modifiers,
    timestamp: snapshot.timestamp
  };
}

export function pointerInputFromKonvaEvent(
  phase: StandardPointerInput["phase"],
  event: KonvaEventObject<MouseEvent>,
  hit: HitTarget,
  screen: CanvasPoint,
  world?: CanvasPoint
): StandardPointerInput {
  return {
    kind: "pointer",
    entry: "web-ui",
    phase,
    pointerId: 0,
    button: event.evt.button,
    screen,
    world,
    hit,
    modifiers: modifiersFromEvent(event.evt),
    timestamp: event.evt.timeStamp
  };
}

export function shouldResolvePointerMove(state: InteractionState) {
  return (
    state.kind === "pendingBlankPointer" ||
    state.kind === "pendingNodePointer" ||
    state.kind === "pendingSubgraphPointer" ||
    state.kind === "marqueeSelecting" ||
    state.kind === "connectingEdge" ||
    state.kind === "retargetingEdge"
  );
}

export function sameInteractionState(left: InteractionState, right: InteractionState) {
  if (left.kind !== right.kind) return false;
  if (left.kind === "idle" || right.kind === "idle") return true;
  if (left.kind === "pendingBlankPointer" && right.kind === "pendingBlankPointer") {
    return left.pointerId === right.pointerId && samePoint(left.startScreen, right.startScreen) && samePoint(left.startWorld, right.startWorld) && left.startedAt === right.startedAt && left.selectionVersion === right.selectionVersion;
  }
  if (left.kind === "pendingNodePointer" && right.kind === "pendingNodePointer") {
    return left.nodeId === right.nodeId && left.pointerId === right.pointerId && samePoint(left.startScreen, right.startScreen) && samePoint(left.startWorld, right.startWorld) && left.startedAt === right.startedAt && left.selectionVersion === right.selectionVersion;
  }
  if (left.kind === "pendingSubgraphPointer" && right.kind === "pendingSubgraphPointer") {
    return left.subgraphId === right.subgraphId && left.pointerId === right.pointerId && samePoint(left.startScreen, right.startScreen) && samePoint(left.startWorld, right.startWorld) && left.startedAt === right.startedAt && left.selectionVersion === right.selectionVersion;
  }
  if (left.kind === "marqueeSelecting" && right.kind === "marqueeSelecting") return left.pointerId === right.pointerId && samePoint(left.startWorld, right.startWorld) && samePoint(left.currentWorld, right.currentWorld);
  if (left.kind === "draggingNodes" && right.kind === "draggingNodes") return left.pointerId === right.pointerId && left.nodeId === right.nodeId && samePoint(left.startScreen, right.startScreen) && samePoint(left.startWorld, right.startWorld);
  if (left.kind === "draggingSubgraphs" && right.kind === "draggingSubgraphs") return left.pointerId === right.pointerId && left.subgraphId === right.subgraphId && samePoint(left.startScreen, right.startScreen) && samePoint(left.startWorld, right.startWorld);
  if (left.kind === "panning" && right.kind === "panning") return left.pointerId === right.pointerId && samePoint(left.startScreen, right.startScreen) && left.originViewport.x === right.originViewport.x && left.originViewport.y === right.originViewport.y && left.originViewport.scale === right.originViewport.scale;
  if (left.kind === "connectingEdge" && right.kind === "connectingEdge") return left.pointerId === right.pointerId && left.fromId === right.fromId && left.fromAnchor === right.fromAnchor && samePoint(left.startWorld, right.startWorld) && samePoint(left.currentWorld, right.currentWorld);
  if (left.kind === "retargetingEdge" && right.kind === "retargetingEdge") return left.pointerId === right.pointerId && left.edgeId === right.edgeId && left.side === right.side && samePoint(left.currentWorld, right.currentWorld);
  if (left.kind === "editingNodeText" && right.kind === "editingNodeText") return left.nodeId === right.nodeId;
  if (left.kind === "editingSubgraphTitle" && right.kind === "editingSubgraphTitle") return left.subgraphId === right.subgraphId;
  if (left.kind === "editingEdgeLabel" && right.kind === "editingEdgeLabel") return left.edgeId === right.edgeId;
  return false;
}

function samePoint(left: CanvasPoint, right: CanvasPoint) {
  return left.x === right.x && left.y === right.y;
}
