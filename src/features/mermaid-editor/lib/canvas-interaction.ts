import type { EditorMode, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export type CanvasPoint = {
  x: number;
  y: number;
};

export type HitTarget =
  | { kind: "blank" }
  | { kind: "node"; id: string }
  | { kind: "nodeAnchor"; nodeId: string; anchor: string }
  | { kind: "subgraph"; id: string }
  | { kind: "subgraphAnchor"; subgraphId: string; anchor: string }
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
  | {
      kind: "pendingSubgraphPointer";
      subgraphId: string;
      pointerId: number;
      startScreen: CanvasPoint;
      startWorld: CanvasPoint;
      startedAt: number;
      selectionVersion: number;
    }
  | { kind: "marqueeSelecting"; pointerId: number; startWorld: CanvasPoint; currentWorld: CanvasPoint }
  | { kind: "draggingNodes"; pointerId: number; nodeId: string; startScreen: CanvasPoint; startWorld: CanvasPoint }
  | { kind: "draggingSubgraphs"; pointerId: number; subgraphId: string; startScreen: CanvasPoint; startWorld: CanvasPoint }
  | { kind: "panning"; pointerId: number; startScreen: CanvasPoint; originViewport: ViewportState }
  | {
      kind: "connectingEdge";
      pointerId: number;
      fromId: string;
      startWorld: CanvasPoint;
      currentWorld: CanvasPoint;
    }
  | { kind: "retargetingEdge"; pointerId: number; edgeId: string; side: "from" | "to"; currentWorld: CanvasPoint }
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

export type CanvasRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type InlineEditCommandTarget = { type: "node" | "edge"; id: string };

export type CanvasInteractionCommand =
  | { type: "invalidateBlankClick" }
  | { type: "clearSelection" }
  | { type: "recordBlankClick"; intent: BlankClickIntent }
  | { type: "addNodeAt"; point: CanvasPoint }
  | { type: "selectNode"; id: string; additive: boolean }
  | { type: "selectSubgraph"; id: string; additive: boolean }
  | { type: "selectEdge"; id: string; additive: boolean }
  | { type: "startInlineEdit"; target: InlineEditCommandTarget }
  | { type: "startNodeDrag"; nodeId: string }
  | { type: "startSubgraphDrag"; subgraphId: string }
  | { type: "selectMarquee"; rect: CanvasRect }
  | { type: "finishConnection"; draft: Extract<InteractionState, { kind: "connectingEdge" }> }
  | { type: "retargetEdge"; edgeId: string; side: "from" | "to"; point: CanvasPoint }
  | { type: "resetInteraction" };

export type CanvasDispatchResult = {
  state: InteractionState;
  commands: CanvasInteractionCommand[];
};

export const CANVAS_DRAG_THRESHOLD_PX = 4;
export const BLANK_DOUBLE_CLICK_MS = 360;
export const BLANK_DOUBLE_CLICK_DISTANCE_PX = 8;

export const idleInteraction: InteractionState = { kind: "idle" };

export function hasSelection(selection: Selection) {
  return selection.nodeIds.length > 0 || selection.edgeIds.length > 0 || (selection.subgraphIds?.length || 0) > 0;
}

export function selectionVersionKey(selection: Selection) {
  return [...selection.nodeIds, "|", ...selection.edgeIds, "|", ...(selection.subgraphIds || [])].join(",");
}

export function isPanningButton(button: number) {
  return button === 1 || button === 2;
}

export function beginCanvasPointer(input: PointerDownInput): InteractionTransition {
  if (input.state.kind !== "idle") {
    return { state: input.state, clearBlankClickIntent: true };
  }

  if (isPanningButton(input.button) || input.panningRequested) {
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

    if (input.hit.kind === "nodeAnchor") {
      return {
        state: {
          kind: "connectingEdge",
          pointerId: 0,
          fromId: input.hit.nodeId,
          startWorld: input.world,
          currentWorld: input.world
        },
        clearBlankClickIntent: true
      };
    }

    if (input.hit.kind === "subgraph") {
      return {
        state: {
          kind: "pendingSubgraphPointer",
          subgraphId: input.hit.id,
          pointerId: 0,
          startScreen: input.screen,
          startWorld: input.world,
          startedAt: input.now,
          selectionVersion: input.selectionVersion
        },
        clearBlankClickIntent: true
      };
    }

    if (input.hit.kind === "subgraphAnchor") {
      return {
        state: {
          kind: "connectingEdge",
          pointerId: 0,
          fromId: input.hit.subgraphId,
          startWorld: input.world,
          currentWorld: input.world
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
          side: input.hit.side,
          currentWorld: input.world
        },
        clearBlankClickIntent: true
      };
    }
  }

  if (input.tool === "connect" && (input.hit.kind === "node" || input.hit.kind === "nodeAnchor" || input.hit.kind === "subgraph" || input.hit.kind === "subgraphAnchor")) {
    const fromId =
      input.hit.kind === "node"
        ? input.hit.id
        : input.hit.kind === "nodeAnchor"
          ? input.hit.nodeId
          : input.hit.kind === "subgraph"
            ? input.hit.id
            : input.hit.subgraphId;

    return {
      state: {
        kind: "connectingEdge",
        pointerId: 0,
        fromId,
        startWorld: input.world,
        currentWorld: input.world
      },
      clearBlankClickIntent: true
    };
  }

  return { state: input.state, clearBlankClickIntent: input.hit.kind !== "blank" };
}

export function dispatchCanvasPointerDown(input: PointerDownInput): CanvasDispatchResult {
  const transition = beginCanvasPointer(input);

  return {
    state: transition.state,
    commands: transition.clearBlankClickIntent ? [{ type: "invalidateBlankClick" }] : []
  };
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

  if (state.kind === "pendingSubgraphPointer" && movedBeyondThreshold(state.startScreen, screen)) {
    return {
      state: {
        kind: "draggingSubgraphs",
        pointerId: state.pointerId,
        subgraphId: state.subgraphId,
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

  if (state.kind === "retargetingEdge") {
    return { state: { ...state, currentWorld: world }, clearBlankClickIntent: false };
  }

  return { state, clearBlankClickIntent: false };
}

export function dispatchCanvasPointerMove(input: PointerMoveInput): CanvasDispatchResult {
  const transition = updateCanvasPointer(input);
  const commands: CanvasInteractionCommand[] = [];

  if (transition.clearBlankClickIntent) {
    commands.push({ type: "invalidateBlankClick" });
  }

  if (input.state.kind === "pendingNodePointer" && transition.state.kind === "draggingNodes") {
    commands.push({ type: "startNodeDrag", nodeId: transition.state.nodeId });
  }

  if (input.state.kind === "pendingSubgraphPointer" && transition.state.kind === "draggingSubgraphs") {
    commands.push({ type: "startSubgraphDrag", subgraphId: transition.state.subgraphId });
  }

  return {
    state: transition.state,
    commands
  };
}

export function dispatchCanvasPointerUp(input: {
  state: InteractionState;
  tool: EditorMode;
  hit: HitTarget;
  hasSelection: boolean;
  screen: CanvasPoint;
  world: CanvasPoint;
  now: number;
  previousBlankClick: BlankClickIntent | null;
  selectionVersion: number;
  interactionGeneration: number;
}): CanvasDispatchResult {
  const commands: CanvasInteractionCommand[] = [];

  if (input.state.kind === "pendingBlankPointer" && input.hit.kind === "blank") {
    const result = resolveBlankClick({
      previous: input.previousBlankClick,
      tool: input.tool,
      state: input.state,
      hasSelection: input.hasSelection,
      screen: input.screen,
      world: input.world,
      now: input.now,
      selectionVersion: input.selectionVersion,
      interactionGeneration: input.interactionGeneration
    });

    if (result.action === "clearSelection") {
      commands.push({ type: "clearSelection" });
    } else if (result.action === "record") {
      commands.push({ type: "recordBlankClick", intent: result.intent });
    } else if (result.action === "addNode") {
      commands.push({ type: "addNodeAt", point: result.point });
      commands.push({ type: "invalidateBlankClick" });
    }
  }

  if (input.state.kind === "marqueeSelecting") {
    commands.push({ type: "selectMarquee", rect: normalizeWorldRect(input.state.startWorld, input.state.currentWorld) });
    commands.push({ type: "invalidateBlankClick" });
  }

  if (input.state.kind === "connectingEdge") {
    commands.push({ type: "finishConnection", draft: input.state });
    commands.push({ type: "invalidateBlankClick" });
  }

  if (input.state.kind === "retargetingEdge") {
    commands.push({ type: "retargetEdge", edgeId: input.state.edgeId, side: input.state.side, point: input.world });
    commands.push({ type: "invalidateBlankClick" });
  }

  commands.push({ type: "resetInteraction" });

  return {
    state: idleInteraction,
    commands
  };
}

export function dispatchCanvasClick(input: { tool: EditorMode; hit: HitTarget; shiftKey: boolean }): CanvasInteractionCommand[] {
  if (input.hit.kind === "blank") return [];

  const commands: CanvasInteractionCommand[] = [{ type: "invalidateBlankClick" }];
  if (input.tool !== "select") return commands;

  if (input.hit.kind === "node") {
    commands.push({ type: "selectNode", id: input.hit.id, additive: input.shiftKey });
  }

  if (input.hit.kind === "nodeAnchor") {
    commands.push({ type: "selectNode", id: input.hit.nodeId, additive: input.shiftKey });
  }

  if (input.hit.kind === "subgraph") {
    commands.push({ type: "selectSubgraph", id: input.hit.id, additive: input.shiftKey });
  }

  if (input.hit.kind === "subgraphAnchor") {
    commands.push({ type: "selectSubgraph", id: input.hit.subgraphId, additive: input.shiftKey });
  }

  if (input.hit.kind === "edge" || input.hit.kind === "edgeLabel") {
    commands.push({ type: "selectEdge", id: input.hit.id, additive: input.shiftKey });
  }

  if (input.hit.kind === "edgeEndpoint") {
    commands.push({ type: "selectEdge", id: input.hit.edgeId, additive: input.shiftKey });
  }

  return commands;
}

export function dispatchCanvasDoubleClick(input: { tool: EditorMode; hit: HitTarget }): CanvasInteractionCommand[] {
  if (input.hit.kind === "blank") return [];

  const commands: CanvasInteractionCommand[] = [{ type: "invalidateBlankClick" }];
  if (input.tool !== "select") return commands;

  if (input.hit.kind === "node" || input.hit.kind === "nodeAnchor") {
    const id = input.hit.kind === "node" ? input.hit.id : input.hit.nodeId;
    commands.push({ type: "selectNode", id, additive: false });
    commands.push({ type: "startInlineEdit", target: { type: "node", id } });
  }

  if (input.hit.kind === "subgraph" || input.hit.kind === "subgraphAnchor") {
    const id = input.hit.kind === "subgraph" ? input.hit.id : input.hit.subgraphId;
    commands.push({ type: "selectSubgraph", id, additive: false });
  }

  if (input.hit.kind === "edge" || input.hit.kind === "edgeLabel") {
    commands.push({ type: "selectEdge", id: input.hit.id, additive: false });
    commands.push({ type: "startInlineEdit", target: { type: "edge", id: input.hit.id } });
  }

  return commands;
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

export function interactionCursor(tool: EditorMode, state: InteractionState, panningRequested: boolean, hit?: HitTarget) {
  if (state.kind === "panning") return "cursor-grabbing";
  if (panningRequested) return "cursor-grab";
  if (state.kind === "draggingNodes" || state.kind === "draggingSubgraphs") return "cursor-grabbing";
  if (isEditingInteraction(state)) return "cursor-text";
  if (state.kind === "connectingEdge" || state.kind === "retargetingEdge" || tool === "connect") return "cursor-crosshair";
  if (tool === "select" && (hit?.kind === "nodeAnchor" || hit?.kind === "subgraphAnchor" || hit?.kind === "edgeEndpoint")) return "cursor-crosshair";
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

function normalizeWorldRect(start: CanvasPoint, end: CanvasPoint): CanvasRect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}
