import type { EditorMode, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export type CanvasPoint = {
  x: number;
  y: number;
};

export type HitTarget =
  | { kind: "blank" }
  | { kind: "node"; id: string }
  | { kind: "nodeAnchor"; nodeId: string; anchor: string }
  | { kind: "edge"; id: string }
  | { kind: "edgeLabel"; id: string }
  | { kind: "edgeEndpoint"; edgeId: string; side: "from" | "to" };

export type InteractionState =
  | { kind: "idle" }
  | {
      kind: "pendingBlankPointer";
      pointerId: number;
      startScreen: CanvasPoint;
      startWorld: CanvasPoint;
      startedAt: number;
      selectionVersion: number;
    }
  | {
      kind: "pendingNodePointer";
      nodeId: string;
      pointerId: number;
      startScreen: CanvasPoint;
      startWorld: CanvasPoint;
      startedAt: number;
      selectionVersion: number;
    }
  | { kind: "marqueeSelecting"; pointerId: number; startWorld: CanvasPoint; currentWorld: CanvasPoint }
  | { kind: "draggingNodes"; pointerId: number; nodeId: string; startScreen: CanvasPoint; startWorld: CanvasPoint }
  | { kind: "panning"; pointerId: number; startScreen: CanvasPoint; originViewport: ViewportState }
  | {
      kind: "connectingEdge";
      pointerId: number;
      fromNodeId: string;
      startWorld: CanvasPoint;
      currentWorld: CanvasPoint;
    }
  | { kind: "retargetingEdge"; pointerId: number; edgeId: string; side: "from" | "to" }
  | { kind: "editingNodeText"; nodeId: string }
  | { kind: "editingEdgeLabel"; edgeId: string };

export type BlankClickIntent = {
  target: "blank";
  pointerId: number;
  screen: CanvasPoint;
  world: CanvasPoint;
  time: number;
  selectionVersion: number;
  interactionGeneration: number;
};

export type PointerDownInput = {
  state: InteractionState;
  tool: EditorMode;
  hit: HitTarget;
  button: number;
  screen: CanvasPoint;
  world: CanvasPoint;
  now: number;
  selectionVersion: number;
  viewport: ViewportState;
  panningRequested?: boolean;
};

export type PointerMoveInput = {
  state: InteractionState;
  screen: CanvasPoint;
  world: CanvasPoint;
};

export type InteractionTransition = {
  state: InteractionState;
  clearBlankClickIntent: boolean;
};

export type BlankClickResolution =
  | { action: "ignore"; intent: null }
  | { action: "clearSelection"; intent: null }
  | { action: "record"; intent: BlankClickIntent }
  | { action: "addNode"; intent: null; point: CanvasPoint };

export const CANVAS_DRAG_THRESHOLD_PX = 4;
export const BLANK_DOUBLE_CLICK_MS = 360;
export const BLANK_DOUBLE_CLICK_DISTANCE_PX = 8;

export const idleInteraction: InteractionState = { kind: "idle" };

export function hasSelection(selection: Selection) {
  return selection.nodeIds.length > 0 || selection.edgeIds.length > 0;
}

export function selectionVersionKey(selection: Selection) {
  return [...selection.nodeIds, "|", ...selection.edgeIds].join(",");
}

export function beginCanvasPointer(input: PointerDownInput): InteractionTransition {
  if (input.state.kind !== "idle") {
    return { state: input.state, clearBlankClickIntent: true };
  }

  if (input.button === 1 || input.panningRequested) {
    return {
      state: {
        kind: "panning",
        pointerId: 0,
        startScreen: input.screen,
        originViewport: input.viewport
      },
      clearBlankClickIntent: true
    };
  }

  if (input.button !== 0) {
    return { state: input.state, clearBlankClickIntent: true };
  }

  if (input.tool === "select") {
    if (input.hit.kind === "blank") {
      return {
        state: {
          kind: "pendingBlankPointer",
          pointerId: 0,
          startScreen: input.screen,
          startWorld: input.world,
          startedAt: input.now,
          selectionVersion: input.selectionVersion
        },
        clearBlankClickIntent: false
      };
    }

    if (input.hit.kind === "node") {
      return {
        state: {
          kind: "pendingNodePointer",
          nodeId: input.hit.id,
          pointerId: 0,
          startScreen: input.screen,
          startWorld: input.world,
          startedAt: input.now,
          selectionVersion: input.selectionVersion
        },
        clearBlankClickIntent: true
      };
    }

    if (input.hit.kind === "edgeEndpoint") {
      return {
        state: {
          kind: "retargetingEdge",
          pointerId: 0,
          edgeId: input.hit.edgeId,
          side: input.hit.side
        },
        clearBlankClickIntent: true
      };
    }
  }

  if (input.tool === "connect" && input.hit.kind === "nodeAnchor") {
    return {
      state: {
        kind: "connectingEdge",
        pointerId: 0,
        fromNodeId: input.hit.nodeId,
        startWorld: input.world,
        currentWorld: input.world
      },
      clearBlankClickIntent: true
    };
  }

  return { state: input.state, clearBlankClickIntent: input.hit.kind !== "blank" };
}

export function updateCanvasPointer(input: PointerMoveInput): InteractionTransition {
  const { state, screen, world } = input;

  if (state.kind === "pendingBlankPointer" && movedBeyondThreshold(state.startScreen, screen)) {
    return {
      state: { kind: "marqueeSelecting", pointerId: state.pointerId, startWorld: state.startWorld, currentWorld: world },
      clearBlankClickIntent: true
    };
  }

  if (state.kind === "pendingNodePointer" && movedBeyondThreshold(state.startScreen, screen)) {
    return {
      state: {
        kind: "draggingNodes",
        pointerId: state.pointerId,
        nodeId: state.nodeId,
        startScreen: state.startScreen,
        startWorld: state.startWorld
      },
      clearBlankClickIntent: true
    };
  }

  if (state.kind === "marqueeSelecting") {
    return { state: { ...state, currentWorld: world }, clearBlankClickIntent: false };
  }

  if (state.kind === "connectingEdge") {
    return { state: { ...state, currentWorld: world }, clearBlankClickIntent: false };
  }

  return { state, clearBlankClickIntent: false };
}

export function resolveBlankClick(input: {
  previous: BlankClickIntent | null;
  tool: EditorMode;
  state: InteractionState;
  hasSelection: boolean;
  screen: CanvasPoint;
  world: CanvasPoint;
  now: number;
  pointerId?: number;
  selectionVersion: number;
  interactionGeneration: number;
}): BlankClickResolution {
  if (input.tool !== "select" || input.state.kind !== "pendingBlankPointer") {
    return { action: "ignore", intent: null };
  }

  if (input.hasSelection) {
    return { action: "clearSelection", intent: null };
  }

  const pointerId = input.pointerId ?? 0;
  if (isValidSecondBlankClick(input.previous, input.screen, input.now, pointerId, input.selectionVersion, input.interactionGeneration)) {
    return { action: "addNode", intent: null, point: input.world };
  }

  return {
    action: "record",
    intent: {
      target: "blank",
      pointerId,
      screen: input.screen,
      world: input.world,
      time: input.now,
      selectionVersion: input.selectionVersion,
      interactionGeneration: input.interactionGeneration
    }
  };
}

export function interactionCursor(tool: EditorMode, state: InteractionState, panningRequested: boolean) {
  if (state.kind === "panning") return "cursor-grabbing";
  if (panningRequested) return "cursor-grab";
  if (state.kind === "draggingNodes") return "cursor-grabbing";
  if (isEditingInteraction(state)) return "cursor-text";
  if (state.kind === "connectingEdge" || state.kind === "retargetingEdge" || tool === "connect") return "cursor-crosshair";
  return "cursor-default";
}

export function isEditingInteraction(state: InteractionState) {
  return state.kind === "editingNodeText" || state.kind === "editingEdgeLabel";
}

export function movedBeyondThreshold(start: CanvasPoint, current: CanvasPoint, threshold = CANVAS_DRAG_THRESHOLD_PX) {
  return distance(start, current) > threshold;
}

function isValidSecondBlankClick(
  previous: BlankClickIntent | null,
  screen: CanvasPoint,
  now: number,
  pointerId: number,
  selectionVersion: number,
  interactionGeneration: number
) {
  if (!previous) return false;
  if (previous.pointerId !== pointerId) return false;
  if (previous.selectionVersion !== selectionVersion) return false;
  if (previous.interactionGeneration !== interactionGeneration) return false;
  if (now - previous.time > BLANK_DOUBLE_CLICK_MS) return false;
  return distance(previous.screen, screen) <= BLANK_DOUBLE_CLICK_DISTANCE_PX;
}

function distance(a: CanvasPoint, b: CanvasPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
